/**
 * weave — personal pi customizations.
 *
 * Phase 1: declarative text powerline footer (see docs/weave-pi-extension.md
 * in the dotfiles repo). Layout, colors, and separator are configured via the
 * `weave.footer` block in ~/.pi/agent/settings.json; the default mirrors pi's
 * built-in footer placement.
 *
 * Phase 2: tool grouping (`weave.tools`) — a run of tool calls collapses to one
 * counter line carrying the turn's thinking digest, so thinking no longer
 * interrupts the run of calls; ctrl+o expands them back to pi's own rows and
 * pi's own thinking blocks. Execution is pi's, untouched. Grouping is applied
 * at the row component, so it covers every registered tool, not just built-ins.
 *
 * Phase 3: startup chrome and discovery — the agent roster (`weave.roster`)
 * and foreign-harness skill directories (`weave.skills`), both formerly
 * standalone extensions. They are load-time only, so they register once here
 * rather than participating in the /weave toggle.
 *
 * Commands: /weave (toggle) · /weave statuses (list extension status keys for
 * `status` segments). Settings are re-read whenever the footer is enabled, so
 * pi's own /reload picks up config edits — no weave-specific reload command.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadWeaveConfig } from "./config.ts";
import { ToolGroups, type CounterTheme } from "./tools/groups.ts";
import { groupToolRows } from "./tools/rows.ts";
import { hasVisibleText } from "./lib/message.ts";
import { digest, hideGroupedThinkingLabels, THINKING_LABEL, thinkingBlocks } from "./tools/thinking.ts";
import { registerAgentRoster } from "./roster/roster.ts";
import { registerSkillDiscovery } from "./skills/discover.ts";
import { AgentActivity } from "./footer/activity.ts";
import { createFooterFactory, unknownSegmentNames } from "./footer/footer.ts";
import { MCP_STATUS_EVENT, McpStatus } from "./footer/mcp.ts";
import type { SegmentFooterData } from "./footer/segments.ts";

export default function weave(pi: ExtensionAPI) {
	let footerActive = false;
	let lastFooterData: SegmentFooterData | undefined;
	const sources = { activity: new AgentActivity(), mcp: new McpStatus() };
	const startup = loadWeaveConfig();
	const groups = new ToolGroups(startup.tools.minimize);
	/** Set once the TUI exists; /theme can swap the instance, so read it late. */
	let getTheme: () => CounterTheme | undefined = () => undefined;

	// Only worth folding when pi already collapses thinking to a label: with full
	// thinking blocks on screen the digest would just repeat them.
	const foldThinking = startup.tools.enabled && startup.tools.thinking && startup.hideThinkingBlock;

	// The row patch must be in place at load time, before the first turn.
	if (startup.tools.enabled) {
		groupToolRows({ config: startup.tools, groups, getTheme: () => getTheme() });
	}
	if (foldThinking) hideGroupedThinkingLabels(() => groups.collapsed);

	registerAgentRoster(pi, startup.roster);
	registerSkillDiscovery(pi, startup.skills);

	/** Keep the counter line's digest in step with the streaming thinking. */
	function foldThinkingInto(message: unknown): void {
		if (!foldThinking) return;
		const assistant = message as { role?: string; content?: { type: string; thinking?: string }[] };
		if (assistant?.role !== "assistant") return;
		groups.setThinking(digest(thinkingBlocks(assistant), startup.tools.thinkingWidth));
	}

	/**
	 * A group ends when the model says something out loud, not when a turn ends.
	 * Thinking is folded into the counter line and its label hidden, so a turn
	 * boundary is invisible — splitting on it left a run of `1 tool call` lines.
	 * Text is visible, so calls after it belong with what it just said. Text
	 * streams ahead of tool_use blocks, so the break lands before any row joins.
	 */
	let brokeOnText = false;
	function breakOnVisibleText(message: unknown): void {
		if (brokeOnText || !hasVisibleText(message)) return;
		brokeOnText = true;
		groups.reset();
	}

	function onAssistantMessage(message: unknown): void {
		breakOnVisibleText(message);
		foldThinkingInto(message);
	}

	pi.on("agent_start", async () => {
		sources.activity.start();
		groups.setRunning(true);
	});
	pi.on("turn_start", async () => {
		brokeOnText = false;
	});
	pi.on("message_update", async (event) => onAssistantMessage(event.message));
	pi.on("message_end", async (event) => onAssistantMessage(event.message));
	pi.on("agent_end", async () => {
		sources.activity.stop();
		groups.setRunning(false);
	});
	pi.events.on(MCP_STATUS_EVENT, (snapshot: unknown) => sources.mcp.update(snapshot));

	function enableFooter(ctx: ExtensionContext): void {
		const config = loadWeaveConfig();
		const unknown = unknownSegmentNames(config.footer);
		if (unknown.length > 0) {
			ctx.ui.notify(`weave: unknown segment(s): ${unknown.join(", ")}`, "warning");
		}
		const factory = createFooterFactory(ctx, config.footer, sources, (footerData) => {
			lastFooterData = footerData;
		});
		ctx.ui.setFooter(factory);
		footerActive = true;
	}

	function disableFooter(ctx: ExtensionContext): void {
		ctx.ui.setFooter(undefined);
		footerActive = false;
	}

	function listStatuses(ctx: ExtensionContext): void {
		const entries = lastFooterData ? [...lastFooterData.getExtensionStatuses().entries()] : [];
		if (entries.length === 0) {
			ctx.ui.notify("weave: no extension statuses set", "info");
			return;
		}
		const lines = entries.map(([key, text]) => `${key} → ${text}`);
		ctx.ui.notify(`weave status keys:\n${lines.join("\n")}`, "info");
	}

	function toggleTools(ctx: ExtensionContext): void {
		groups.minimized = !groups.minimized;
		groups.invalidateAll();
		const state = groups.minimized ? "minimized (ctrl+o expands)" : "expanded";
		ctx.ui.notify(`weave tool calls ${state}`, "info");
	}

	function toggle(ctx: ExtensionContext): void {
		if (footerActive) {
			disableFooter(ctx);
			ctx.ui.notify("weave footer off (built-in restored)", "info");
			return;
		}
		enableFooter(ctx);
		ctx.ui.notify("weave footer on", "info");
	}

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		getTheme = () => ctx.ui.theme;
		// Marks pi's collapsed label so the thinking patch can recognise it.
		if (foldThinking) ctx.ui.setHiddenThinkingLabel(THINKING_LABEL);
		const config = loadWeaveConfig();
		if (config.footer.enabled) enableFooter(ctx);
	});

	pi.registerCommand("weave", {
		description: "weave: toggle footer, 'tools' to minimize tool calls, 'statuses' to list status keys",
		handler: async (args, ctx) => {
			const subcommand = (args ?? "").trim();
			if (subcommand === "statuses") {
				listStatuses(ctx);
				return;
			}
			if (subcommand === "tools") {
				toggleTools(ctx);
				return;
			}
			toggle(ctx);
		},
	});
}
