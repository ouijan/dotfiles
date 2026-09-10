/**
 * Project skill discovery for other harnesses' conventions.
 *
 * pi natively walks `.agents/skills` from cwd up to the git root, but nothing
 * else. Claude Code keeps skills in `.claude/skills`, so without this a repo
 * needs its own `.pi/settings.json` just to point at skills already sitting in
 * the tree. `resources_discover` supplies the paths instead — one place, every
 * repo.
 *
 * The walk mirrors pi's own: cwd first, then each ancestor, stopping at the git
 * root (or the filesystem root outside a repo). Directories are configured via
 * `weave.skills.dirs` as repo-relative paths.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { WeaveSkillsConfig } from "../config.ts";

/** cwd and its ancestors, nearest first, stopping once a `.git` entry is seen. */
function repoChain(cwd: string): string[] {
	const chain: string[] = [];
	let dir = resolve(cwd);

	while (!chain.includes(dir)) {
		chain.push(dir);
		if (existsSync(join(dir, ".git"))) break;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	return chain;
}

function findSkillDirs(cwd: string, relativeDirs: string[]): string[] {
	const candidates = repoChain(cwd).flatMap((dir) => relativeDirs.map((name) => join(dir, name)));
	return [...new Set(candidates.filter((path) => existsSync(path)))];
}

export function registerSkillDiscovery(pi: ExtensionAPI, config: WeaveSkillsConfig): void {
	if (!config.enabled || config.dirs.length === 0) return;

	pi.on("resources_discover", async (event) => ({
		skillPaths: findSkillDirs(event.cwd, config.dirs),
	}));
}
