---
name: jrnl
description: Record, update, and query journal entries using jrnl CLI. Supports multiple journals, timestamps, tags, and exports to JSON/Markdown. Use when the user wants to log notes, track activities, record thoughts, or retrieve historical entries.
compatibility: Requires jrnl CLI (pipx install jrnl)
metadata:
  author: tharris
  version: "1.0"
---

# jrnl - Journal Management

You have access to the `jrnl` command-line journaling tool. Use it to help the user record thoughts, notes, activities, and retrieve historical entries.

## Quick Reference

### Writing Entries

```bash
# Simple entry (uses current time)
jrnl "Entry title. Entry body text here."

# Entry with specific time
jrnl "yesterday at 3pm: Meeting notes. Discussed the project roadmap."

# Starred/important entry
jrnl "*Important note. This entry is marked as starred."

# To a specific journal (if configured)
jrnl work "Completed the API refactor."
```

### Reading Entries

```bash
# Recent entries
jrnl -n 5                    # Last 5 entries

# By date
jrnl -on "last friday"       # Specific day
jrnl -from "last week"       # Since date
jrnl -from "2024-01-01" -to "2024-01-31"  # Date range

# By content
jrnl -contains "meeting"     # Search text
jrnl @project                # By tag
jrnl -starred                # Starred only
```

### Output Formats

```bash
# For agent parsing (structured data)
jrnl -n 10 --format json

# For user display
jrnl -n 10 --format markdown
jrnl -n 10 --format pretty

# Tags summary
jrnl --tags --format json
```

## Working with Multiple Journals

List configured journals:
```bash
jrnl --list --format json
```

Write to a specific journal:
```bash
jrnl <journal-name> "Entry text"
```

Read from a specific journal:
```bash
jrnl <journal-name> -n 5 --format json
```

## Required Tags

**Always include these tags on every entry you create:**

1. **`@agent`** - Marks this entry as created by an AI agent (distinguishes from manual user entries)
2. **`@repo/<owner>/<name>`** - When in a git repository, associates the entry with that project

### Example Entry Format

```bash
jrnl "Fixed auth bug. Resolved JWT expiration issue. @agent @repo/owner/name @bugfix"
```

## Repository-Aware Tagging

When working in a git repository, include a `@repo/<owner>/<name>` tag to associate the entry with that project.

### Detecting Repository Context

Before creating an entry, get the repo info:
```bash
git remote get-url origin 2>/dev/null | sed -E 's/.*[:/]([^/]+)\/([^/]+?)(\.git)?$/\1\/\2/'
```

This extracts `owner/repo` from either HTTPS or SSH remote URLs.

### Tagging Convention

Use hierarchical tags for repository context:
- `@repo/<owner>/<name>` - The repository (e.g., `@repo/anthropics/claude-code`)
- `@branch/<name>` - Current branch if relevant (e.g., `@branch/feature-auth`)

### Example: Recording Work in a Repository

```bash
# Get repo context
repo=$(git remote get-url origin 2>/dev/null | sed -E 's/.*[:/]([^/]+)\/([^/]+?)(\.git)?$/\1\/\2/' | tr '[:upper:]' '[:lower:]')

# Create entry with required tags
jrnl "Fixed auth bug. Resolved the JWT expiration issue in middleware. @agent @repo/${repo} @bugfix"
```

### Querying by Repository

Find all entries for a specific repository:
```bash
jrnl @repo/owner/reponame --format json
```

Find entries across all repos:
```bash
jrnl -contains "@repo/" --format json
```

### Automatic Context Helper

Use the helper script for automatic repo tagging:
```bash
# From scripts/jrnl-repo.sh
jrnl-repo "Fixed the bug. Details here."
# Automatically adds @repo/owner/name based on current directory
```

## Best Practices

1. **Always include `@agent` tag** - Every entry you create must have `@agent`
2. **Always tag with repo context** - When in a git repo, include `@repo/owner/name`
3. **Use hierarchical tags** - Prefix words with `@` to create searchable tags: `@meeting @project-x`
4. **Use timestamps** - Include time context: `"yesterday at 2pm: ..."` or `"last monday: ..."`
5. **Star important entries** - Prefix with `*` for important items
6. **Title convention** - First sentence (up to `.`, `?`, `!`, or `:`) becomes the title

## Common Workflows

### Recording for the User
When the user asks you to "note", "remember", "log", or "journal" something:
```bash
jrnl "Summary title. Full details here with @agent @relevant @tags."
```

### Retrieving Context
When you need historical context or the user asks "what did I..." or "when did I...":
```bash
# All entries (user and agent) matching keyword
jrnl -contains "keyword" --format json

# Only agent-created entries
jrnl @agent -contains "keyword" -and --format json

# All entries for current repo
jrnl @repo/owner/name --format json
```

### Daily Summary
```bash
# All entries today
jrnl -on today --format markdown

# Only agent entries today
jrnl @agent -on today -and --format markdown
```

### Filtering by Source

By default, queries return **all entries** (both manual user entries and agent-created). To filter:

```bash
# Agent-created only
jrnl @agent --format json

# User-created only (exclude agent)
jrnl -not @agent --format json

# Agent entries for specific repo
jrnl @agent @repo/owner/name -and --format json
```

### Processing Entries Programmatically
Use `--format json` for structured data you can parse. See [references/json-schema.md](references/json-schema.md) for the output format.

## Configuration

The jrnl config file is at `~/.config/jrnl/jrnl.yaml`. To check current config:
```bash
cat ~/.config/jrnl/jrnl.yaml
```

For detailed command reference, see [references/commands.md](references/commands.md).
