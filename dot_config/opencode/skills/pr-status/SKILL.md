---
name: pr-status
description: "Generate a PR and task status report for the current user across a GitHub org and optional ClickUp workspace. Auto-detects the org from the current repo or asks. Supports full, brief, and auto-resolve modes. Triggers: 'status report', 'pr status', 'what should I work on', 'my PRs', 'standup report', 'brief status'."
license: MIT
metadata:
  version: '0.6'
---

# PR Status Report

Generate a status report of pull requests and tasks for the current user across a GitHub organisation and optionally the connected ClickUp workspace.

## Modes

This skill supports three modes, selected by the caller:

| Mode | When | Output |
|------|------|--------|
| **full** (default) | Start of day, first run | Complete report with all buckets, ClickUp tasks, and next steps |
| **brief** | Subsequent runs during the day | Only actionable items — skip stale, skip drafts without issues, skip empty buckets |
| **auto-resolve** | When user wants agent-assisted fixes | Run full report, then identify and delegate automatable actions |

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

### Phase 2.6: Detect Auto-Fixable Review Comments (auto-resolve mode only)

In auto-resolve mode, for PRs with `CHANGES_REQUESTED` reviews (both addressed and unaddressed), fetch the inline review comments:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments \
  --jq '[.[] | {id: .id, author: .user.login, body: .body, path: .path, in_reply_to_id: .in_reply_to_id, created_at: .created_at}]'
```

Classify each unresolved review comment into:

| Category | Detection | Example |
|----------|-----------|---------|
| **GitHub suggestion** | Body contains ` ```suggestion ` code block | Reviewer offered exact replacement code |
| **Trivial refactor** | Body suggests a simple rename, extract, or one-line change with clear before/after | "Use `X` instead of `Y`" with code snippet |
| **Question / discussion** | Body asks a question or raises a design concern without a concrete code change | "I wonder if...", "Should we consider..." |
| **Complex change** | Body requests architectural or multi-file changes | "Consider splitting this PR", "Add error handling for X, Y, Z" |

Tag each PR with a summary: `{N} suggestion(s), {N} trivial, {N} question(s), {N} complex`. This feeds into Phase 6 auto-resolve.

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

In the report, show these under **"Addressed — Awaiting Re-review"** between "Action Required" and "Ready to Merge":

| PR | Addressed For | Commits Since Review | ClickUp |
|---|---|---|---|
| [#N](url) — **title** | `reviewer` | N commits since review | [Task](cu_url) |

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

#### Bucket 6: Stale (full mode only)
PRs not updated in 60+ days. One line each.

### Phase 5: Generate Report

#### Full Mode Template

```markdown
# PR Status Report — {name}
**Org:** {org} | **Date:** {date}

---

## Action Required From You

| PR | Issue | What To Do | ClickUp |
|---|---|---|---|
| [#N](url) — **title** | Changes requested by X | Address feedback | [Task](cu_url) |

## Addressed — Awaiting Re-review

| PR | Addressed For | Commits Since Review | ClickUp |
|---|---|---|---|
| [#N](url) — **title** | `reviewer` | N commits since review | [Task](cu_url) |

## Ready to Merge

| PR | Approvals | Notes | ClickUp |
|---|---|---|---|
| [#N](url) — **title** | X, Y approved | CI green | [Task](cu_url) |

## Blocked on Others

| PR | Waiting On | How Long | ClickUp |
|---|---|---|---|
| [#N](url) — **title** | `reviewer` | X days | [Task](cu_url) |

## Awaiting Your Review

| PR | Author | Age | Notes |
|---|---|---|---|
| [#N](url) — **title** | `author` | X days | — |

## Draft / WIP

| PR | CI | Conflicts | Updated | ClickUp |
|---|---|---|---|---|
| [#N](url) — **title** | Pass/Fail | Yes/No | X days ago | [Task](cu_url) |

## Stale PRs (60+ days inactive)

N stale PRs: #N (title), #N (title), ...

---

## Next Steps

**Do Now:**
1. {specific action referencing PR # and person}

**Follow Up:**
1. Chase {person} for re-review on #{N} ({X} days since you addressed their feedback)
2. Chase {person} for review on #{N} ({X} days waiting)

**Housekeeping:**
1. Close/rebase stale PRs, complete overdue reviews
```

#### Brief Mode Template

Only show non-empty buckets 1-4 (including 1b). No stale section. No ClickUp details (just inline links). No full Next Steps — just a numbered action list:

```markdown
# Status Brief — {name} | {date}

## Do Now
1. #N — Address {reviewer}'s changes ([ClickUp](url))
2. #N — Fix merge conflicts

## Addressed — Awaiting Re-review
- #N — Addressed `reviewer`'s feedback (N commits since review) ([ClickUp](url))

## Merge Ready
- #N — **title** (approved by X)

## Blocked
- #N — Waiting on `reviewer` (X days)

## Review Queue
- #N by `author` (X days)
```

### Phase 5.5: Auto-Update Merge-Ready PRs (ALL modes)

After generating the report in ANY mode (full, brief, or auto-resolve), automatically update branches for PRs in the "Ready to Merge" bucket that are behind master.

1. Identify all PRs in the "Ready to Merge" bucket where `mergeStateStatus` is `BEHIND` and `mergeable` is `MERGEABLE`.
2. For each, run: `gh pr update-branch {number} --repo {nameWithOwner}`
3. Append a summary to the bottom of the report:

```
**Auto-updated branches:**
- #N — updated to latest master ✓
```

This is safe because the PR is fully approved, CI was green, and `gh pr update-branch` is non-destructive (GitHub creates a merge commit; if it causes conflicts the API errors and no changes are made). No confirmation needed.

If no PRs qualify, skip this section silently.

### Phase 6: Auto-Resolve Mode (when requested)

After generating the full report, scan for self-resolvable blockers and act on them.

#### Self-Resolvable Blockers

The following blocker types can be identified and resolved by agents. This list is intended to grow over time as patterns prove reliable.

---

**Branch behind master**

- Detected when: `mergeStateStatus` is `BEHIND` and `mergeable` is `MERGEABLE`
- Resolution: `gh pr update-branch {number} --repo {nameWithOwner}`
- Safety: Non-destructive. GitHub creates a merge commit on the PR branch. If it causes conflicts the API will error and no changes are made.
- Auto-execute: Yes, no confirmation needed.

---

**GitHub suggestion comments on review**

- Detected when: Phase 2.6 found review comments containing ` ```suggestion ` code blocks that have not been resolved (no reply with "Fixed" or similar, and the suggestion hasn't been applied via GitHub's "Apply suggestion" button)
- Resolution: Delegate to a sub-agent with the `pr-review` skill:
  ```
  task(category="quick", load_skills=["pr-review"], prompt="Apply the following GitHub suggestion comments on PR #{number} in {repo}. For each suggestion, apply the exact code change proposed. Do NOT address comments that are questions or architectural concerns — only apply concrete code suggestions. Suggestions to apply: {list of suggestion comment IDs and their content}")
  ```
- Safety: GitHub suggestions are exact code replacements proposed by the reviewer. Applying them is equivalent to the reviewer making the change themselves. The sub-agent should commit each suggestion as a separate commit with message `fix: apply {reviewer}'s suggestion in {filename}`. CI will re-run after push.
- Auto-execute: No (needs confirmation). Present the list of suggestions to the user and ask "Apply these N suggestions from {reviewer}?" before delegating.

---

**Trivially-fixable review comments**

- Detected when: Phase 2.6 classified comments as "trivial refactor" — single-file, clear before/after, no design ambiguity
- Resolution: Delegate to a sub-agent with appropriate coding skills:
  ```
  task(category="quick", load_skills=["typescript-coding-standards", "angular-coding-standards"], prompt="Address the following trivial review comment on PR #{number}: {comment body}. File: {path}. Make the minimal change requested. Do not refactor beyond what was asked.")
  ```
- Safety: Trivial changes by definition are low-risk. The sub-agent is instructed to make minimal changes. CI will validate.
- Auto-execute: No (needs confirmation). Present each trivial fix to the user for approval before delegating.

---

<!-- Add new self-resolvable blocker types below this line -->
<!-- Template:
**Blocker Name**

- Detected when: {how to identify from Phase 2 data}
- Resolution: {exact commands or agent delegation steps}
- Safety: {why this is safe / what could go wrong / rollback}
- Auto-execute: Yes (safe) / No (needs confirmation) / Never
-->

#### Never Auto-Resolve

- Merge PRs (always requires human decision)
- Dismiss reviews
- Delete branches with unmerged work
- Close PRs

#### Auto-Resolve Execution Flow

1. Generate the full report first.
2. Scan all PRs for self-resolvable blockers listed above.
3. For each match, report what will be done: "PR #N is behind master — running `gh pr update-branch`".
4. Execute all auto-safe actions.
5. If any actions require confirmation, present them as a numbered list and wait for the user to approve.
6. Report results: success/failure per action.

## Output Rules

- Lead with "Action Required From You" — the user's most urgent items.
- Never bury merge conflicts or failing CI below less urgent sections.
- Use relative time ("3 days", "6 weeks") not absolute timestamps.
- Keep stale PR listings to one line each.
- "Next Steps" must be concrete: "Address {reviewer}'s review on #{N}" not "Review open PRs".
- If no items exist for a bucket, omit that section entirely.
- Do not include PR body text or full review comments — just the review verdict and reviewer name.
- When referencing people, use their GitHub username.
- Include ClickUp links inline where available, not in a separate section (brief mode).
- If reporting across multiple repos in the org, group by repo only if there are PRs in more than one repo. Otherwise omit the repo column.
