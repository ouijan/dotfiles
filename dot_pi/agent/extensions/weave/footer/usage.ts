import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface UsageTotals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	/** Cache hit rate (%) of the latest assistant message, if known. */
	cacheHitRate?: number;
}

interface UsageLike {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: { total: number };
}

function isUsageLike(value: unknown): value is UsageLike {
	if (!value || typeof value !== "object") return false;
	const usage = value as Record<string, unknown>;
	return typeof usage.input === "number" && typeof usage.output === "number";
}

function addUsage(totals: UsageTotals, usage: UsageLike): void {
	totals.input += usage.input;
	totals.output += usage.output;
	totals.cacheRead += usage.cacheRead ?? 0;
	totals.cacheWrite += usage.cacheWrite ?? 0;
	totals.cost += usage.cost?.total ?? 0;
}

function entryUsage(entry: Record<string, unknown>): UsageLike | undefined {
	if (entry.type === "message") {
		const message = entry.message as Record<string, unknown> | undefined;
		const role = message?.role;
		const isBillable = role === "assistant" || role === "toolResult";
		if (isBillable && isUsageLike(message?.usage)) return message?.usage as UsageLike;
		return;
	}
	const isSummary = entry.type === "branch_summary" || entry.type === "compaction";
	if (isSummary && isUsageLike(entry.usage)) return entry.usage as UsageLike;
}

function latestHitRate(entry: Record<string, unknown>, current?: number): number | undefined {
	if (entry.type !== "message") return current;
	const message = entry.message as Record<string, unknown> | undefined;
	if (message?.role !== "assistant" || !isUsageLike(message.usage)) return current;
	const usage = message.usage as UsageLike;
	const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
	if (promptTokens <= 0) return current;
	return (usage.cacheRead / promptTokens) * 100;
}

/** Cumulative token/cost totals across all session entries. */
export function computeUsageTotals(sessionManager: ExtensionContext["sessionManager"]): UsageTotals {
	const totals: UsageTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
	for (const entry of sessionManager.getEntries()) {
		const record = entry as unknown as Record<string, unknown>;
		const usage = entryUsage(record);
		if (usage) addUsage(totals, usage);
		totals.cacheHitRate = latestHitRate(record, totals.cacheHitRate);
	}
	return totals;
}
