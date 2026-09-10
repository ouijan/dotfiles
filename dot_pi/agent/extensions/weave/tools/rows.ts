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
 * emit the group as its own small box: pi's row picks its background from that
 * one call's state, so a group of calls wore the colour of whichever one
 * happened to be first. Weave paints the block from the *worst* state in the
 * group instead, and colours each tool name inside it by its own state.
 *
 * Same borrowed-class technique — and same caveat — as tools/thinking.ts: pi's
 * bundle aliases `@earendil-works/pi-coding-agent` to its own live module
 * instances, so extensions and the UI share one class object.
 */


import { ToolExecutionComponent } from "@earendil-works/pi-coding-agent";
import { installRowGrouping, type PatchableProto, type RowGroupingOptions } from "./rows-patch.ts";

export type { RowGroupingOptions } from "./rows-patch.ts";

/**
 * Collapse grouped tool rows to a single counter line, and rebind the patch to
 * this extension instance. See rows-patch.ts for why the body lives elsewhere.
 * Returns false when the class cannot be patched or is already patched.
 */
export function groupToolRows(options: RowGroupingOptions): boolean {
	return installRowGrouping(ToolExecutionComponent?.prototype as unknown as PatchableProto | undefined, options);
}
