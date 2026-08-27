import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { TruncateMode } from "./lib/format.ts";

export interface WeaveFooterLine {
	left?: string[];
	middle?: string[];
	right?: string[];
}

/** Per-segment instance settings. Color values are pi theme tokens or #rrggbb. */
export interface SegmentSettings {
	color?: string;
	/**
	 * Literal prefix rendered before the segment (any segment). A trailing space
	 * is added unless the icon already ends in one. Applied by the engine, so it
	 * sits outside `maxWidth` and never needs a `format` template.
	 */
	icon?: string;
	warnColor?: string;
	errorColor?: string;
	/** Show a single extension status by its setStatus key (see /weave statuses). */
	status?: string;
	/** llm segment: spinner frames, frame interval, elapsed-time display. */
	frames?: string[];
	intervalMs?: number;
	showElapsed?: boolean;
	/**
	 * Output template. context: `{used}`, `{window}`, `{remaining}`, `{percent}`
	 * (each accepts `:decimals`). hindsight: `{bank}`, `{status}`.
	 */
	format?: string;
	/** context segment: token unit casing — "165.5K" vs "165.5k". */
	unitCase?: "upper" | "lower";
	/** cwd/git segments: cap rendered text at this many characters (0/unset = off). */
	maxWidth?: number;
	/** cwd/git segments: which end survives truncation. Default "tail". */
	truncate?: TruncateMode;
}

export interface WeaveFooterConfig {
	enabled: boolean;
	/** Single character rendered (space-padded) between segments in a zone. */
	separator: string;
	lines: WeaveFooterLine[];
	segments: Record<string, SegmentSettings>;
}

export interface WeaveToolsConfig {
	/** Group each turn's tool calls. Off leaves pi's tools completely alone. */
	enabled: boolean;
	/** Collapse each turn's tool calls to one counter line (ctrl+o expands). */
	minimize: boolean;
	/** Counter template: `{count}` `{plural}` `{tools}` `{errors}` `{last}` `{thinking}`. */
	minimizedFormat?: string;
	/** Fold the turn's thinking into the counter line instead of pi's label. */
	thinking: boolean;
	/** Characters of thinking kept on the counter line. */
	thinkingWidth: number;
	/** Tools that always render as pi draws them, never folded into a group. */
	exclude: string[];
}

export interface WeaveRosterConfig {
	/** List the delegatable agents under the startup header. */
	enabled: boolean;
}

export interface WeaveSkillsConfig {
	/** Offer project skill directories to pi's `resources_discover`. */
	enabled: boolean;
	/** Repo-relative skill directories, searched from cwd up to the git root. */
	dirs: string[];
}

export interface WeaveConfig {
	footer: WeaveFooterConfig;
	tools: WeaveToolsConfig;
	roster: WeaveRosterConfig;
	skills: WeaveSkillsConfig;
	/** pi's own setting: thinking is already collapsed to a single label. */
	hideThinkingBlock: boolean;
}

/** Mirrors the built-in pi footer placement. */
const DEFAULT_FOOTER: WeaveFooterConfig = {
	enabled: true,
	separator: "·",
	lines: [
		{ left: ["cwd", "git", "session"] },
		{ left: ["tokens", "cost", "context"], right: ["model", "thinking"] },
		{ left: ["statuses"] },
	],
	segments: {},
};

const DEFAULT_TOOLS: WeaveToolsConfig = {
	enabled: true,
	minimize: true,
	thinking: true,
	thinkingWidth: 72,
	// Grouping is by row component, so it reaches every tool: nothing to opt in.
	exclude: [],
};

const DEFAULT_ROSTER: WeaveRosterConfig = { enabled: true };

/** pi already handles `.agents/skills`; these are the harnesses it does not. */
const DEFAULT_SKILLS: WeaveSkillsConfig = {
	enabled: true,
	dirs: [".claude/skills"],
};

function agentDir(): string {
	return process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
}

function readSettings(): Record<string, unknown> {
	try {
		const raw = readFileSync(join(agentDir(), "settings.json"), "utf8");
		const parsed: unknown = JSON.parse(raw);
		if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
	} catch {
		// Missing or invalid settings file: fall through to defaults.
	}
	return {};
}

function asStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return;
	return value.filter((item): item is string => typeof item === "string");
}

function asOptionalString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function parseLine(value: unknown): WeaveFooterLine {
	if (!value || typeof value !== "object") return {};
	const raw = value as Record<string, unknown>;
	return {
		left: asStringArray(raw.left),
		middle: asStringArray(raw.middle),
		right: asStringArray(raw.right),
	};
}

function asTruncateMode(value: unknown): TruncateMode | undefined {
	const modes = ["tail", "head", "shorten"];
	return typeof value === "string" && modes.includes(value) ? (value as TruncateMode) : undefined;
}

function parseSegmentSettings(value: unknown): SegmentSettings {
	if (!value || typeof value !== "object") return {};
	const raw = value as Record<string, unknown>;
	return {
		color: asOptionalString(raw.color),
		icon: asOptionalString(raw.icon),
		warnColor: asOptionalString(raw.warnColor),
		errorColor: asOptionalString(raw.errorColor),
		status: asOptionalString(raw.status),
		frames: asStringArray(raw.frames),
		intervalMs: typeof raw.intervalMs === "number" ? raw.intervalMs : undefined,
		showElapsed: typeof raw.showElapsed === "boolean" ? raw.showElapsed : undefined,
		format: asOptionalString(raw.format),
		unitCase: raw.unitCase === "upper" || raw.unitCase === "lower" ? raw.unitCase : undefined,
		maxWidth: typeof raw.maxWidth === "number" ? raw.maxWidth : undefined,
		truncate: asTruncateMode(raw.truncate),
	};
}

function parseSegments(value: unknown): Record<string, SegmentSettings> {
	if (!value || typeof value !== "object") return {};
	const entries = Object.entries(value as Record<string, unknown>);
	return Object.fromEntries(entries.map(([name, raw]) => [name, parseSegmentSettings(raw)]));
}

function parseFooter(value: unknown): WeaveFooterConfig {
	if (!value || typeof value !== "object") return DEFAULT_FOOTER;
	const raw = value as Record<string, unknown>;
	return {
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_FOOTER.enabled,
		separator: typeof raw.separator === "string" ? raw.separator : DEFAULT_FOOTER.separator,
		lines: Array.isArray(raw.lines) ? raw.lines.map(parseLine) : DEFAULT_FOOTER.lines,
		segments: parseSegments(raw.segments),
	};
}

function parseTools(value: unknown): WeaveToolsConfig {
	if (!value || typeof value !== "object") return DEFAULT_TOOLS;
	const raw = value as Record<string, unknown>;
	return {
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_TOOLS.enabled,
		minimize: typeof raw.minimize === "boolean" ? raw.minimize : DEFAULT_TOOLS.minimize,
		minimizedFormat: asOptionalString(raw.minimizedFormat),
		thinking: typeof raw.thinking === "boolean" ? raw.thinking : DEFAULT_TOOLS.thinking,
		thinkingWidth: typeof raw.thinkingWidth === "number" ? raw.thinkingWidth : DEFAULT_TOOLS.thinkingWidth,
		exclude: asStringArray(raw.exclude) ?? DEFAULT_TOOLS.exclude,
	};
}

function parseRoster(value: unknown): WeaveRosterConfig {
	if (!value || typeof value !== "object") return DEFAULT_ROSTER;
	const raw = value as Record<string, unknown>;
	return { enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_ROSTER.enabled };
}

function parseSkills(value: unknown): WeaveSkillsConfig {
	if (!value || typeof value !== "object") return DEFAULT_SKILLS;
	const raw = value as Record<string, unknown>;
	return {
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_SKILLS.enabled,
		dirs: asStringArray(raw.dirs) ?? DEFAULT_SKILLS.dirs,
	};
}

/** Load the `weave` block from ~/.pi/agent/settings.json, with defaults. */
export function loadWeaveConfig(): WeaveConfig {
	const settings = readSettings();
	const weave =
		settings.weave && typeof settings.weave === "object"
			? (settings.weave as Record<string, unknown>)
			: {};
	return {
		footer: parseFooter(weave.footer),
		tools: parseTools(weave.tools),
		roster: parseRoster(weave.roster),
		skills: parseSkills(weave.skills),
		hideThinkingBlock: settings.hideThinkingBlock === true,
	};
}
