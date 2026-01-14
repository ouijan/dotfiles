# Agent Instructions

## Rules

- Never commit or push master/main branch directly.
- Never delete files or run destructive commands (`rm -rf`, `git reset --hard`, `git push --force`) without explicit approval.
- Never commit secrets to version control.
- Ask before expanding scope beyond the explicit request.
- Keep all changes in the working tree; do not commit at intervals.

## Style

- Keep nesting levels to a maximum of 3.
- Use clear and descriptive names for variables and functions (self-documenting).
- Write small, focused functions that do one thing well.
- Use intermediate variables for complex expressions & string building to enhance readability.
