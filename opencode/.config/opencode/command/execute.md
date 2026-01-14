---
description: Execute work items from a plan, review, or todo artifact
agent: build
---
Execute work items using multi-agent orchestration.

## Input

$ARGUMENTS

If no artifact specified, ask user to choose:
- `.opencode/workflow/current-plan.md` (from /plan)
- `.opencode/workflow/review-todos.md` (from /review)
- `.opencode/workflow/review-report.md` (from /review)

## Pre-flight Checks

Before execution:

1. **Check git status** for uncommitted changes
2. **If dirty state:**
   - Warn user about existing uncommitted changes
   - Ask to proceed, stash first, or abort
3. **Confirm artifact** to execute

## Working Tree Policy

All changes remain in the working tree:
- Do NOT commit at intervals
- Do NOT create automatic commits
- Changes stay unstaged until user reviews
- User commits manually when satisfied

## Phase 1: Load & Parse

1. Read the specified artifact
2. Extract pending work items
3. Identify dependencies between items
4. Group independent items for parallel execution (only items affecting different files)

## Phase 2: Map Items to Agents

| Item Type | Agent |
|-----------|-------|
| Code fix / refactor | @implementer |
| Security fix | @implementer → @security-reviewer (verify) |
| Performance fix | @implementer → @performance-reviewer (verify) |
| Missing tests | @testing |
| Missing docs | @documentation |
| Debug / investigate | @debug |
| Status tracking | @todo-manager |

## Phase 3: Execute

**Parallel execution** for independent items:
- Items affecting different files only
- Documentation updates
- Test additions for separate modules

**Sequential execution** for dependent items:
- Changes with dependencies
- Multi-file refactors
- Fixes requiring verification
- Items affecting the same file

For each item, update the artifact in real-time:

1. **Before:** Mark as "in_progress" via @todo-manager, update artifact immediately
2. **Execute:** Invoke mapped agent(s)
3. **Validate:** Check output meets requirements
4. **After:** Mark as "completed" or "failed" via @todo-manager, update artifact immediately
5. **Discover:** If new items found, add to artifact immediately

Keep the artifact as the live source of truth throughout execution.

## Phase 4: Handle Feedback

Pause and request user input when:
- P1 critical item requires confirmation
- Agent recommendations conflict
- Scope expansion detected
- Destructive operation pending
- Error encountered

On error:
1. Mark item as "blocked" in artifact immediately
2. Log failure context to artifact
3. Present error details to user
4. Wait for guidance before resuming

## On Completion

When all items complete:
1. Final artifact update with execution summary
2. Present summary of work done
3. List all files modified (unstaged in working tree)
4. List any items deferred or failed
5. Remind user to review changes and commit manually
6. Prompt user to run `/reflect` for workflow review
