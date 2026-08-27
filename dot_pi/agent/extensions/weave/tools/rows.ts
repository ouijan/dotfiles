/**
 * Collapse tool rows by patching the row component, not the tools.
 *
 * Weave used to group by re-registering pi's built-in tools with wrapped
 * renderers, spreading the original `ToolDefinition` to keep its `execute`.
 * That only ever worked for built-ins: `pi.getAllTools()` hands back metadata
 * (name, description, parameters, sourceInfo) and nothing executable, so a
 * tool owned by another extension — `ask_user_question`, `subagent`, `mcp` —
 * cannot be wrapped without destroying it.
 *
 * `ToolExecutionComponent.render` is the one place every tool row passes
 * through, whoever registered it. Patching it groups the lot, and lets weave
 * emit the counter line as plain text: pi's row otherwise wraps content in a
 * `Box` whose background is picked from the *leader's* state, so a group of
 * calls wore the colour of whichever one happened to be first. A summary is
 * not a tool row, so it gets no tool background at all; the tool names inside
 * it carry the colour instead, one per name, worst state winning.
 *
 * Same borrowed-class technique — and same caveat — as tools/thinking.ts: pi's
 * bundle aliases `@earendil-works/pi-coding-agent` to its own live module
 * instances, so extensions and the UI share one class object.
 */

import { ToolExecutionComponent } from "@earendil-works/pi-coding-agent";
import { DEFAULT_MINIMIZED_FORMAT, minimizedLine, type CallState, type CounterTheme, type ToolGroups } from "./groups.ts";
import type { WeaveToolsConfig } from "../config.ts";

/** Private row state weave reads. Names track pi's own fields. */
interface ToolRow {
	toolName: string;
	toolCallId: string;
	expanded: boolean;
	isPartial: boolean;
	result?: { isError: boolean };
	invalidate(): void;
}

interface PatchableProto {
	render?: (width: number) => string[];
	weaveRowsPatched?: boolean;
}

function callState(row: ToolRow): CallState {
	if (!row.result || row.isPartial) return "pending";
	return row.result.isError ? "error" : "ok";
}

export interface RowGroupingOptions {
	config: WeaveToolsConfig;
	groups: ToolGroups;
	/** Read late: the theme can change under us via /theme. */
	getTheme: () => CounterTheme | undefined;
}

/**
 * Collapse grouped tool rows to a single counter line.
 * Returns false when the class cannot be patched.
 */
export function groupToolRows(options: RowGroupingOptions): boolean {
	const { config, groups, getTheme } = options;
	const format = config.minimizedFormat ?? DEFAULT_MINIMIZED_FORMAT;
	const excluded = new Set(config.exclude);

	try {
		const proto = ToolExecutionComponent?.prototype as unknown as PatchableProto | undefined;
		const original = proto?.render;
		if (!proto || typeof original !== "function" || proto.weaveRowsPatched) return false;

		proto.render = function patchedRender(width: number): string[] {
			const row = this as unknown as ToolRow;
			const theme = getTheme();
			if (!theme || excluded.has(row.toolName)) return original.call(this, width);

			const grouped = groups.join(row.toolCallId, row.toolName, () => row.invalidate());
			groups.noteExpanded(row.expanded);
			if (!grouped) return original.call(this, width);

			groups.setState(row.toolCallId, callState(row));
			if (!groups.collapsed) return original.call(this, width);
			if (!groups.isLeader(row.toolCallId)) return [];

			const values = groups.values(row.toolCallId, theme);
			return ["", minimizedLine(format, values, theme, width)];
		};

		proto.weaveRowsPatched = true;
		return true;
	} catch {
		return false;
	}
}
