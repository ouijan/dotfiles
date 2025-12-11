#!/bin/bash

if [[ ! -z "$(git status --porcelain)" ]]; then
    echo "Working tree is not clean. There are uncommitted changes."
    exit 1
fi


## Determine the default target branch (master or main)
target_branch=$(git show-ref --verify --quiet refs/remotes/origin/master && echo
      "master" || echo "main")
target_remote_branch="origin/$target_branch"

if [[ -z "$target_branch" ]]; then
    echo "Could not determine the default target branch (master or main)."
    exit 1
fi

# Generate pull request description using Gemini AI
prompt="Write a concise pull request description for these changes. Be sure to include the purpose of the changes and any relevant context. Fill out the @.github/pull_request_template.md template as appropriate. \n $(git diff $target_remote_branch)"
gemini_response=$(echo "$prompt" | gemini --format json)
initial_body=$(echo "$gemini_response" | jq -r '.response')

# Open the editor for user to edit the PR description
temp_file=$(mktemp) # Create a temporary file
trap 'rm -f "$temp_file"' EXIT # Clean up temp file on exit
echo "$initial_body" > "$temp_file" # Write initial body to temp file
nvim "$temp_file" < /dev/tty # Open nvim for editing
final_body=$(cat "$temp_file") # Read the edited content

# Create the pull request using GitHub CLI
pr_url=$(gh pr create --base "$target_branch" --assignee @me --fill --body "$final_body" --draft)

# Open the pull request URL in the default web browser
echo "Opening pull request $pr_url"
open "$pr_url"



