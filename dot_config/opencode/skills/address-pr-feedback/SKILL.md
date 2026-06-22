---
name: address-pr-feedback
description: "Interactive PR review feedback resolution. Triages comments, groups related items, presents for human decision, then fixes/replies/resolves. Triggers: 'address PR feedback', 'resolve PR comments', 'handle review feedback', 'address review comments', 'fix PR feedback'."
license: MIT
metadata:
  version: '0.2'
---

# Address PR Feedback

Interactive workflow for resolving PR review comments with human-in-the-loop triage. Groups related comments, presents them for decision, executes fixes, posts replies, and resolves threads.

## Hard Preconditions

1. `gh` CLI is authenticated (`gh auth status`)
2. Current branch has an open PR (or PR number is provided)
3. Working directory is clean (`git status --porcelain` is empty) — stash or commit first

## Workflow

### Phase 1: Fetch & Inventory

#### 1A. Determine PR context

```bash
PR_NUMBER=${provided_or_detected}
OWNER=$(gh repo view --json owner --jq '.owner.login')
REPO=$(gh repo view --json name --jq '.name')
PR_URL=$(gh pr view $PR_NUMBER --json url --jq '.url')
```

#### 1B. Fetch all review comments (REST)

```bash
gh api repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments --paginate
```

Key fields per comment: `id`, `node_id`, `path`, `line`, `diff_hunk`, `body`, `user.login`, `user.type`, `in_reply_to_id`, `created_at`, `html_url`

#### 1C. Fetch thread resolution status (GraphQL)

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            comments(first: 100) {
              nodes {
                id
                databaseId
                body
                author { login }
                createdAt
              }
            }
          }
        }
      }
    }
  }
' -f owner=$OWNER -f repo=$REPO -F pr=$PR_NUMBER
```

Build a mapping: `REST comment id` → `GraphQL thread id (PRRT_...)` using `databaseId`.

#### 1D. Filter

- **Exclude** resolved threads (`isResolved == true`)
- **Exclude** outdated threads (`isOutdated == true`)
- **Exclude** our own AI comments (body starts with `***:robot:`)
- **Separate** praise/positive comments for the kudos section (see Phase 2)

#### 1E. Reconstruct threads

Group comments by `in_reply_to_id`:
- `in_reply_to_id == null` → thread root
- `in_reply_to_id == {id}` → reply to that root

---

### Phase 2: Classify & Group

#### 2A. Identify reviewer type

For each comment author, tag as:

| `user.type` / `user.login` | Tag |
|---|---|
| `Bot`, or login contains `copilot`, `bot` | 🤖 **Bot** |
| All others | 👤 **Human** |

#### 2B. Classify each thread

| Classification | Criteria | Action |
|---|---|---|
| **Auto-fixable** | Contains ` ```suggestion ` block, OR is a clear directive ("use X", "rename to Y", "remove this", single-word corrections like "`toMoment`", "`return`") | Fix without asking |
| **Needs input** | Questions (`?`), design discussions, ambiguous scope, architecture concerns, multiple valid approaches | Present to user |
| **Praise / Acknowledgment** | "Nice", "LGTM", "Looks good", thumbs up, positive sentiment | Surface in kudos section |
| **Informational** | Explanatory AI comments, already-addressed items | Skip silently |

#### 2C. Group related comments

Scan auto-fixable and needs-input items for **repeated patterns** — same reviewer making the same request across multiple files. Group when:

- Same reviewer + same directive text (fuzzy match on core instruction)
- Same reviewer + same function/pattern referenced (e.g., "use `toMoment`" appearing 3 times)

Each group becomes a single triage item with multiple file locations listed.

#### 2D. Read code context

For each thread root comment, read the referenced file at the specified line with ±10 lines of surrounding context. This context is needed for:
- Accurate classification
- Presenting meaningful summaries to the user
- Implementing fixes

---

### Phase 3: Present Triage Report

Present the full triage to the user **before taking any action**. Format:

```markdown
## PR Feedback Triage — PR #N

### 🎉 Kudos
> **reviewer**: "Nice" — [file.ts:79](html_url)
> **reviewer**: "Looks good" — [file.ts:42](html_url)

---

### ✅ Auto-fixable ({count} items — will fix unless you object)

**{N}. [{group_title}]({html_url}) — 👤 @reviewer**
> {quoted comment body, first 2 lines}
> Files: `path/file1.ts:L42`, `path/file2.ts:L88`, `path/file3.ts:L12`

**{N}. [{single_title}]({html_url}) — 🤖 @copilot**
> {quoted comment body, first 2 lines}
> File: `path/file.ts:L36`

---

### 🤔 Needs Your Input ({count} items)

**{N}. [{title}]({html_url}) — 👤 @reviewer**
> {quoted comment body, first 3 lines}
> File: `path/file.ts:L1029`
> **Context**: {1-2 sentence summary of the relevant code}

**{N}. [{title}]({html_url}) — 🤖 @copilot**
> {quoted comment body, first 3 lines}
> File: `path/file.ts:L94`
> **Context**: {1-2 sentence summary of the relevant code}

---

### ⏭️ Skipped ({count})
- {count} AI comments, {count} already addressed

---

**How to proceed:**
- Auto-fixable items will be applied unless you say otherwise (e.g., "skip item 3")
- For each "Needs Input" item, tell me: **fix** (with optional direction), **reply** (with your message), or **skip**
```

### Numbering

Items are numbered sequentially across all sections (auto-fixable and needs-input share one sequence). This allows the user to reference any item by number (e.g., "skip 3", "fix 7 by extracting a method").

### Interaction Rules

- **STOP after presenting the triage.** Wait for the user's response.
- Accept responses like:
  - "walk through" / "walk me through" / "let's go through them" → enter Phase 3B guided walkthrough
  - "go" / "proceed" / "fix them" → apply all auto-fixable, enter walkthrough for needs-input items
  - "skip 3, 7" → exclude those from auto-fix
  - "fix 5 by using X instead" → override the auto-fix approach for item 5
  - For needs-input items: "fix 8", "reply 9: we intentionally did X because Y", "skip 10"
  - "fix all" → apply auto-fixable AND attempt needs-input items using agent judgment
- If the user provides direction for needs-input items inline (e.g., "fix 8 with a type guard, reply 9: intentional, skip 10"), queue all decisions and skip to Phase 4.
- Default: offer the guided walkthrough.

**Prompt at end of triage report:**

```markdown
---

**Ready to walk through each item?** I'll show you the code context, suggest possible fixes, and collect your decision for each one. Once we've gone through everything, I'll action all the changes in one go.

Say **"walk through"** to go item-by-item, or provide decisions inline (e.g., "fix 3, skip 5, reply 8: intentional").
```

---

### Phase 3B: Guided Walkthrough

Present each item (auto-fixable and needs-input) one at a time. For auto-fixable items, present them briefly with the proposed fix for confirmation. For needs-input items, provide deeper context and possible solutions.

#### 3B.1. Item presentation format

For each item, present:

```markdown
### Item {N}/{total}: [{title}]({html_url}) — {reviewer_icon} @{reviewer}

**Comment:**
> {full comment body}

**File:** `{path}:{line}` | [View on GitHub]({html_url})

**Code context:**
```{lang}
{±15 lines of surrounding code, with the commented line highlighted}
```

**Analysis:** {2-3 sentence explanation of what the reviewer is asking for and why}

**Suggested approaches:**
1. {Best approach} — {brief rationale}
2. {Alternative approach} — {brief rationale}
3. Reply with justification — {draft reply if current code is intentional}

**Your call:** **fix** (pick 1-3 or describe your own), **reply** (with message), or **skip**
```

#### 3B.2. Interaction per item

- **STOP after each item.** Wait for the user's decision.
- Accept:
  - "1" / "2" / "3" → select that suggested approach
  - "fix" / "fix it" → use suggested approach 1 (the recommended one)
  - "fix: {custom direction}" → use the user's direction instead
  - "reply: {message}" → queue a reply with the user's message
  - "skip" → skip this item entirely
  - "skip rest" → skip all remaining items
- Record each decision in an internal queue. Do NOT execute anything yet.

#### 3B.3. After all items

Present a confirmation summary of queued actions:

```markdown
## Queued Actions — {n} items

| # | Item | Action | Detail |
|---|---|---|---|
| 1 | Rename `foo` to `bar` | Fix | Apply suggestion |
| 3 | Error handling approach | Fix | Add try/catch per approach 2 |
| 5 | Why no memoization? | Reply | "Intentional — values change every render" |
| 7 | Extract helper | Skip | — |

**Ready to execute?** Say **"go"** to action all queued items, or adjust (e.g., "change 3 to skip").
```

- **STOP.** Wait for final confirmation before executing.

---

### Phase 4: Execute

#### 4A. Delegate fixes to sub-agents

Group queued fixes by file. For each file (or group of related files), delegate to a sub-agent:

```
task(
  category="quick",
  description="Apply PR feedback fix: {item_title}",
  prompt="
    1. TASK: Apply the following fix to {path}
    2. EXPECTED OUTCOME: {description of fix, code context, exact change}
    3. REQUIRED TOOLS: Read, Edit, lsp_diagnostics
    4. MUST DO:
       - Read the file first
       - Apply the change as described
       - If suggestion block: apply verbatim
       - If grouped pattern: apply across all listed locations
       - If custom direction: follow exactly
       - Run lsp_diagnostics on the changed file — must be clean
    5. MUST NOT DO:
       - Do NOT modify unrelated code
       - Do NOT reformat or refactor beyond the fix
       - Do NOT commit or push
    6. CONTEXT: {diff_hunk, comment body, surrounding code, user's chosen approach}
  "
)
```

**Parallelism rules:**
- Fixes on **different files** → delegate in parallel
- Fixes on the **same file** → delegate sequentially (avoid edit conflicts)
- After each delegation, verify the sub-agent's result: read the changed file, confirm the fix matches intent

#### 4B. Verify all changes

After all sub-agents complete:

1. Run `lsp_diagnostics` on every modified file
2. If any errors were introduced → fix or revert and report to user
3. Confirm total set of modified files matches expectations

#### 4C. Commit and push

Only after all fixes pass verification:

```bash
git add <list of modified files>

if ! git diff --cached --quiet; then
  git commit -m "fix: address PR review feedback"
  git push
fi
```

Stage only modified files — never `git add -A`.

#### 4D. Reply to threads

After push succeeds, reply to each addressed thread's **root comment** (`in_reply_to_id == null`):

```bash
gh api repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments/{root_comment_id}/replies \
  -X POST -f body="***:robot: AI Response***

{response_message}"
```

Response templates:

| Action | Template |
|---|---|
| Fixed | `Fixed. {Brief description}.` |
| Fixed (grouped) | `Fixed across {N} files. {Brief description}.` |
| Fixed (user direction) | `Fixed per feedback. {Brief description}.` |
| Reply (user dictated) | `{User's message}` |
| Not implementing | `Acknowledged. {Reason current approach is preferred}.` |
| Skipped by user | No reply posted |

**Rate limiting**: 1-second delay between replies if >10 comments.

#### 4E. Resolve threads

Resolve threads **only where a fix was implemented and pushed**. Do NOT resolve threads where we only replied with justification — let the reviewer verify.

```bash
gh api graphql -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread { id isResolved }
    }
  }
' -f threadId="PRRT_xxxxx"
```

Use the `REST comment id → GraphQL thread id` mapping from Phase 1C.

---

### Phase 5: Summary

After all actions are complete:

```markdown
## Feedback Resolution Summary — PR #N

| | Count |
|---|---|
| Fixed | {n} |
| Replied | {n} |
| Resolved | {n} |
| Skipped | {n} |
| Pending reviewer verification | {n} |

**Commit**: `{sha}` — pushed to `{branch}`

### Remaining unresolved threads: {n}
{List any threads still needing attention, with links}
```

If significant changes were made, check for reviewers with `CHANGES_REQUESTED` status and re-request their review:

```bash
gh pr edit $PR_NUMBER --add-reviewer {reviewer}
```

---

## Edge Cases

- **Comment on deleted file**: Reply noting the file was removed, resolve
- **Multiple comments on same line**: Fix once, reply to all threads
- **Stale line numbers**: Use `diff_hunk` for context when `line` doesn't match current file
- **Conflicting reviewer feedback**: Present both to user, let them decide
- **Thread already resolved**: Check `isResolved` before resolving — skip gracefully
- **>100 threads**: Paginate GraphQL query using `after` cursor
- **Issue comments vs review comments**: Issue comments (timeline) don't have threads — respond via issue comment endpoint instead:
  ```bash
  gh api repos/$OWNER/$REPO/issues/$PR_NUMBER/comments \
    -X POST -f body="***:robot: AI Response***

  {response_message}"
  ```
