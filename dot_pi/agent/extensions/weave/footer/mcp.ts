/**
 * mcp segment — server counts from pi-mcp-adapter, composed through a `format`
 * template.
 *
 * The adapter's own footer text ("5 servers enabled (2 connected)") is prose,
 * so instead of parsing it this reads the structured snapshot the adapter
 * publishes on the shared event bus (channel `pi-mcp-adapter/status/v1`).
 * When the adapter is absent or has no servers configured, the segment hides.
 */

import { expandTemplate } from "../lib/format.ts";
import type { Segment } from "./segments.ts";

export const MCP_STATUS_EVENT = "pi-mcp-adapter/status/v1";

const DEFAULT_FORMAT = "🔌 {enabled} enabled";

interface McpServerSnapshot {
	status: string;
	disabled: boolean;
}

interface McpSnapshot {
	servers: McpServerSnapshot[];
	totalTools: number;
	totalResources: number;
	connectedCount: number;
	disabledCount: number;
}

function isMcpSnapshot(value: unknown): value is McpSnapshot {
	if (!value || typeof value !== "object") return false;
	const snapshot = value as Record<string, unknown>;
	return Array.isArray(snapshot.servers) && typeof snapshot.connectedCount === "number";
}

/** Latest MCP snapshot, fed by the shared event bus. */
export class McpStatus {
	snapshot?: McpSnapshot;
	private listeners = new Set<() => void>();

	/** Accepts raw event-bus payloads; unrecognised shapes are ignored. */
	update(value: unknown): void {
		if (!isMcpSnapshot(value)) return;
		this.snapshot = value;
		for (const listener of this.listeners) listener();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

function countByStatus(servers: McpServerSnapshot[], status: string): number {
	return servers.filter((server) => server.status === status).length;
}

function templateValues(snapshot: McpSnapshot): Record<string, string> {
	const total = snapshot.servers.length;
	return {
		total: String(total),
		enabled: String(total - snapshot.disabledCount),
		connected: String(snapshot.connectedCount),
		disabled: String(snapshot.disabledCount),
		failed: String(countByStatus(snapshot.servers, "failed")),
		needsAuth: String(countByStatus(snapshot.servers, "needs-auth")),
		tools: String(snapshot.totalTools),
		resources: String(snapshot.totalResources),
	};
}

export const mcp: Segment = ({ mcp: status }, settings) => {
	const snapshot = status.snapshot;
	if (!snapshot || snapshot.servers.length === 0) return null;
	const text = expandTemplate(settings.format ?? DEFAULT_FORMAT, templateValues(snapshot));
	return text.length > 0 ? { text, color: settings.color } : null;
};
