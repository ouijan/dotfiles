import { isAbsolute, relative, resolve, sep } from "node:path";
import {
	sliceByColumn,
	stripTerminalSequences,
	truncateToWidth,
	visibleWidth as terminalWidth,
} from "@earendil-works/pi-tui";

/** Format token counts for compact footer display (1.2k, 45M). */
export function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

/** Format a token count with fixed precision, e.g. 165_512 → "165.5K". */
export function formatTokensAt(count: number, decimals: number, unitCase: "upper" | "lower"): string {
	const [thousand, million] = unitCase === "upper" ? ["K", "M"] : ["k", "M"];
	if (count < 1000) return count.toFixed(0);
	if (count < 1000000) return `${(count / 1000).toFixed(decimals)}${thousand}`;
	return `${(count / 1000000).toFixed(decimals)}${million}`;
}

/** How over-long text is shortened to fit `maxWidth`. */
export type TruncateMode = "tail" | "head" | "shorten";

const ELLIPSIS = "…";

/** Replace the home directory prefix with ~. */
export function formatCwd(cwd: string, home?: string): string {
	if (!home) return cwd;
	const relativeToHome = relative(resolve(home), resolve(cwd));
	const escapesHome =
		relativeToHome === ".." || relativeToHome.startsWith(`..${sep}`) || isAbsolute(relativeToHome);
	if (escapesHome) return cwd;
	return relativeToHome === "" ? "~" : `~${sep}${relativeToHome}`;
}

/**
 * Keep the last `maxWidth` terminal columns. `strict` drops a wide grapheme
 * straddling the boundary rather than letting it spill a cell over budget.
 */
function keepTail(text: string, maxWidth: number): string {
	const start = Math.max(0, visibleWidth(text) - maxWidth);
	return sliceByColumn(text, start, maxWidth, true);
}

/** Abbreviate leading `/`-delimited segments to their first character: ~/c/g/p/repo. */
function shortenLeadingSegments(text: string, maxWidth: number): string {
	const segments = text.split(sep);
	const lastIndex = segments.length - 1;
	for (let index = 0; index < lastIndex; index++) {
		const segment = segments[index];
		const abbreviated = segment.startsWith(".") ? segment.slice(0, 2) : segment.slice(0, 1);
		segments[index] = abbreviated;
		const candidate = segments.join(sep);
		if (visibleWidth(candidate) <= maxWidth) return candidate;
	}
	return segments.join(sep);
}

/**
 * Trim display text (a path or a branch name) to `maxWidth` terminal columns.
 * `tail` keeps the end (the part that identifies the project or ticket), `head`
 * keeps the start, `shorten` abbreviates leading `/` segments first and falls
 * back to `tail`. The result never exceeds `maxWidth` cells, so callers can
 * budget against the terminal width without overflowing it.
 */
export function truncateText(text: string, maxWidth?: number, mode: TruncateMode = "tail"): string {
	if (!maxWidth || maxWidth <= 0 || visibleWidth(text) <= maxWidth) return text;
	const ellipsisWidth = visibleWidth(ELLIPSIS);
	if (maxWidth <= ellipsisWidth) return keepTail(text, maxWidth);
	const shortened = mode === "shorten" ? shortenLeadingSegments(text, maxWidth) : text;
	if (visibleWidth(shortened) <= maxWidth) return shortened;
	if (mode === "head") return truncateToWidth(shortened, maxWidth, ELLIPSIS);
	return `${ELLIPSIS}${keepTail(shortened, maxWidth - ellipsisWidth)}`;
}

/**
 * Expand `{name}` placeholders from a string map. Missing/empty values collapse
 * with the whitespace around them; unknown names are left in place so typos show.
 */
export function expandTemplate(format: string, values: Record<string, string | undefined>): string {
	const expanded = format.replace(/\{(\w+)\}/g, (match, name: string) => {
		if (!(name in values)) return match;
		return values[name] ?? "";
	});
	return expanded.replace(/\s+/g, " ").trim();
}

/**
 * Clamp a pre-styled line to `maxWidth` terminal columns, keeping the escapes
 * inside it intact. The last line of defence: pi crashes the whole TUI if a
 * component ever renders wider than the terminal.
 */
export function fitToWidth(text: string, maxWidth: number): string {
	if (maxWidth <= 0) return "";
	if (visibleWidth(text) <= maxWidth) return text;
	return truncateToWidth(text, maxWidth, ELLIPSIS);
}

/** Strip ANSI/OSC/APC sequences (used when weave overrides pre-styled text). */
export function stripAnsi(text: string): string {
	return stripTerminalSequences(text);
}

/**
 * Width of pre-styled text in terminal columns. Delegates to pi-tui so weave
 * measures exactly what the renderer measures: escapes are free, wide CJK and
 * emoji cost two cells, and combining marks cost nothing. Measuring in UTF-16
 * code units instead is what let the tool-counter line overflow and crash pi.
 */
export function visibleWidth(text: string): number {
	return terminalWidth(text);
}

/** True when rendered lines carry no visible content. */
export function isBlank(lines: string[]): boolean {
	return lines.every((line) => line.trim() === "");
}

/** Strip newlines/tabs/control chars so text stays on one footer line. */
export function sanitizeStatusText(text: string): string {
	return text
		.replace(/[\r\n\t]/g, " ")
		.replace(/ +/g, " ")
		.trim();
}
