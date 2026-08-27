/**
 * Fold a turn's thinking into its tool-group line.
 *
 * Collapsed, pi still draws one `Thinking...` label per assistant message, so a
 * turn reads `Thinking... / tools / Thinking... / tools` — the label breaks the
 * very run of calls weave just grouped. Weave instead moves the thought *into*
 * the counter line: one line per turn carrying both what ran and why.
 *
 * pi has no hook for the label, so weave marks it and drops it, the same
 * borrowed-class technique (and same caveat) as tools/rows.ts:
 *
 * - the label is set to `Thinking...` plus an invisible sentinel, so an
 *   unpatched pi still renders a sane label;
 * - `AssistantMessageComponent.render` drops sentinel lines, but only while
 *   collapsed and only for messages that made tool calls. A turn that only
 *   thinks (the final answer) keeps pi's label, because it has no counter line
 *   to carry the digest.
 *
 * Expanded (ctrl+o), nothing is dropped: full thinking and full rows layer
 * chronologically, exactly as pi renders them.
 */

import { AssistantMessageComponent } from "@earendil-works/pi-coding-agent";
import { isBlank, truncateText } from "../lib/format.ts";

/** Zero-width, so the label still reads as "Thinking..." without the patch. */
const SENTINEL = "\u200b";
export const THINKING_LABEL = `Thinking...${SENTINEL}`;

/** Fenced code, inline code, emphasis and list bullets, flattened to prose. */
function toProse(thinking: string): string {
	return thinking
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/[`*_>#]/g, "")
		.replace(/^\s*[-+]\s+/gm, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * The last complete thought of the last thinking block — the sentence that
 * decides what the tools are about to do, which is the one worth keeping.
 */
export function digest(thinkingBlocks: string[], maxWidth = 72): string {
	const latest = [...thinkingBlocks].reverse().find((block) => block.trim().length > 0);
	if (!latest) return "";
	const sentences = toProse(latest)
		.split(/(?<=[.!?])\s+/)
		.filter((sentence) => sentence.trim().length > 0);
	const last = sentences[sentences.length - 1] ?? "";
	return truncateText(last, maxWidth, "head");
}

interface ThinkingContent {
	type: string;
	thinking?: string;
}

/** Thinking text of an assistant message, in order. */
export function thinkingBlocks(message: { content?: ThinkingContent[] }): string[] {
	const content = message.content ?? [];
	return content.filter((part) => part.type === "thinking").map((part) => part.thinking ?? "");
}

interface PatchableProto {
	render?: (width: number) => string[];
	hasToolCalls?: boolean;
	weaveThinkingPatched?: boolean;
}

/**
 * Drop the marked thinking label from tool-calling messages while `collapsed()`
 * holds. Returns false when the class cannot be patched.
 */
export function hideGroupedThinkingLabels(collapsed: () => boolean): boolean {
	try {
		const proto = AssistantMessageComponent?.prototype as unknown as PatchableProto | undefined;
		const original = proto?.render;
		if (!proto || typeof original !== "function" || proto.weaveThinkingPatched) return false;
		proto.render = function patchedRender(width: number): string[] {
			const lines = original.call(this, width);
			if (!collapsed() || !this.hasToolCalls) return lines;
			const kept = lines.filter((line) => !line.includes(SENTINEL));
			return isBlank(kept) ? [] : kept;
		};
		proto.weaveThinkingPatched = true;
		return true;
	} catch {
		return false;
	}
}
