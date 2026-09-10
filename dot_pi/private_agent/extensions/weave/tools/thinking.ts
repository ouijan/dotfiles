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
 *   collapsed and only while some block on screen is carrying the digest: the
 *   message's own tool calls, or the open group above it, which keeps a turn
 *   that thinks before calling anything from floating a bare label under the
 *   block. A turn with no group at all (the final answer) keeps pi's label.
 *
 * Expanded (ctrl+o), nothing is dropped: full thinking and full rows layer
 * chronologically, exactly as pi renders them.
 */

import { AssistantMessageComponent } from "@earendil-works/pi-coding-agent";
import { isBlank, truncateText } from "../lib/format.ts";
import { live, publish } from "../lib/live-binding.ts";

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
 * The closing thoughts of the last thinking block — the sentences that decide
 * what the tools are about to do, which are the ones worth keeping. Whole
 * sentences are taken from the end while they fit, so the digest reads as
 * prose rather than a clipped fragment.
 */
export function digest(thinkingBlocks: string[], maxWidth = 240): string {
	const latest = [...thinkingBlocks].reverse().find((block) => block.trim().length > 0);
	if (!latest) return "";
	const sentences = toProse(latest)
		.split(/(?<=[.!?])\s+/)
		.filter((sentence) => sentence.trim().length > 0);
	const last = sentences[sentences.length - 1] ?? "";
	let kept = "";
	for (const sentence of [...sentences].reverse()) {
		const candidate = kept ? `${sentence} ${kept}` : sentence;
		if (candidate.length > maxWidth) break;
		kept = candidate;
	}
	return kept || truncateText(last, maxWidth, "head");
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

type ShouldHide = (hasToolCalls: boolean) => boolean;

/**
 * Drop the marked thinking label while some tool block is carrying the digest.
 * `shouldHide` is asked per message, with whether that message made tool calls.
 *
 * Like tools/rows.ts, the patch survives the instance that installed it, so the
 * predicate is read live rather than captured: every instance publishes its own
 * at load, including ones that load with folding off. Returns false when the
 * class cannot be patched or was already patched by an earlier instance.
 */
export function hideGroupedThinkingLabels(shouldHide: ShouldHide): boolean {
	publish("weaveThinkingShouldHide", shouldHide);
	try {
		const proto = AssistantMessageComponent?.prototype as unknown as PatchableProto | undefined;
		const original = proto?.render;
		if (!proto || typeof original !== "function" || proto.weaveThinkingPatched) return false;
		proto.render = function patchedRender(width: number): string[] {
			const lines = original.call(this, width);
			const active = live<ShouldHide>("weaveThinkingShouldHide");
			try {
				if (!active?.(this.hasToolCalls === true)) return lines;
			} catch {
				// Never let a stale binding throw out of a timer-driven render.
				return lines;
			}
			const kept = lines.filter((line) => !line.includes(SENTINEL));
			return isBlank(kept) ? [] : kept;
		};
		proto.weaveThinkingPatched = true;
		return true;
	} catch {
		return false;
	}
}
