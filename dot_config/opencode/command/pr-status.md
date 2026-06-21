---
description: Generate a PR and task status report for the current GitHub org. Modes: full (default), brief, auto-resolve.
---

<command-instruction>
Load and follow the `pr-status` skill exactly.

```text
skill(name="pr-status")
```

Determine the mode from the user's arguments:

- If arguments contain "brief" or "quick" → use **brief** mode.
- If arguments contain "auto" or "resolve" or "fix" → use **auto-resolve** mode.
- Otherwise → use **full** mode.

If the user provided an org name, use it. Otherwise the skill will auto-detect from the current repo.

If the user provided additional context (e.g., a specific PR number or person to focus on), incorporate that into the report scope.
</command-instruction>

<user-request>
$ARGUMENTS
</user-request>
