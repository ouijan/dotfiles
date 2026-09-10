/**
 * The row-grouping patch body, with pi's class injected by rows.ts.
 *
 * Kept free of any `@earendil-works/pi-coding-agent` import so the regression
 * check (patch.check.ts) can drive it against a stand-in prototype: outside a
 * running pi that package resolves to a types-only stub with no runtime entry.
 */

import { DEFAULT_MINIMIZED_FORMAT, minimizedBlock, type CallState, type CounterTheme, type ToolGroups } from "./groups.ts";
import { live, publish } from "../lib/live-binding.ts";
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

export interface PatchableProto {
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

/** The grouped block for this row, or undefined to let pi render its own. */
function groupedBlock(row: ToolRow, options: RowGroupingOptions, width: number): string[] | undefined {
	const { config, groups } = options;
	const theme = options.getTheme();
	if (!theme || config.exclude.includes(row.toolName)) return;

	const grouped = groups.join(row.toolCallId, row.toolName, () => row.invalidate());
	groups.noteExpanded(row.expanded);
	if (!grouped) return;

	groups.setState(row.toolCallId, callState(row));
	if (!groups.collapsed) return;
	if (!groups.isLeader(row.toolCallId)) return [];

	return minimizedBlock({
		format: config.minimizedFormat ?? DEFAULT_MINIMIZED_FORMAT,
		values: groups.values(row.toolCallId, theme),
		theme,
		width,
		state: groups.stateOf(row.toolCallId),
		thinkingLines: config.thinkingLines,
	});
}

/**
 * Collapse grouped tool rows to a single counter line.
 *
 * Called by every extension instance, including ones that load with grouping
 * off: publishing is what hands the already-installed patch the current
 * instance's config, groups and theme accessor. Returns false when the class
 * cannot be patched or was already patched by an earlier instance — the patch
 * still picks up this instance's binding either way.
 */
export function installRowGrouping(rowProto: PatchableProto | undefined, options: RowGroupingOptions): boolean {
	publish("weaveRowGrouping", options.config.enabled ? options : undefined);

	try {
		const original = rowProto?.render;
		const proto = rowProto;
		if (!proto || typeof original !== "function" || proto.weaveRowsPatched) return false;

		proto.render = function patchedRender(width: number): string[] {
			const active = live<RowGroupingOptions>("weaveRowGrouping");
			if (!active) return original.call(this, width);
			try {
				return groupedBlock(this as unknown as ToolRow, active, width) ?? original.call(this, width);
			} catch {
				// Render runs on pi's timer, so anything thrown here surfaces as an
				// uncaughtException and exits pi. Degrade to pi's own row instead.
				return original.call(this, width);
			}
		};

		proto.weaveRowsPatched = true;
		return true;
	} catch {
		return false;
	}
}
