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
 * Minimized, only the group leader renders — one line, `minimizedFormat` — and
 * every other row renders no lines at all (see tools/rows.ts). ctrl+o
 * (app.tools.expand) expands; `/weave tools` toggles.
 */

import { expandTemplate, fitToWidth, truncateText, visibleWidth } from "../lib/format.ts";

/** Re-render is deferred: invalidating another row mid-pass would reenter it. */
function defer(callback: () => void): void {
	setTimeout(callback, 0);
}

/** How a single call is getting on, which is what colours its name. */
export type CallState = "pending" | "ok" | "error";

/** Theme surface the counter line needs (subset of pi's Theme). */
export interface CounterTheme {
	fg(color: string, text: string): string;
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

export const DEFAULT_MINIMIZED_FORMAT = "🔧 {count} tool call{plural} {tools} {errors} {thinking}";

/**
 * The counter line, dimmed end to end. Coloured values re-open `dim` after
 * their own reset, so the base styling carries across them.
 */
export function minimizedLine(
	format: string,
	values: Record<string, string>,
	theme: CounterTheme,
	width: number,
): string {
	const withoutThinking = expandTemplate(format, { ...values, thinking: "" });
	const room = width - visibleWidth(withoutThinking) - 1;
	const thinking = styleThinking(theme, values.thinking, room);
	const body = expandTemplate(format, { ...values, thinking });
	// The counts alone can outgrow a narrow terminal, so clamp regardless.
	return `${theme.getFgAnsi("dim")}${fitToWidth(body, width)}\u001b[39m`;
}

/** Width of the `· ` marker that prefixes the thought inside `room`. */
const THINKING_PREFIX_WIDTH = 2;

/** The turn's thought, styled as thinking so it reads apart from the counts. */
function styleThinking(theme: CounterTheme, text: string, room: number): string {
	if (!text || room < 8) return "";
	const textRoom = room - THINKING_PREFIX_WIDTH;
	const thought = theme.fg("thinkingText", `· ${truncateText(text, textRoom, "head")}`);
	const styled = theme.italic ? theme.italic(thought) : thought;
	return `${styled}${theme.getFgAnsi("dim")}`;
}
