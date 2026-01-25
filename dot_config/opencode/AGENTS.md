# Agent Instructions

## Session Journaling

Use the `jrnl` skill to record your work. Always include `@agent` and `@repo/owner/name` tags.

- **AFTER MAKING A DECISION YOU MUST** - Log decisions, blockers, and significant progress: `jrnl "Decision: chose X over Y. Rationale. @agent @repo/${repo} @decision"`
- **BEFORE EXISTING YOU MUST** - Summarize what was done and next steps: `jrnl "Session summary: accomplished X, Y. Next: Z. @agent @repo/${repo} @session-end"`

## Rules

- Never commit/push to main directly
- Never run destructive commands without approval
- Never commit secrets
- Ask before expanding scope
- Keep changes in working tree; don't commit at intervals

## Code Style

- Max 3 nesting levels
- Self-documenting names
- Small, focused functions
- Intermediate variables for complex expressions
