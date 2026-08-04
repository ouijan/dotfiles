---
name: pr-status
description: "Generate a PR and task status report for the current user across a GitHub org and optional ClickUp workspace. Auto-detects the org from the current repo or asks. Ends with a numbered quick-action menu. Triggers: 'status report', 'pr status', 'what should I work on', 'my PRs', 'standup report', 'brief status'."
license: MIT
metadata:
  version: '1.0'
---

# PR Status Report

Generate a status report of pull requests and tasks for the current user across a GitHub organisation and optionally the connected ClickUp workspace. The report ends with a numbered quick-action menu the user can invoke by typing a number.

## Hard Preconditions

Before starting, verify:

1. `gh` CLI is authenticated.
2. If ClickUp MCP tools are available (`clickup_search`, `clickup_get_task`), enable ClickUp cross-referencing. If not, skip ClickUp phases gracefully — the GitHub report is still useful on its own.

## Org Detection

Resolve the GitHub org to report on. Check in this order:

1. **User argument**: If the user passed an org name (e.g., `/pr-status my-org`), use that.
2. **Current repo**: Run `gh repo view --json owner --jq '.owner.login'` in the working directory. If it succeeds, use that owner as the org.
3. **Ask**: If neither is available (not in a git repo, no argument), ask the user which org to report on.

Store the resolved org as `{org}` for all subsequent commands.

## Workflow

### Phase 1: Identify User and Gather GitHub Data (parallel)

Resolve the GitHub username and org simultaneously:

```bash
gh api user --jq '.login'
gh repo view --json owner --jq '.owner.login'  # skip if org already known
```

Then run all four PR searches simultaneously. Use ONLY these valid `--json` fields: `repository,title,number,url,state,createdAt,updatedAt,labels,isDraft,author`.

Do NOT use `reviewDecision` — it is not a valid search field and will cause an error.

```bash
# 1. PRs authored by user
gh search prs --author={username} --state=open --owner={org} \
  --json repository,title,number,url,state,createdAt,updatedAt,labels,isDraft \
  --limit 50

# 2. PRs requesting user's review
gh search prs --review-requested={username} --state=open --owner={org} \
  --json repository,title,number,url,state,createdAt,updatedAt,labels,isDraft,author \
  --limit 50

# 3. PRs user has reviewed (still open)
gh search prs --reviewed-by={username} --state=open --owner={org} \
  --json repository,title,number,url,state,createdAt,updatedAt,labels,isDraft,author \
  --limit 50

# 4. All PRs involving user (catches edge cases)
gh search prs --involves={username} --state=open --owner={org} \
  --json repository,title,number,url,state,createdAt,updatedAt,labels,isDraft,author \
  --limit 50
```

Deduplicate results by PR number across all four queries.

### Phase 2: Enrich Active PRs

From Phase 1 results, identify **active PRs** — those updated within the last 60 days.

For drafts: include them in enrichment but tag them as draft in the output.

For each active PR, fetch detailed status, comments (for ClickUp links), and commit timeline. Batch into a single loop, using the repo from search results:

```bash
for pr in {active_pr_numbers}; do
  echo "=== PR #$pr ==="
  gh pr view $pr --repo {repository.nameWithOwner} \
    --json title,reviews,statusCheckRollup,mergeable,mergeStateStatus,reviewRequests,comments,commits
done
```

Key fields to extract per PR:

| Field | What to look for |
|-------|-----------------|
| `mergeStateStatus` | `CLEAN` (ready), `BEHIND` (needs rebase), `DIRTY` (conflicts), `BLOCKED` (checks/reviews) |
| `mergeable` | `MERGEABLE` or `CONFLICTING` |
| `reviewRequests` | Who still needs to review |
| `reviews` | Latest review state per unique reviewer — `APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`, `DISMISSED` |
| `statusCheckRollup` | Any `FAILURE` conclusions — focus on `Lint`, `Test`, `Build`, `E2E` names |
| `comments` | Look for ClickUp task links (see Phase 3) |
| `commits` | Commit timestamps — used to detect post-review commits (see Phase 2.5) |

When processing `reviews`: multiple reviews from the same person may exist. Use only the **most recent** review per reviewer. Ignore bot reviewers (e.g., `copilot-pull-request-reviewer`).

### Phase 2.5: Detect Addressed Reviews

For any PR where a reviewer's most recent review is `CHANGES_REQUESTED`, check whether the author has pushed commits **after** that review was submitted.

**Logic:**
1. Get the `submittedAt` timestamp of the most recent `CHANGES_REQUESTED` review from each reviewer.
2. Get the `committedDate` of the latest commit on the PR (from the `commits` field).
3. If `latestCommitDate > reviewSubmittedAt`, the feedback has likely been **addressed** — the author pushed changes after receiving the review.
4. Tag this PR+reviewer pair as `addressed_awaiting_re_review` instead of `changes_requested`.

**Why this matters:** GitHub does not automatically clear the `CHANGES_REQUESTED` state when new commits are pushed. Without this check, PRs where the author has already addressed feedback are incorrectly classified as "Action Required From You" when they should be "Blocked on Others — awaiting re-review".

### Phase 3: ClickUp Cross-Reference (PR-linked only)

Skip this phase entirely if ClickUp MCP tools are not available.

Only extract ClickUp task links that are directly tied to PRs. Do NOT fetch standalone ClickUp tasks or search for unlinked tasks.

#### CU- comment extraction

The ClickUp-GitHub integration leaves comments on PRs with the format:

```
Task linked: [CU-{taskId} {task name}](https://app.clickup.com/t/{taskId})
```

For each PR's comments (fetched in Phase 2), search for comments matching the pattern `CU-` followed by an alphanumeric task ID. Extract:
- The ClickUp task ID (e.g., `86d0zn57c`)
- The task name from the link text
- The ClickUp URL

Then fetch current task status via `clickup_get_task(task_id="{taskId}")` for each linked task.

Include the ClickUp link and status inline in whichever bucket the PR is classified into. Do NOT create separate ClickUp sections in the report.

### Phase 4: Classify and Prioritise

Sort every PR into exactly one bucket. Check conditions in this order:

#### Bucket 1: Action Required From You
PRs you authored where ANY of:
- A reviewer submitted `CHANGES_REQUESTED` (most recent review from that person) **AND** no commits have been pushed after that review (i.e., NOT tagged `addressed_awaiting_re_review` from Phase 2.5)
- `mergeable` is `CONFLICTING`
- `statusCheckRollup` contains any `FAILURE` conclusion on Lint/Test/Build/E2E

#### Bucket 1b: Addressed — Awaiting Re-review
PRs you authored where:
- A reviewer submitted `CHANGES_REQUESTED` but the author has pushed commits **after** that review (tagged `addressed_awaiting_re_review` from Phase 2.5)
- No other unaddressed `CHANGES_REQUESTED` from other reviewers
- No merge conflicts or CI failures (those would keep it in Bucket 1)

Display these separately from Bucket 1 with a distinct label so the user knows no further action is needed — they are waiting for the reviewer to re-review.

#### Bucket 2: Ready to Merge
PRs you authored where ALL of:
- At least one `APPROVED` review
- No `CHANGES_REQUESTED` from any reviewer (including addressed ones — the reviewer must explicitly approve)
- `mergeable` is `MERGEABLE`
- No `FAILURE` in status checks
- `mergeStateStatus` is `CLEAN` or `BEHIND` (behind just means needs branch update, not broken)

#### Bucket 3: Blocked on Others
PRs you authored where:
- `reviewRequests` is non-empty (someone hasn't reviewed yet)
- No unaddressed `CHANGES_REQUESTED` (that would be Bucket 1)
- No addressed-but-pending re-review (that would be Bucket 1b)
- CI is green

#### Bucket 4: Awaiting Your Review
PRs by others where your review is requested or you're in the `involves` set but haven't submitted a review.

#### Bucket 5: Draft / WIP
Your draft PRs. Include CI status and conflict state.

#### Bucket 6: Stale
PRs not updated in 60+ days. One line each.

### Phase 5: Generate Report

Use **list format** (not tables) for all report output. Each PR is a bullet with the title as the leading text, the PR link immediately after, and context details on the same line or indented below. This is optimised for terminal readability and clickable links.

Standard markdown links `[text](url)` are clickable in the Ghostty+tmux+OpenCode TUI stack. Always use this format for PR links and ClickUp links.

#### Item Format (all buckets)

Every PR item follows this structure:

```
- **{title}** [#{N}]({url})
  {context line — varies per bucket}
  {ClickUp line — only if linked}
```

#### Report Template

```markdown
# PR Status Report — {name}
**Org:** {org} | **Date:** {date}

---

## Action Required From You

- **title** [#N](url)
  Changes requested by `reviewer` · CI: passing
  [CU: task name](cu_url)

- **title** [#N](url)
  Merge conflicts · CI: Lint failing, Build failing

## Addressed — Awaiting Re-review

- **title** [#N](url)
  Addressed `reviewer`'s feedback · N commits since review · waiting X days
  [CU: task name](cu_url)

## Ready to Merge

- **title** [#N](url)
  Approved by `reviewer1`, `reviewer2` · CI green
  [CU: task name](cu_url)

## Blocked on Others

- **title** [#N](url)
  Waiting on `reviewer` · X days
  [CU: task name](cu_url)

## Awaiting Your Review

- **title** [#N](url) by `author`
  X days old · CI green · no reviews yet

## Draft / WIP

- **title** [#N](url)
  CI: Pass · No conflicts · updated X days ago
  [CU: task name](cu_url)

## Stale PRs (60+ days inactive)

- **title** [#N](url) · X months inactive
- **title** [#N](url) · X months inactive

---

## Quick Actions

Type a number to execute, multiple numbers separated by commas (e.g. `1,3,5`), or `all safe` to run all non-destructive actions.

**Recommended:** {single highest-priority action with brief rationale}

{N}. `address {reviewer}'s feedback on #{N}` — {PR title} ({reason})
{N}. `update branch on #{N}` — {PR title} (behind master, CI green)
{N}. `review #{N}` — {PR title} by `author` ({X} days old)
{N}. `chase {reviewer} for re-review on #{N}` — {PR title} ({X} days waiting)
{N}. `chase {reviewer} for review on #{N}` — {PR title} ({X} days waiting)
{N}. `fix CI on #{N}` — {PR title} ({failing checks})
{N}. `merge #{N}` — {PR title} (approved, CI green) ⚠️ confirm
{N}. `rebase #{N} onto master` — {PR title} (conflicts) ⚠️ confirm
{N}. `close #{N}` — {PR title} ({X} months stale) ⚠️ confirm
```

### Phase 5.5: Auto-Execute Safe Actions

After generating the report, automatically execute actions that are always safe and non-destructive. Do NOT wait for user input for these.

**Auto-execute: update branches on Ready to Merge PRs that are behind master.**

1. Identify all PRs in the "Ready to Merge" bucket where `mergeStateStatus` is `BEHIND` and `mergeable` is `MERGEABLE`.
2. For each, run: `gh pr update-branch {number} --repo {nameWithOwner}`
3. Append results to the bottom of the report:

```
**Auto-updated branches:**
- #N — **title** updated to latest master ✓
```

This is safe because the PR is fully approved, CI was green, and `gh pr update-branch` is non-destructive (GitHub creates a merge commit; if it causes conflicts the API errors and no changes are made).

If no PRs qualify, skip this section silently.

### Phase 5.6: Quick Action Menu Construction

Build the numbered quick-action menu for the end of the report. Items are ordered by priority:

1. **Address unaddressed review feedback** — PRs in Bucket 1 with `CHANGES_REQUESTED`
2. **Fix CI failures** — PRs in Bucket 1 with failing checks
3. **Resolve merge conflicts** — PRs in Bucket 1 with `CONFLICTING`
4. **Review PRs from others** — PRs in Bucket 4, sorted by age (oldest first)
5. **Chase for re-review** — PRs in Bucket 1b, sorted by wait time (longest first)
6. **Chase for review** — PRs in Bucket 3, sorted by wait time (longest first)
7. **Update branches** — PRs behind master (that weren't auto-updated in Phase 5.5)
8. **Merge ready PRs** — PRs in Bucket 2 (marked ⚠️ confirm)
9. **Close stale PRs** — PRs in Bucket 6 (marked ⚠️ confirm)

Each item is a single line: `{N}. {action in backticks} — {PR title} ({brief context})`

Add a ⚠️ confirm suffix to destructive actions (merge, close, rebase).

Add a **Recommended** line above the numbered list picking the single highest-priority action with a one-line rationale. Priority: freshest unaddressed review feedback > CI failures > overdue reviews from others > longest-waiting chase.

#### `all safe` shortcut

When the user types `all safe`, execute all items that do NOT have the ⚠️ confirm suffix. This includes:
- `update branch` actions
- `chase` actions (re-request review + post nudge comment)

It does NOT include: `address feedback`, `fix CI`, `review`, `merge`, `rebase`, `close` — these require human judgment or branch checkout.

Report results as a summary:

```
**Executed N safe actions:**
- ✓ Updated branch on #N — **title**
- ✓ Chased `reviewer` for re-review on #N — **title**
- ✓ Chased `reviewer` for review on #N — **title**
```

### Phase 5.7: Action Dispatch

After generating the report, the user may type a number, multiple numbers, `all safe`, or any action phrase as a follow-up prompt. The agent MUST recognise these and dispatch them.

#### Input Formats

| User input | Behaviour |
|---|---|
| `1` | Execute quick action #1 |
| `1,3,5` | Execute quick actions #1, #3, #5 sequentially |
| `all safe` | Execute all non-destructive actions |
| `address feedback on #5982` | Fuzzy match — dispatch directly |
| `chase all` | Chase all reviewers across Blocked + Addressed buckets |

#### Dispatch Table

| Action pattern | Execution |
|---|---|
| `address {reviewer}'s feedback on #{N}` | Invoke the `address-pr-feedback` skill: `task(category="quick", load_skills=["address-pr-feedback"], prompt="/address-pr-feedback {N}")`. NOTE: requires checking out the PR branch first — run `gh pr checkout {N}` before invoking. If working tree is dirty, warn and ask the user to stash first. |
| `show review comments on #{N}` | Fetch and display review comments inline: `gh api repos/{owner}/{repo}/pulls/{N}/comments --jq '[.[] | {author: .user.login, body: .body, path: .path, line: .line, html_url: .html_url}]'`. Format as a readable list with file paths and comment bodies. |
| `fix CI on #{N}` | Check out the PR branch (`gh pr checkout {N}`), fetch the CI failure details from `statusCheckRollup`, identify failing jobs (Lint/Build/Test/E2E), examine the Nx Cloud links or run the failing targets locally, then fix. Delegate: `task(category="quick", load_skills=["typescript-coding-standards", "angular-coding-standards"], prompt="Fix CI failures on PR #{N}. Failing checks: {list}. Check out the branch, diagnose, fix, and verify with lsp_diagnostics.")` |
| `rebase #{N} onto master` | Run `gh pr checkout {N} && git rebase origin/master`. If conflicts arise, present them to the user. If clean, `git push --force-with-lease`. ⚠️ Confirm first. |
| `chase {reviewer} for re-review on #{N}` | Re-request review: `gh pr edit {N} --add-reviewer {reviewer}`. Then post a comment: `gh pr comment {N} --body "@{reviewer} I've addressed your feedback — could you take another look when you get a chance?"` |
| `chase {reviewer} for review on #{N}` | Request review: `gh pr edit {N} --add-reviewer {reviewer}`. Then post a comment: `gh pr comment {N} --body "@{reviewer} This PR is ready for review when you have a moment."` |
| `chase all` | Execute all `chase` actions from the quick-action menu. Batch re-request + comment for each reviewer/PR pair. |
| `merge #{N}` | ⚠️ Confirm with user first ("Merge #N into master?"), then: `gh pr merge {N} --squash --delete-branch`. |
| `update branch on #{N}` | Run `gh pr update-branch {N} --repo {nameWithOwner}`. Safe, no confirmation needed. |
| `review #{N}` | Check out the PR branch, show the diff summary (`gh pr diff {N} --stat`), then walk through changed files. Delegate: `task(category="unspecified-high", load_skills=["pr-review"], prompt="Review PR #{N} in {repo}. Fetch the diff, analyze changes, and post a review.")` |
| `show diff for #{N}` | Run `gh pr diff {N}` and display the output. |
| `close #{N}` | ⚠️ Confirm with user first ("Close #N? This will NOT delete the branch."), then: `gh pr close {N}`. |

#### Dispatch Rules

1. **Pattern matching is fuzzy** — the user may type `address the0rem's feedback on 5982` or `address feedback on #5982` or `fix the review on 5982`. Match on the PR number and the intent verb (address/fix/chase/merge/close/review/rebase/update/show).
2. **Branch safety** — any action that requires a branch checkout MUST check `git status --porcelain` first. If dirty, warn: "Working tree has uncommitted changes. Stash or commit first?" and stop.
3. **Confirmation for destructive actions** — `merge`, `close`, and `rebase` always require explicit user confirmation before executing.
4. **Skill delegation** — when dispatching to `address-pr-feedback`, pass the PR number as the argument. The skill handles everything from there (fetch, classify, triage, walk through, fix, reply, resolve).
5. **Chaining** — the user may request multiple actions in one message (e.g., `1,3` or "update branch on #5987 and address feedback on #5982"). Execute them sequentially, reporting results between each.
6. **Post-action status** — after each action completes, show a one-line status transition: `✓ #N — was "Action Required" → now "Addressed — Awaiting Re-review"`. Re-check the PR's actual state via `gh pr view` to confirm.

## Output Rules

### Formatting
- Use **list format** (bullets), never tables. Tables render poorly in terminal TUIs.
- Lead each item with `**title**` in bold — the PR title is the most important context.
- Immediately follow the title with `[#N](url)` — a clickable markdown link.
- Put status details (CI, reviewer, age) on the same line or indented below.
- Use standard markdown links `[text](url)` for all URLs — they render as clickable hyperlinks in Ghostty/tmux/OpenCode.
- ClickUp links go on their own indented line: `[CU: task name](cu_url)`.

### Content
- Lead with "Action Required From You" — the user's most urgent items.
- Never bury merge conflicts or failing CI below less urgent sections.
- Use relative time ("3 days", "6 weeks") not absolute timestamps.
- Stale PRs get one bullet each with title, link, and inactivity duration.
- If no items exist for a bucket, omit that section entirely.
- Do not include PR body text or full review comments — just the review verdict and reviewer name.
- When referencing people, use their GitHub username in backticks.
- Include ClickUp links inline where available, not in a separate section.
- If reporting across multiple repos in the org, group by repo only if there are PRs in more than one repo. Otherwise omit the repo grouping.

### Quick Actions Menu
- Always end the report with the **Quick Actions** section.
- Always include a **Recommended** line above the numbered list.
- Number items sequentially starting from 1.
- Mark destructive actions with ⚠️ confirm.
- Keep each item to one line: number, action in backticks, PR title, brief context in parens.
- The menu replaces the old "Next Steps" and "Actions" lines on individual items — do NOT include per-item Actions lines in the bucket listings.
