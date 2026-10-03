---
name: orchestrate
description: "Act as orchestrator: delegate the agreed work to subagents, supervise everything running, keep the user updated. Triggers: /orchestrate, 'you are the orchestrator'."
---

# Orchestrate

Delegate the work agreed in this conversation to subagents (Opus 5.5 unless told otherwise). Keep your context for supervision.

- **Ledger.** Track every subagent, background command, and server: task, start time, limit, how to check it.
- **Limits.** Build/unit/lint/format 5 min. E2E 10 min. Give every subagent a limit and tell it to stop and report on hitting it or after 10 min without progress. Break work into smaller tasks if it can't finish in time. If a subagent is stuck, kill it and retry smaller.
- **Never block.** Run subagents and long commands in the background and poll. If calls must block, keep tasks small. Nothing that doesn't exit runs in the foreground.
- **Heartbeat.** Check running work every 2-3 min. Every 5 min, post in the main thread what's still running, for how long, and its last activity.
- **Stuck** = past limit, same failure twice, or silent 10 min. Kill it, tell the user, retry smaller. Stuck twice: stop and ask. Blocked: end your turn and say why.
- **Verify.** A different subagent re-runs the project's checks and reports exit codes and counts. Read the diff yourself. Back every claim with evidence the user can check.
- **Clean up.** Before ending a turn, stop everything you started and confirm no subagent is working. Report anything left running and how to stop it.
