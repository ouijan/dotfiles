import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Dynamically discovers skills from Claude Code (.claude/skills/)
 * and opencode (.agents/skills/) directories in the current project.
 *
 * This avoids needing a .pi/settings.json in every repo.
 */
export default function (pi: ExtensionAPI) {
  pi.on("resources_discover", async (event, _ctx) => {
    const cwd = event.cwd;
    const skillPaths: string[] = [];

    // Claude Code convention: .claude/skills/
    const claudeSkills = resolve(cwd, ".claude/skills");
    if (existsSync(claudeSkills)) {
      skillPaths.push(claudeSkills);
    }

    // Also check parent directories for monorepos
    // (walk up to git root or filesystem root)
    let dir = cwd;
    const parts = dir.split("/");
    for (let i = parts.length - 1; i > 0; i--) {
      const parent = parts.slice(0, i).join("/");
      const parentSkills = resolve(parent, ".claude/skills");
      if (parentSkills !== claudeSkills && existsSync(parentSkills)) {
        skillPaths.push(parentSkills);
      }
      // Stop at git root
      if (existsSync(resolve(parent, ".git"))) {
        break;
      }
    }

    return { skillPaths };
  });
}
