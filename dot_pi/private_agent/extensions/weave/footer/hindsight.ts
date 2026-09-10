/**
 * hindsight segment — the `status:hindsight` passthrough, composed through a
 * `format` template so any icon, label, or spacing is config rather than code.
 *
 * The bank id is not published in the status text (hindsight only includes it
 * for some `status.detail` settings), so it is resolved the same way hindsight
 * itself does: env override, then project config, then the global config.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SegmentSettings } from "../config.ts";
import { expandTemplate, sanitizeStatusText, stripAnsi } from "../lib/format.ts";
import type { Segment } from "./segments.ts";

const DEFAULT_STATUS_KEY = "hindsight";
const DEFAULT_FORMAT = "󰍛 {bank} {status}";

function agentDir(): string {
	return process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
}

function configPaths(cwd: string): string[] {
	return [
		join(cwd, ".pi", "hindsight.json"),
		join(cwd, ".pi", "hindsight.jsonc"),
		join(agentDir(), "hindsight.json"),
		join(agentDir(), "hindsight.jsonc"),
	];
}

function readProjectBankId(path: string): string | undefined {
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
		const banks = (parsed as { banks?: { project?: { bankId?: unknown } } }).banks;
		const bankId = banks?.project?.bankId;
		return typeof bankId === "string" && bankId.trim() ? bankId.trim() : undefined;
	} catch {
		return undefined;
	}
}

/** Per-cwd lookup cache; discarded with the module on /reload. */
const bankCache = new Map<string, string>();

/** Active hindsight project bank for `cwd`, or undefined when unconfigured. */
function activeBank(cwd: string): string | undefined {
	const fromEnv = process.env.PI_HINDSIGHT_PROJECT_BANK_ID?.trim();
	if (fromEnv) return fromEnv;
	const cached = bankCache.get(cwd);
	if (cached) return cached;
	for (const path of configPaths(cwd)) {
		const bankId = readProjectBankId(path);
		if (bankId) {
			bankCache.set(cwd, bankId);
			return bankId;
		}
	}
	return undefined;
}

export const hindsight: Segment = ({ ctx, footerData }, settings) => {
	const statusKey = settings.status ?? DEFAULT_STATUS_KEY;
	const status = footerData.getExtensionStatuses().get(statusKey);
	if (!status) return null;
	const body = sanitizeStatusText(settings.color ? stripAnsi(status) : status);
	const format = settings.format ?? DEFAULT_FORMAT;
	const wantsBank = format.includes("{bank}");
	const text = expandTemplate(format, {
		bank: wantsBank ? activeBank(ctx.sessionManager.getCwd()) : undefined,
		status: body,
	});
	return text.length > 0 ? { text, color: settings.color } : null;
};
