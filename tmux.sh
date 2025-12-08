#!/bin/bash

# Determine the session name. Use the first argument if provided,
# otherwise, default to the current directory's name.
# The `tr` command replaces periods with underscores for tmux compatibility.
if [ -n "$1" ]; then
    SESSION_NAME="$1"
else
    SESSION_NAME=$(basename "$(pwd)" | tr . _)
fi

# Check if the session already exists. If it does, just attach.
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Session '$SESSION_NAME' already exists. Attaching."
    tmux attach-session -t "$SESSION_NAME"
    exit 0
fi

echo "Creating new session: $SESSION_NAME"
tmux new-session -d -s "$SESSION_NAME"
tmux new-window -t "$SESSION_NAME:1" -n "nvim"
tmux send-keys -t "$SESSION_NAME:1" "nvim" C-m

tmux new-window -t "$SESSION_NAME:2" -n "zsh"
tmux split-window -h -t "$SESSION_NAME:2" 

tmux new-window -t "$SESSION_NAME:3" -n "lazygit"
tmux send-keys -t "$SESSION_NAME:3" "lazygit" C-m


tmux select-window -t "$SESSION_NAME:1"
tmux attach-session -t "$SESSION_NAME"
