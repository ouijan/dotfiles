/**
 * Groups of consecutive tool calls, and the minimized "N tool calls" line.
 *
 * A group runs until the model says something out loud. `agent_start` opens the
 * first one; visible assistant text opens the next. Thinking does *not* break a
 * group — weave hides the collapsed `Thinking...` label and folds the thought
 * into the counter line instead, so a turn boundary is invisible and splitting
 * on it produced a run of `1 tool call` lines. Text is different: it is on
 * screen, so calls that follow it belong to what it just said.
 *
 * Rows are keyed by `toolCallId` and remember the group they joined, so a
 * re-render of an old row (scroll, resize) never re-joins it to the current
 * group and inflates the count.
 *
 * Minimized, only the group leader renders — a small box, `minimizedFormat` on
 * its first line and the turn's thinking wrapped underneath, on the shared tool
 * background — and every other row renders no lines at all (see tools/rows.ts).
 * ctrl+o (app.tools.expand) expands; `/weave tools` toggles.
 */

import { expandTemplate, fitToWidth, visibleWidth, wrapText } from "../lib/format.ts";

/** Re-render is deferred: invalidating another row mid-pass would reenter it. */
function defer(callback: () => void): void {
	setTimeout(callback, 0);
}

/** How a single call is getting on, which is what colours its name. */
export type CallState = "pending" | "ok" | "error";

/** Theme surface the counter line needs (subset of pi's Theme). */
export interface CounterTheme {
	fg(color: string, text: string): string;
	bg(color: string, text: string): string;
	getFgAnsi(color: string): string;
	italic?(text: string): string;
}

const STATE_COLOR: Record<CallState, string> = {
	pending: "dim",
	ok: "toolTitle",
	error: "error",
};

/** Worst state wins: one failure colours the whole name red. */
const STATE_RANK: Record<CallState, number> = { ok: 0, pending: 1, error: 2 };

/** pi's own tool-row backgrounds, so a group reads as one tool block. */
const STATE_BG: Record<CallState, string> = {
	pending: "toolPendingBg",
	ok: "toolSuccessBg",
	error: "toolErrorBg",
};

interface Group {
	ids: string[];
	names: Map<string, string>;
	states: Map<string, CallState>;
	handles: Map<string, () => void>;
	/** One-line digest of the turn's thinking, folded into the counter line. */
	thinking: string;
}

function newGroup(): Group {
	return { ids: [], names: new Map(), states: new Map(), handles: new Map(), thinking: "" };
}

interface ToolTally {
	count: number;
	state: CallState;
}

/** Per tool name, how many calls and how the worst of them is doing. */
function tally(group: Group): Map<string, ToolTally> {
	const tallies = new Map<string, ToolTally>();
	for (const id of group.ids) {
		const name = group.names.get(id) ?? "?";
		const state = group.states.get(id) ?? "pending";
		const existing = tallies.get(name);
		if (!existing) {
			tallies.set(name, { count: 1, state });
			continue;
		}
		existing.count += 1;
		if (STATE_RANK[state] > STATE_RANK[existing.state]) existing.state = state;
	}
	return tallies;
}

/**
 * "bash×3 read×2", in first-seen order, each name coloured by its own state.
 * Every name re-opens `dim` afterwards so the line's base styling survives it.
 */
function toolBreakdown(group: Group, theme: CounterTheme): string {
	const dim = theme.getFgAnsi("dim");
	const parts = [...tally(group)].map(([name, { count, state }]) => {
		const label = count > 1 ? `${name}×${count}` : name;
		return `${theme.fg(STATE_COLOR[state], label)}${dim}`;
	});
	return parts.join(" ");
}

function failureCount(group: Group): number {
	return [...group.states.values()].filter((state) => state === "error").length;
}

/** The worst state in the group: error beats pending beats ok. */
function groupState(group: Group): CallState {
	let worst: CallState = "ok";
	for (const state of group.states.values()) {
		if (STATE_RANK[state] > STATE_RANK[worst]) worst = state;
	}
	return worst;
}

export class ToolGroups {
	private current = newGroup();
	private groupOf = new Map<string, Group>();
	/** Last expansion state a row reported; the thinking patch reads it too. */
	private rowsExpanded = false;
	/** Rows only join while the agent is running, so history renders as pi's. */
	private running = false;

	constructor(public minimized: boolean) {}

	/** True while rows are drawn as one counter line instead of pi's own rows. */
	get collapsed(): boolean {
		return this.minimized && !this.rowsExpanded;
	}

	/** Rows know the expansion state (ctrl+o); nothing else in weave does. */
	noteExpanded(expanded: boolean): void {
		this.rowsExpanded = expanded;
	}

	/** Attach the turn's thinking digest to the group being built. Idempotent. */
	setThinking(text: string): void {
		if (this.current.thinking === text) return;
		this.current.thinking = text;
		this.invalidateLeader(this.current);
	}

	/** Open a group. Existing rows keep the group they already joined. */
	reset(): void {
		this.current = newGroup();
	}

	/** Bracket the agent run: rows rendered outside one are pi's own, ungrouped. */
	setRunning(running: boolean): void {
		this.running = running;
		if (running) this.reset();
	}

	/** Has this row been grouped? False for scrollback from before weave loaded. */
	knows(toolCallId: string): boolean {
		return this.groupOf.has(toolCallId);
	}

	/** Register a row. Safe to call on every render; only the first one counts. */
	join(toolCallId: string, toolName: string, invalidate: () => void): boolean {
		const known = this.groupOf.get(toolCallId);
		if (!known && !this.running) return false;
		const group = known ?? this.current;
		group.handles.set(toolCallId, invalidate);
		if (known) return true;
		group.ids.push(toolCallId);
		group.names.set(toolCallId, toolName);
		group.states.set(toolCallId, "pending");
		this.groupOf.set(toolCallId, group);
		this.invalidateLeader(group);
		return true;
	}

	/** Record how a call ended so the counter line can colour and count it. */
	setState(toolCallId: string, state: CallState): void {
		const group = this.groupOf.get(toolCallId);
		if (!group || group.states.get(toolCallId) === state) return;
		group.states.set(toolCallId, state);
		this.invalidateLeader(group);
	}

	isLeader(toolCallId: string): boolean {
		return this.groupOf.get(toolCallId)?.ids[0] === toolCallId;
	}

	/** Background state of the row's group: error beats pending beats ok. */
	stateOf(toolCallId: string): CallState {
		const group = this.groupOf.get(toolCallId);
		return group ? groupState(group) : "pending";
	}

	/**
	 * True while a group on screen is carrying this turn's thinking digest — the
	 * signal that pi's own `Thinking...` label would be a duplicate.
	 */
	get hasLiveGroup(): boolean {
		return this.running && this.current.ids.length > 0;
	}

	/** Template values for the minimized line of the row's group. */
	values(toolCallId: string, theme: CounterTheme): Record<string, string> {
		const group = this.groupOf.get(toolCallId) ?? this.current;
		const count = group.ids.length;
		const failures = failureCount(group);
		return {
			count: String(count),
			plural: count === 1 ? "" : "s",
			tools: toolBreakdown(group, theme),
			errors: failures > 0 ? `${theme.fg("error", `(${failures} failed)`)}${theme.getFgAnsi("dim")}` : "",
			last: group.names.get(group.ids[group.ids.length - 1] ?? "") ?? "",
			thinking: group.thinking,
		};
	}

	/** Re-render every known row (used when the minimize flag flips). */
	invalidateAll(): void {
		for (const group of new Set(this.groupOf.values())) {
			for (const invalidate of group.handles.values()) defer(invalidate);
		}
	}

	private invalidateLeader(group: Group): void {
		const leaderId = group.ids[0];
		const invalidate = leaderId ? group.handles.get(leaderId) : undefined;
		if (invalidate) defer(invalidate);
	}
}

export const DEFAULT_MINIMIZED_FORMAT = "🔧 {count} tool call{plural} {tools} {errors}";

/** Matches pi's tool `Box(1, 1)`: one column of side padding, one blank row. */
const PAD_X = 1;

/** The `· ` marker that opens the thought; continuations align under it. */
const THINKING_PREFIX = "· ";
const THINKING_INDENT = "  ";

export interface MinimizedBlock {
	format: string;
	values: Record<string, string>;
	theme: CounterTheme;
	width: number;
	state: CallState;
	/** How many wrapped thinking lines the block may carry. 0 hides them. */
	thinkingLines: number;
}

/**
 * The group as one padded block on pi's tool background: counts on the first
 * line, the turn's thought wrapped underneath. Every line is padded to `width`
 * so the background reads as a single box, and an untinted line opens the block
 * so it doesn't butt up against the message above it.
 */
export function minimizedBlock(block: MinimizedBlock): string[] {
	const { theme, width, state } = block;
	const contentWidth = Math.max(1, width - PAD_X * 2);
	const body = [counterLine(block, contentWidth), ...thinkingLines(block, contentWidth)];
	const blank = backgroundLine("", theme, state, width);
	return ["", blank, ...body.map((line) => backgroundLine(line, theme, state, width)), blank];
}

/** Pad to the full width and paint the tool background over the lot. */
function backgroundLine(text: string, theme: CounterTheme, state: CallState, width: number): string {
	const content = text ? `${" ".repeat(PAD_X)}${fitToWidth(text, width - PAD_X)}` : "";
	const padding = " ".repeat(Math.max(0, width - visibleWidth(content)));
	return theme.bg(STATE_BG[state], `${content}${padding}`);
}

/**
 * The counts, dimmed end to end. Coloured values re-open `dim` after their own
 * reset, so the base styling carries across them.
 */
function counterLine(block: MinimizedBlock, contentWidth: number): string {
	const { format, values, theme } = block;
	const body = expandTemplate(format, { ...values, thinking: "" });
	// The counts alone can outgrow a narrow terminal, so clamp regardless.
	return `${theme.getFgAnsi("dim")}${fitToWidth(body, contentWidth)}\u001b[39m`;
}

/** The turn's thought, styled as thinking so it reads apart from the counts. */
function thinkingLines(block: MinimizedBlock, contentWidth: number): string[] {
	const { theme, values, thinkingLines: maxLines } = block;
	const textWidth = contentWidth - visibleWidth(THINKING_PREFIX);
	if (!values.thinking || textWidth < 8) return [];
	const wrapped = wrapText(values.thinking, textWidth, maxLines);
	return wrapped.map((line, index) => {
		const marker = index === 0 ? THINKING_PREFIX : THINKING_INDENT;
		return styleThinking(theme, `${marker}${line}`);
	});
}

function styleThinking(theme: CounterTheme, text: string): string {
	const thought = theme.fg("thinkingText", text);
	return theme.italic ? theme.italic(thought) : thought;
}
