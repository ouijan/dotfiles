import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { SegmentSettings, WeaveFooterConfig, WeaveFooterLine } from "../config.ts";
import { colorize, type EngineTheme } from "../lib/color.ts";
import type { AgentActivity } from "./activity.ts";
import type { McpStatus } from "./mcp.ts";
import {
	makeStatusSegment,
	SEGMENT_DEFAULTS,
	SEGMENTS,
	type Segment,
	type SegmentContext,
	type SegmentFooterData,
} from "./segments.ts";

const MIN_GAP = 2;

export type { EngineTheme };

function mergedSettings(name: string, config: WeaveFooterConfig): SegmentSettings {
	return { ...SEGMENT_DEFAULTS[name], ...config.segments[name] };
}

/** Extract the status key an instance consumes, from its name or settings. */
function statusKeyFor(name: string, config: WeaveFooterConfig): string | undefined {
	if (name.startsWith("status:")) return name.slice("status:".length);
	return config.segments[name]?.status ?? SEGMENT_DEFAULTS[name]?.status;
}

/** Resolve an instance name: `status:` sugar, then built-ins, then `status` declarations. */
function resolveSegment(name: string, config: WeaveFooterConfig): Segment | null {
	if (name.startsWith("status:")) return makeStatusSegment(name.slice("status:".length));
	const builtIn = SEGMENTS[name];
	if (builtIn) return builtIn;
	const statusKey = statusKeyFor(name, config);
	return statusKey ? makeStatusSegment(statusKey) : null;
}

function referencedNames(config: WeaveFooterConfig): string[] {
	return config.lines.flatMap((line) => [
		...(line.left ?? []),
		...(line.middle ?? []),
		...(line.right ?? []),
	]);
}

/** Status keys claimed by dedicated status segment instances (block or inline sugar). */
export function claimedStatusKeys(config: WeaveFooterConfig): Set<string> {
	const keys = referencedNames(config)
		.map((name) => statusKeyFor(name, config))
		.filter((key): key is string => typeof key === "string");
	return new Set(keys);
}

/**
 * Prefix a rendered segment with its configured `icon`. Applied by the engine
 * after the segment returns, so decoration never enters a segment's own
 * `maxWidth`/`format` budget.
 */
function withIcon(text: string, icon?: string): string {
	if (!icon) return text;
	return icon.endsWith(" ") ? `${icon}${text}` : `${icon} ${text}`;
}

/** Render one zone into styled per-segment strings (nulls dropped). */
function renderZone(
	names: string[] | undefined,
	sctx: SegmentContext,
	config: WeaveFooterConfig,
	theme: EngineTheme,
): string[] {
	const parts: string[] = [];
	for (const name of names ?? []) {
		const segment = resolveSegment(name, config);
		const settings = mergedSettings(name, config);
		const result = segment ? segment(sctx, settings) : null;
		if (!result || visibleWidth(result.text) === 0) continue;
		parts.push(colorize(theme, result.color, withIcon(result.text, settings.icon)));
	}
	return parts;
}

interface Zones {
	left: string[];
	middle: string[];
	right: string[];
}

function zoneWidth(parts: string[], separatorWidth: number): number {
	if (parts.length === 0) return 0;
	const textWidth = parts.reduce((total, part) => total + visibleWidth(part), 0);
	return textWidth + (parts.length - 1) * separatorWidth;
}

function neededWidth(zones: Zones, separatorWidth: number): number {
	const widths = [zones.left, zones.middle, zones.right]
		.map((parts) => zoneWidth(parts, separatorWidth))
		.filter((width) => width > 0);
	const gaps = Math.max(0, widths.length - 1) * MIN_GAP;
	return widths.reduce((total, width) => total + width, 0) + gaps;
}

/** Overflow rule: drop whole segments — right zone first, then middle, then left. */
function dropToFit(zones: Zones, separatorWidth: number, width: number): void {
	const order: (keyof Zones)[] = ["right", "middle", "left"];
	for (const zoneName of order) {
		const zone = zones[zoneName];
		while (zone.length > 0 && neededWidth(zones, separatorWidth) > width) zone.pop();
	}
}

function composeFitted(zones: Zones, separator: string, width: number): string {
	const left = zones.left.join(separator);
	const middle = zones.middle.join(separator);
	const right = zones.right.join(separator);
	const leftWidth = visibleWidth(left);
	const rightWidth = visibleWidth(right);
	if (!middle) {
		if (!right) return left;
		return left + " ".repeat(Math.max(MIN_GAP, width - leftWidth - rightWidth)) + right;
	}
	const middleWidth = visibleWidth(middle);
	const middleStart = Math.max(
		leftWidth + (left ? MIN_GAP : 0),
		Math.floor((width - middleWidth) / 2),
	);
	const padA = " ".repeat(middleStart - leftWidth);
	const padB = " ".repeat(Math.max(right ? MIN_GAP : 0, width - middleStart - middleWidth - rightWidth));
	return left + padA + middle + padB + right;
}

function composeLine(
	line: WeaveFooterLine,
	sctx: SegmentContext,
	config: WeaveFooterConfig,
	theme: EngineTheme,
	width: number,
): string | null {
	const separator = config.separator ? theme.fg("dim", ` ${config.separator} `) : " ";
	const separatorWidth = visibleWidth(separator);
	const zones: Zones = {
		left: renderZone(line.left, sctx, config, theme),
		middle: renderZone(line.middle, sctx, config, theme),
		right: renderZone(line.right, sctx, config, theme),
	};
	dropToFit(zones, separatorWidth, width);
	const isEmpty = zones.left.length + zones.middle.length + zones.right.length === 0;
	if (isEmpty) return null;
	// A single surviving oversized segment is the only case left that can overflow.
	return truncateToWidth(composeFitted(zones, separator, width), width, "...");
}

export interface FooterTui {
	requestRender(): void;
}

export interface FooterComponent {
	render(width: number): string[];
	invalidate(): void;
	dispose?(): void;
}

/** Names referenced in `lines` that have no registered segment. */
export function unknownSegmentNames(config: WeaveFooterConfig): string[] {
	return [...new Set(referencedNames(config).filter((name) => !resolveSegment(name, config)))];
}

/**
 * Build the setFooter factory for a session.
 * Layout is driven entirely by config lines/zones; segments come from SEGMENTS.
 */
const ANIMATION_INTERVAL_MS = 100;

/** Live state the segments read, owned by the extension across footer rebuilds. */
export interface FooterSources {
	activity: AgentActivity;
	mcp: McpStatus;
}

export function createFooterFactory(
	ctx: ExtensionContext,
	config: WeaveFooterConfig,
	sources: FooterSources,
	onFooterData?: (footerData: SegmentFooterData) => void,
) {
	return (
		tui: FooterTui,
		theme: EngineTheme,
		footerData: SegmentFooterData & { onBranchChange(cb: () => void): () => void },
	): FooterComponent => {
		const { activity, mcp } = sources;
		onFooterData?.(footerData);
		const unsubscribeBranch = footerData.onBranchChange(() => tui.requestRender());
		const unsubscribeMcp = mcp.subscribe(() => tui.requestRender());
		const sctx: SegmentContext = {
			ctx,
			footerData,
			claimedStatusKeys: claimedStatusKeys(config),
			activity,
			mcp,
		};
		const animated = referencedNames(config).includes("llm");
		let timer: ReturnType<typeof setInterval> | undefined;
		const syncAnimation = (): void => {
			tui.requestRender();
			const shouldAnimate = animated && activity.working;
			if (shouldAnimate && !timer) timer = setInterval(() => tui.requestRender(), ANIMATION_INTERVAL_MS);
			if (!shouldAnimate && timer) {
				clearInterval(timer);
				timer = undefined;
			}
		};
		const unsubscribeActivity = activity.subscribe(syncAnimation);
		syncAnimation();
		return {
			dispose: () => {
				if (timer) clearInterval(timer);
				unsubscribeActivity();
				unsubscribeBranch();
				unsubscribeMcp();
			},
			invalidate() {},
			render(width: number): string[] {
				const lines: string[] = [];
				for (const line of config.lines) {
					const rendered = composeLine(line, sctx, config, theme, width);
					if (rendered !== null) lines.push(rendered);
				}
				return lines;
			},
		};
	};
}
