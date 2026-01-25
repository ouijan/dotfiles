#!/usr/bin/env bash
# jrnl-query: Helper script for agent-friendly jrnl queries
# Usage: jrnl-query <command> [args...]

set -euo pipefail

usage() {
    cat <<EOF
Usage: jrnl-query <command> [options]

General Commands:
  recent [n] [journal]     Get last n entries (default: 5) as JSON
  today [journal]          Get today's entries as JSON
  week [journal]           Get this week's entries as JSON
  search <text> [journal]  Search entries containing text
  tags [journal]           Get all tags with counts as JSON
  journals                 List all configured journals as JSON
  summary [journal]        Get entry count and date range

Repository Commands:
  repo [owner/name]        Get entries for a repo (auto-detects if in git dir)
  repos                    List all repositories with entry counts
  thisrepo [n]             Get last n entries for current repo (default: 10)

Filtered Commands (agent-only):
  agent [n]                Get last n agent-created entries (default: 10)
  agent-thisrepo [n]       Get agent entries for current repo (default: 10)

All commands return ALL entries (user and agent) unless using the 'agent' prefix.

Options:
  journal    Optional journal name (uses default if omitted)

Examples:
  jrnl-query recent 10
  jrnl-query search "meeting" work
  jrnl-query today
  jrnl-query tags
  jrnl-query repo anthropics/claude-code
  jrnl-query thisrepo 5
  jrnl-query repos
  jrnl-query agent 20
  jrnl-query agent-thisrepo
EOF
}

cmd="${1:-}"
shift || true

case "$cmd" in
    recent)
        n="${1:-5}"
        journal="${2:-}"
        if [[ -n "$journal" ]]; then
            jrnl "$journal" -n "$n" --format json
        else
            jrnl -n "$n" --format json
        fi
        ;;
    today)
        journal="${1:-}"
        if [[ -n "$journal" ]]; then
            jrnl "$journal" -on today --format json
        else
            jrnl -on today --format json
        fi
        ;;
    week)
        journal="${1:-}"
        if [[ -n "$journal" ]]; then
            jrnl "$journal" -from "last monday" --format json
        else
            jrnl -from "last monday" --format json
        fi
        ;;
    search)
        text="${1:-}"
        journal="${2:-}"
        if [[ -z "$text" ]]; then
            echo "Error: search requires text argument" >&2
            exit 1
        fi
        if [[ -n "$journal" ]]; then
            jrnl "$journal" -contains "$text" --format json
        else
            jrnl -contains "$text" --format json
        fi
        ;;
    tags)
        journal="${1:-}"
        if [[ -n "$journal" ]]; then
            jrnl "$journal" --tags --format json
        else
            jrnl --tags --format json
        fi
        ;;
    journals)
        jrnl --list --format json
        ;;
    summary)
        journal="${1:-}"
        if [[ -n "$journal" ]]; then
            entries=$(jrnl "$journal" --format json)
        else
            entries=$(jrnl --format json)
        fi
        echo "$entries" | python3 -c "
import json, sys
data = json.load(sys.stdin)
entries = data.get('entries', [])
if entries:
    dates = [e['date'] for e in entries]
    print(json.dumps({
        'count': len(entries),
        'earliest': min(dates),
        'latest': max(dates),
        'tags': data.get('tags', {})
    }, indent=2))
else:
    print(json.dumps({'count': 0, 'earliest': None, 'latest': None, 'tags': {}}))
"
        ;;
    repo)
        # Get entries for a specific repo, or auto-detect from current directory
        repo_arg="${1:-}"
        if [[ -z "$repo_arg" ]]; then
            # Try to auto-detect from current git repo
            if git rev-parse --git-dir &>/dev/null; then
                repo_arg=$(git remote get-url origin 2>/dev/null | sed -E 's/.*[:/]([^/]+)\/([^/]+?)(\.git)?$/\1\/\2/' | tr '[:upper:]' '[:lower:]')
            fi
        fi
        if [[ -z "$repo_arg" ]]; then
            echo "Error: No repo specified and not in a git directory" >&2
            exit 1
        fi
        # Normalize to lowercase
        repo_arg=$(echo "$repo_arg" | tr '[:upper:]' '[:lower:]')
        jrnl "@repo/${repo_arg}" --format json
        ;;
    thisrepo)
        # Get entries for current repo with optional limit
        n="${1:-10}"
        if ! git rev-parse --git-dir &>/dev/null; then
            echo "Error: Not in a git repository" >&2
            exit 1
        fi
        repo=$(git remote get-url origin 2>/dev/null | sed -E 's/.*[:/]([^/]+)\/([^/]+?)(\.git)?$/\1\/\2/' | tr '[:upper:]' '[:lower:]')
        if [[ -z "$repo" ]]; then
            echo "Error: Could not determine repository from git remote" >&2
            exit 1
        fi
        jrnl "@repo/${repo}" -n "$n" --format json
        ;;
    repos)
        # List all repositories with entry counts
        jrnl --format json | python3 -c "
import json, sys, re
data = json.load(sys.stdin)
tags = data.get('tags', {})
repos = {}
for tag, count in tags.items():
    if tag.startswith('@repo/'):
        repo_name = tag[6:]  # Remove '@repo/' prefix
        repos[repo_name] = count
# Sort by count descending
sorted_repos = dict(sorted(repos.items(), key=lambda x: x[1], reverse=True))
print(json.dumps({'repositories': sorted_repos, 'total_repos': len(repos)}, indent=2))
"
        ;;
    agent)
        # Get agent-created entries
        n="${1:-10}"
        jrnl "@agent" -n "$n" --format json
        ;;
    agent-thisrepo)
        # Get agent-created entries for current repo
        n="${1:-10}"
        if ! git rev-parse --git-dir &>/dev/null; then
            echo "Error: Not in a git repository" >&2
            exit 1
        fi
        repo=$(git remote get-url origin 2>/dev/null | sed -E 's/.*[:/]([^/]+)\/([^/]+?)(\.git)?$/\1\/\2/' | tr '[:upper:]' '[:lower:]')
        if [[ -z "$repo" ]]; then
            echo "Error: Could not determine repository from git remote" >&2
            exit 1
        fi
        jrnl "@agent" "@repo/${repo}" -and -n "$n" --format json
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        echo "Unknown command: $cmd" >&2
        usage >&2
        exit 1
        ;;
esac
