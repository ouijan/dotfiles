/**
 * Agent roster
 *
 * Lists the agents available to `subagent` just under the startup header, so the
 * splash screen shows what can be delegated to.
 *
 * The built-in header cannot be extended in place (ui.setHeader replaces it) and
 * the loaded-resource container is private, so the roster is appended as a custom
 * entry shaped exactly like a built-in resource block: one `Text` holding the
 * `[Agents]` heading and its dim, comma-joined list, then a one-line `Spacer`.
 *
 * Custom entries are *persisted* session state, which makes them the wrong shape
 * for splash chrome: resuming a session replayed every roster ever appended,
 * mid-transcript. So each entry is stamped with the run that wrote it, and the
 * renderer returns `undefined` — pi's documented "render nothing" — for entries
 * from any other run. The stamp also stops `/reload` stacking duplicates.
 *
 * Disabled agents are filtered out, so the roster matches what `subagent` will
 * actually run. An agent is disabled by `disabled: true` in its frontmatter, or
 * by `subagents.agentOverrides.<name>.disabled` in settings — project settings
 * winning over user settings, the same precedence pi-subagents applies.
 */

import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import type { WeaveRosterConfig } from "../config.ts";

const ENTRY_TYPE = "agent-roster";
const AGENT_DIRS = [join(homedir(), ".pi", "agent", "agents"), join(process.cwd(), ".pi", "agents")];
/** User settings first, project second: a project `disabled` wins on conflict. */
const SETTINGS_FILES = [
	join(homedir(), ".pi", "agent", "settings.json"),
	join(process.cwd(), ".pi", "settings.json"),
];
const FRONTMATTER_DISABLED = /^disabled:\s*true\s*$/m;

/** Identifies this pi process, so a resumed session can tell old rosters apart. */
const RUN_ID = String(process.pid);

interface AgentRosterData {
	names: string[];
	runId?: string;
}

interface AgentFile {
	name: string;
	path: string;
}

function readAgentFiles(directory: string): AgentFile[] {
	try {
		return readdirSync(directory)
			.filter((file) => file.endsWith(".md"))
			.map((file) => ({ name: file.slice(0, -".md".length), path: join(directory, file) }));
	} catch {
		return [];
	}
}

/** Frontmatter is the block between the first two `---` fences, if present. */
function disabledInFrontmatter(path: string): boolean {
	try {
		const contents = readFileSync(path, "utf8");
		if (!contents.startsWith("---")) return false;
		const end = contents.indexOf("\n---", 3);
		const frontmatter = end === -1 ? contents : contents.slice(3, end);
		return FRONTMATTER_DISABLED.test(frontmatter);
	} catch {
		return false;
	}
}

interface SettingsShape {
	quietStartup?: boolean;
	subagents?: { agentOverrides?: Record<string, { disabled?: boolean }> };
}

function readSettings(settingsPath: string): SettingsShape {
	try {
		return JSON.parse(readFileSync(settingsPath, "utf8"));
	} catch {
		return {};
	}
}

/** `quietStartup` hides the built-in resource blocks; the roster follows suit. */
function startupIsQuiet(): boolean {
	return SETTINGS_FILES.map(readSettings).some((settings) => settings.quietStartup === true);
}

/** Names switched off by `subagents.agentOverrides.<name>.disabled` in settings. */
function readDisabledOverrides(settingsPath: string): string[] {
	const settings = readSettings(settingsPath) as SettingsShape;
	const overrides = settings.subagents?.agentOverrides ?? {};
	return Object.entries(overrides)
		.filter(([, override]) => override?.disabled === true)
		.map(([name]) => name);
}

function collectNames(): string[] {
	const disabled = new Set(SETTINGS_FILES.flatMap(readDisabledOverrides));
	const enabled = AGENT_DIRS.flatMap(readAgentFiles).filter(
		(agent) => !disabled.has(agent.name) && !disabledInFrontmatter(agent.path),
	);
	const names = [...new Set(enabled.map((agent) => agent.name))];
	return names.sort((first, second) => first.localeCompare(second));
}

/** Mirrors interactive-mode's loaded-resource sections: one Text, then a Spacer. */
function renderRoster(names: string[], theme: Theme): Container {
	const container = new Container();
	const heading = theme.fg("mdHeading", "[Agents]");
	const body = theme.fg("dim", `  ${names.length > 0 ? names.join(", ") : "None"}`);

	container.addChild(new Text(`${heading}\n${body}`, 0, 0));
	container.addChild(new Spacer(1));

	return container;
}

/** Has this run already written a roster? True after a `/reload`. */
function alreadyShown(ctx: ExtensionContext): boolean {
	return ctx.sessionManager.getEntries().some((entry) => {
		if (entry.type !== "custom" || entry.customType !== ENTRY_TYPE) return false;
		return (entry.data as AgentRosterData | undefined)?.runId === RUN_ID;
	});
}

export function registerAgentRoster(pi: ExtensionAPI, config: WeaveRosterConfig): void {
	if (!config.enabled) return;

	pi.registerEntryRenderer<AgentRosterData>(ENTRY_TYPE, (entry, _state, theme) => {
		const data = entry.data;
		// Rosters from earlier runs are history, not chrome: draw nothing.
		if (!data || data.runId !== RUN_ID) return;
		return renderRoster(data.names, theme);
	});

	pi.on("session_start", async (event, ctx) => {
		const isFreshStart = event.reason === "startup" || event.reason === "new";
		if (ctx.mode !== "tui" || !isFreshStart || startupIsQuiet() || alreadyShown(ctx)) {
			return;
		}

		pi.appendEntry<AgentRosterData>(ENTRY_TYPE, { names: collectNames(), runId: RUN_ID });
	});
}
