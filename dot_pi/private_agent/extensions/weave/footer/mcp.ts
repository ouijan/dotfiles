/**
 * mcp segment — server counts from pi's built-in MCP support, composed through
 * a `format` template.
 *
 * The built-in publishes no status, so the counts are derived: enabled and
 * disabled from the `mcp.json` files it reads, connected and tools from the
 * `mcp__<server>` tool namespaces it registers once a server connects. Tools
 * are never unregistered, so a server that drops after connecting still
 * counts as connected. The snapshot is polled and only re-renders on change.
 * When no servers are configured, the segment hides.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { agentDir } from "../config.ts";
import { expandTemplate } from "../lib/format.ts";
import type { Segment } from "./segments.ts";

const DEFAULT_FORMAT = "🔌 {enabled} enabled";
const POLL_INTERVAL_MS = 2000;
const MCP_NAMESPACE_PREFIX = "mcp__";

interface McpSnapshot {
	enabled: number;
	disabled: number;
	connected: number;
	tools: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readServerEntries(path: string): Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
		const servers = isRecord(parsed) ? parsed.mcpServers : undefined;
		return isRecord(servers) ? servers : {};
	} catch {
		return {};
	}
}

/** A project entry without a transport only overrides the global entry's flags. */
function isFullEntry(entry: Record<string, unknown>): boolean {
	return "command" in entry || "url" in entry || "type" in entry;
}

function entryEnabled(entry: unknown, inherited: boolean): boolean {
	if (!isRecord(entry)) return inherited;
	if (typeof entry.enabled === "boolean") return entry.enabled;
	return isFullEntry(entry) ? true : inherited;
}

function mergeEntries(states: Map<string, boolean>, entries: Record<string, unknown>): void {
	for (const [name, entry] of Object.entries(entries)) {
		states.set(name, entryEnabled(entry, states.get(name) ?? true));
	}
}

/** Enabled state per server, merged the way pi merges global and project `mcp.json`. */
function configuredServers(cwd: string, projectTrusted: boolean): boolean[] {
	const states = new Map<string, boolean>();
	mergeEntries(states, readServerEntries(join(agentDir(), "mcp.json")));
	if (projectTrusted) mergeEntries(states, readServerEntries(join(cwd, ".pi", "mcp.json")));
	return [...states.values()];
}

function mcpNamespace(tool: unknown): string | undefined {
	if (!isRecord(tool) || tool.exposure === "hidden") return;
	const namespace = tool.namespace;
	if (!isRecord(namespace) || typeof namespace.name !== "string") return;
	return namespace.name.startsWith(MCP_NAMESPACE_PREFIX) ? namespace.name : undefined;
}

export function readMcpSnapshot(pi: ExtensionAPI, ctx: ExtensionContext): McpSnapshot {
	const states = configuredServers(ctx.cwd, ctx.isProjectTrusted());
	const enabled = states.filter(Boolean).length;
	const namespaces = pi
		.getAllTools()
		.map(mcpNamespace)
		.filter((name): name is string => name !== undefined);
	return {
		enabled,
		disabled: states.length - enabled,
		connected: new Set(namespaces).size,
		tools: namespaces.length,
	};
}

function sameSnapshot(previous: McpSnapshot, next: McpSnapshot): boolean {
	return (
		previous.enabled === next.enabled &&
		previous.disabled === next.disabled &&
		previous.connected === next.connected &&
		previous.tools === next.tools
	);
}

/** Latest MCP snapshot, polled while a session is live. */
export class McpStatus {
	snapshot?: McpSnapshot;
	private listeners = new Set<() => void>();
	private timer?: ReturnType<typeof setInterval>;

	track(read: () => McpSnapshot): void {
		this.stop();
		const poll = (): void => this.update(read());
		poll();
		this.timer = setInterval(poll, POLL_INTERVAL_MS);
		this.timer.unref?.();
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private update(next: McpSnapshot): void {
		if (this.snapshot && sameSnapshot(this.snapshot, next)) return;
		this.snapshot = next;
		for (const listener of this.listeners) listener();
	}
}

function templateValues(snapshot: McpSnapshot): Record<string, string> {
	return {
		total: String(snapshot.enabled + snapshot.disabled),
		enabled: String(snapshot.enabled),
		connected: String(snapshot.connected),
		disabled: String(snapshot.disabled),
		tools: String(snapshot.tools),
	};
}

export const mcp: Segment = ({ mcp: status }, settings) => {
	const snapshot = status.snapshot;
	if (!snapshot || snapshot.enabled + snapshot.disabled === 0) return null;
	const text = expandTemplate(settings.format ?? DEFAULT_FORMAT, templateValues(snapshot));
	return text.length > 0 ? { text, color: settings.color } : null;
};
