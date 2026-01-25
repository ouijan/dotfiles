#!/usr/bin/env bash
# jrnl-repo: Create jrnl entries with automatic repository and agent tagging
# Usage: jrnl-repo [journal] "Entry text"
#
# Automatically adds:
#   @agent           - Marks entry as created by an AI agent
#   @repo/owner/name - Current git repository context
#   @branch/name     - Current branch (optional, with -b flag)

set -euo pipefail

usage() {
    cat <<EOF
Usage: jrnl-repo [options] [journal] "Entry text"

Creates a jrnl entry with automatic repository context tagging.

Options:
  --branch, -b    Include current branch as @branch/name tag
  --help, -h      Show this help

Arguments:
  journal         Optional journal name (uses default if omitted)
  "Entry text"    The journal entry (required)

Examples:
  jrnl-repo "Fixed the auth bug. Updated JWT validation."
  jrnl-repo work "Completed API refactor."
  jrnl-repo -b "Started feature work. Initial scaffolding."

The script automatically appends:
  @agent                  Always added to mark agent-created entries
  @repo/owner/reponame    Based on git remote origin
  @branch/name            If --branch flag is used
EOF
}

# Parse options
include_branch=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --branch|-b)
            include_branch=true
            shift
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        -*)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
        *)
            break
            ;;
    esac
done

# Check if we're in a git repo
if ! git rev-parse --git-dir &>/dev/null; then
    echo "Warning: Not in a git repository. Creating entry with @agent tag only." >&2
    # Still add @agent tag even without repo context
    if [[ $# -eq 1 ]]; then
        jrnl "$1 @agent"
    elif [[ $# -eq 2 ]]; then
        jrnl "$1" "$2 @agent"
    else
        echo "Error: Expected 1 or 2 arguments" >&2
        exit 1
    fi
    exit 0
fi

# Get repository info from remote origin
get_repo_tag() {
    local remote_url
    remote_url=$(git remote get-url origin 2>/dev/null) || return 1
    
    # Extract owner/repo from various URL formats:
    # git@github.com:owner/repo.git
    # https://github.com/owner/repo.git
    # https://github.com/owner/repo
    echo "$remote_url" | sed -E 's/.*[:/]([^/]+)\/([^/]+?)(\.git)?$/\1\/\2/' | tr '[:upper:]' '[:lower:]'
}

# Get current branch name
get_branch_tag() {
    git branch --show-current 2>/dev/null | tr '[:upper:]' '[:lower:]'
}

# Build the repo tag
repo=$(get_repo_tag)
if [[ -z "$repo" ]]; then
    echo "Warning: Could not determine repository. Creating entry with @agent tag only." >&2
    if [[ $# -eq 1 ]]; then
        jrnl "$1 @agent"
    elif [[ $# -eq 2 ]]; then
        jrnl "$1" "$2 @agent"
    else
        echo "Error: Expected 1 or 2 arguments" >&2
        exit 1
    fi
    exit 0
fi

repo_tag="@repo/${repo}"

# Optionally add branch tag
branch_tag=""
if [[ "$include_branch" == true ]]; then
    branch=$(get_branch_tag)
    if [[ -n "$branch" ]]; then
        branch_tag=" @branch/${branch}"
    fi
fi

# Determine if first arg is a journal name or the entry
# jrnl uses journal names that don't start with quotes or special chars
if [[ $# -eq 1 ]]; then
    # Single argument: it's the entry text
    entry="$1"
    journal=""
elif [[ $# -eq 2 ]]; then
    # Two arguments: first is journal, second is entry
    journal="$1"
    entry="$2"
else
    echo "Error: Expected 1 or 2 arguments" >&2
    usage >&2
    exit 1
fi

# Append tags to the entry
# Always include @agent, plus repo and optionally branch
tagged_entry="${entry} @agent ${repo_tag}${branch_tag}"

# Create the entry
if [[ -n "$journal" ]]; then
    jrnl "$journal" "$tagged_entry"
else
    jrnl "$tagged_entry"
fi

echo "Entry created with tags: @agent ${repo_tag}${branch_tag}"
