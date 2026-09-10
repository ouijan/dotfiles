#!/bin/sh
# Print the label of the active workspace.
# In a tab_bar_right command entry Herdr sets HERDR_ACTIVE_WORKSPACE_ID.
# Inside a pane it sets HERDR_WORKSPACE_ID instead.
# With neither, fall back to whichever workspace the UI reports as focused.
ws="${HERDR_ACTIVE_WORKSPACE_ID:-${HERDR_WORKSPACE_ID:-}}"

"${HERDR_BIN_PATH:-herdr}" workspace list | jq -r --arg ws "$ws" '
  .result.workspaces
  | (map(select(.workspace_id == $ws)) + map(select(.focused)))
  | first
  | .label // empty
'
