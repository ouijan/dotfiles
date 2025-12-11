#!/bin/bash

if [[ ! -z "$(git status --porcelain)" ]]; then
    echo "Working tree is not clean. There are uncommitted changes."
    exit 1
fi

target_branch=$(git show-ref --verify --quiet refs/remotes/origin/master && echo "origin/master" || \
    git show-ref --verify --quiet refs/remotes/origin/main && echo "origin/main")

# prompt="Write a concise pull request description for these changes. Be sure to include the purpose of the changes and any relevant context. Fill out the @.github/pull_request_template.md template as appropriate. \n $(git diff $target_branch)"
#
# gemini_response=$(echo "$prompt" | gemini  --output-format json)
# pr_body=$(echo "$gemini_response" | jq -r '.response')

pr_body="test pr body"

pr_response=$(gh pr create --base "$target_branch" --assignee @me --fill --body "$pr_body" --editor --draft --dry-run)

echo "Generated Pull Request Description:"
echo "$pr_response"
# pr_url=$(echo "$pr_response" | jq -r '.url')
#
# echo "Pull request created: $pr_url"


