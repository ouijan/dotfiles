---
name: address-pr-feedback
description: "Interactive PR review feedback resolution. Triages comments, groups related items, presents for human decision, then fixes/replies/resolves. Triggers: 'address PR feedback', 'resolve PR comments', 'handle review feedback', 'address review comments', 'fix PR feedback'."
license: MIT
metadata:
  version: '0.1'
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
  - "go" / "proceed" / "fix them" → apply all auto-fixable, ask about needs-input one by one
  - "skip 3, 7" → exclude those from auto-fix
  - "fix 5 by using X instead" → override the auto-fix approach for item 5
  - For needs-input items: "fix 8", "reply 9: we intentionally did X because Y", "skip 10"
  - "fix all" → apply auto-fixable AND attempt needs-input items using agent judgment
- If the user provides direction for needs-input items inline (e.g., "fix 8 with a type guard, reply 9: intentional, skip 10"), process all at once.
- If the user says "go" without addressing needs-input items, apply auto-fixes first, then present needs-input items one at a time.

---

### Phase 4: Execute

Process items in **file order** to avoid edit conflicts.

#### 4A. Apply fixes

For each approved fix:

1. Read the full file
2. If comment contains ` ```suggestion ` block → apply the suggestion directly
3. If grouped pattern (e.g., "use `toMoment`") → apply consistently across all listed locations
4. If user provided custom direction → follow that direction
5. Track all modified files

#### 4B. Commit and push

```bash
git add <list of modified files>

if ! git diff --cached --quiet; then
  git commit -m "fix: address PR review feedback"
  git push
fi
```

Stage only modified files — never `git add -A`.

#### 4C. Reply to threads

For each addressed thread, reply to the **root comment** (`in_reply_to_id == null`):

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

#### 4D. Resolve threads

Resolve threads **only where a fix was implemented**. Do NOT resolve threads where we only replied with justification — let the reviewer verify.

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
