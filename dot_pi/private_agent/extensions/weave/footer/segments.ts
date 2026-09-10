import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SegmentSettings } from "../config.ts";
import type { AgentActivity } from "./activity.ts";
import {
	expandTemplate,
	formatCwd,
	formatTokens,
	formatTokensAt,
	sanitizeStatusText,
	stripAnsi,
	truncateText,
} from "../lib/format.ts";
import { hindsight } from "./hindsight.ts";
import { mcp, type McpStatus } from "./mcp.ts";
import { computeUsageTotals } from "./usage.ts";

/** Footer data surface the segments need (subset of ReadonlyFooterDataProvider). */
export interface SegmentFooterData {
	getGitBranch(): string | null;
	getExtensionStatuses(): ReadonlyMap<string, string>;
	getAvailableProviderCount(): number;
}

/** Subset of pi's ContextUsage the context segment reads. */
export interface ContextUsageLike {
	tokens: number | null;
	contextWindow: number;
	percent: number | null;
}

export interface SegmentContext {
	ctx: ExtensionContext;
	footerData: SegmentFooterData;
	/** Status keys claimed by dedicated `status` segment instances. */
	claimedStatusKeys: ReadonlySet<string>;
	/** Live agent streaming state (fed by agent_start/agent_end). */
	activity: Pick<AgentActivity, "working" | "startedAt">;
	/** Latest MCP snapshot (fed by the shared event bus). */
	mcp: Pick<McpStatus, "snapshot">;
}

/**
 * Segment result: plain text plus a color reference (pi theme token or #rrggbb).
 * The engine resolves color and applies separators; segments never emit ANSI.
 * `color: undefined` means the text is already styled (statuses passthrough).
 */
export interface SegmentResult {
	text: string;
	color?: string;
}

export type Segment = (sctx: SegmentContext, settings: SegmentSettings) => SegmentResult | null;

/** Built-in defaults, merged under user `segments` config. */
export const SEGMENT_DEFAULTS: Record<string, SegmentSettings> = {
	cwd: { color: "dim", truncate: "tail" },
	git: { color: "dim", truncate: "tail", format: "({branch})" },
	session: { color: "dim" },
	tokens: { color: "dim" },
	cost: { color: "dim" },
	context: {
		color: "dim",
		warnColor: "warning",
		errorColor: "error",
		format: "{percent:1}%/{window:0}",
		unitCase: "lower",
	},
	model: { color: "dim" },
	thinking: { color: "dim" },
	statuses: {},
	hindsight: { color: "dim", status: "hindsight", format: "󰍛 {bank} {status}" },
	// `status` is unused by the mcp segment itself; it claims the adapter's key
	// so the `statuses` catch-all does not render the same info twice.
	mcp: { color: "dim", status: "mcp", format: "🔌 {enabled} enabled" },
	llm: {
		color: "accent",
		frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
		intervalMs: 100,
		showElapsed: true,
	},
};

const CONTEXT_WARN_PERCENT = 70;
const CONTEXT_ERROR_PERCENT = 90;

const cwd: Segment = ({ ctx }, settings) => {
	const home = process.env.HOME || process.env.USERPROFILE;
	const path = formatCwd(ctx.sessionManager.getCwd(), home);
	return {
		text: truncateText(path, settings.maxWidth, settings.truncate),
		color: settings.color,
	};
};

const git: Segment = ({ footerData }, settings) => {
	const branch = footerData.getGitBranch();
	if (!branch) return null;
	const trimmed = truncateText(branch, settings.maxWidth, settings.truncate);
	const text = expandTemplate(settings.format ?? "({branch})", { branch: trimmed });
	return { text, color: settings.color };
};

const session: Segment = ({ ctx }, settings) => {
	const name = ctx.sessionManager.getSessionName();
	return name ? { text: name, color: settings.color } : null;
};

const tokens: Segment = ({ ctx }, settings) => {
	const totals = computeUsageTotals(ctx.sessionManager);
	const parts: string[] = [];
	if (totals.input) parts.push(`↑${formatTokens(totals.input)}`);
	if (totals.output) parts.push(`↓${formatTokens(totals.output)}`);
	if (totals.cacheRead) parts.push(`R${formatTokens(totals.cacheRead)}`);
	if (totals.cacheWrite) parts.push(`W${formatTokens(totals.cacheWrite)}`);
	const hasCacheActivity = totals.cacheRead > 0 || totals.cacheWrite > 0;
	if (hasCacheActivity && totals.cacheHitRate !== undefined) {
		parts.push(`CH${totals.cacheHitRate.toFixed(1)}%`);
	}
	return parts.length > 0 ? { text: parts.join(" "), color: settings.color } : null;
};

const cost: Segment = ({ ctx }, settings) => {
	const totals = computeUsageTotals(ctx.sessionManager);
	return totals.cost > 0 ? { text: `$${totals.cost.toFixed(3)}`, color: settings.color } : null;
};

function contextColor(percent: number | null, settings: SegmentSettings): string | undefined {
	if (percent !== null && percent > CONTEXT_ERROR_PERCENT) return settings.errorColor;
	if (percent !== null && percent > CONTEXT_WARN_PERCENT) return settings.warnColor;
	return settings.color;
}

const PLACEHOLDER = /\{(\w+)(?::(\d+))?\}/g;

interface ContextValues {
	used: number | null;
	window: number;
	remaining: number | null;
	percent: number | null;
}

function contextValues(usage: ContextUsageLike | undefined, contextWindow: number): ContextValues {
	const used = usage?.tokens ?? null;
	return {
		used,
		window: contextWindow,
		remaining: used === null ? null : Math.max(0, contextWindow - used),
		percent: usage?.percent ?? null,
	};
}

/**
 * Expand `{name}` / `{name:decimals}` against context values. Token counts are
 * abbreviated (165.5K), percent is a plain number, `*Raw` names are unformatted.
 * Unknown names are left in place so typos are visible in the footer.
 */
function expandContextFormat(format: string, values: ContextValues, settings: SegmentSettings): string {
	const unitCase = settings.unitCase === "upper" ? "upper" : "lower";
	return format.replace(PLACEHOLDER, (match, name: string, precision?: string) => {
		const decimals = precision === undefined ? 1 : Number(precision);
		const raw = name.endsWith("Raw");
		const value = values[(raw ? name.slice(0, -"Raw".length) : name) as keyof ContextValues];
		if (value === undefined) return match;
		if (value === null) return "?";
		if (raw || name === "percent") return value.toFixed(decimals);
		return formatTokensAt(value, decimals, unitCase);
	});
}

const context: Segment = ({ ctx }, settings) => {
	const usage = ctx.getContextUsage();
	const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
	if (contextWindow === 0) return null;
	const values = contextValues(usage, contextWindow);
	const format = settings.format ?? SEGMENT_DEFAULTS.context?.format ?? "{percent:1}%/{window:0}";
	return {
		text: expandContextFormat(format, values, settings),
		color: contextColor(values.percent, settings),
	};
};

const model: Segment = ({ ctx, footerData }, settings) => {
	if (!ctx.model) return { text: "no-model", color: settings.color };
	const showProvider = footerData.getAvailableProviderCount() > 1;
	const prefix = showProvider ? `(${ctx.model.provider}) ` : "";
	return { text: `${prefix}${ctx.model.id}`, color: settings.color };
};

const thinking: Segment = ({ ctx }, settings) => {
	if (!ctx.model?.reasoning) return null;
	const level = ctx.thinkingLevel || "off";
	const label = level === "off" ? "thinking off" : level;
	return { text: label, color: settings.color };
};

function formatElapsed(startedAt: number): string {
	const totalSeconds = Math.floor((Date.now() - startedAt) / 1000);
	if (totalSeconds < 60) return `${totalSeconds}s`;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}m${String(seconds).padStart(2, "0")}s`;
}

/** Animated spinner while the agent is streaming; hidden when idle. */
const llm: Segment = ({ activity }, settings) => {
	if (!activity.working || activity.startedAt === undefined) return null;
	const frames = settings.frames ?? ["●"];
	const intervalMs = settings.intervalMs ?? 100;
	const frameIndex = Math.floor((Date.now() - activity.startedAt) / intervalMs) % frames.length;
	const spinner = frames[frameIndex] ?? "●";
	const elapsed = settings.showElapsed ? ` ${formatElapsed(activity.startedAt)}` : "";
	return { text: `${spinner}${elapsed}`, color: settings.color };
};

const statuses: Segment = ({ footerData, claimedStatusKeys }) => {
	const extensionStatuses = footerData.getExtensionStatuses();
	if (extensionStatuses.size === 0) return null;
	const texts = Array.from(extensionStatuses.entries())
		.filter(([key]) => !claimedStatusKeys.has(key))
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, text]) => sanitizeStatusText(text))
		.filter((text) => text.length > 0);
	if (texts.length === 0) return null;
	return { text: texts.join(" ") }; // already styled by owning extensions
};

/**
 * Build a segment showing one extension status by key (declared via `status` config).
 * When a color is configured, pre-baked ANSI styling is stripped so the
 * configured color actually wins; without one, the original styling passes through.
 */
export function makeStatusSegment(key: string): Segment {
	return ({ footerData }, settings) => {
		const text = footerData.getExtensionStatuses().get(key);
		if (!text) return null;
		const sanitized = sanitizeStatusText(settings.color ? stripAnsi(text) : text);
		if (sanitized.length === 0) return null;
		return { text: sanitized, color: settings.color };
	};
}

export const SEGMENTS: Record<string, Segment> = {
	cwd,
	git,
	session,
	tokens,
	cost,
	context,
	model,
	thinking,
	statuses,
	hindsight,
	mcp,
	llm,
};
