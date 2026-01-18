# Agent Instructions

## 🤖 Memory Protocol

1. **Sync:** Read `memory.md` first. It is the single source of truth.
2. **Log:** Update the **Current State** and **Decision Log** in `memory.md` after every significant change.
3. **Prune:** Keep descriptions atomic. Use key-value pairs or bullets. No prose.
4. **Handoff:** Before exit, record the exact technical blocker or next line of code to write.

[Template Ref](./memory-template.md)

## Rules

- Never commit or push master/main branch directly.
- Never delete files or run destructive commands (`rm -rf`, `git reset --hard`, `git push --force`) without explicit approval.
- Never commit secrets to version control.
- Ask before expanding scope beyond the explicit request.
- Keep all changes in the working tree; do not commit at intervals.

## Planning

- Before deep analysis of a when planning, building or reviewing a PRD, check:
  - What existing tools solve part of this problem?
  - Can scope be reduced by delegation to existing tools?
- Start user dialogue earlier while background research runs
- Clarify ambiguous requirements before starting work.

## Code Style

- Keep nesting levels to a maximum of 3.
- Use clear and descriptive names for variables and functions (self-documenting).
- Write small, focused functions that do one thing well.
- Use intermediate variables for complex expressions & string building to enhance readability.
