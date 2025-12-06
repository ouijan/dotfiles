#!/bin/bash


echo "Refreshing submodules..."
git submodule update --init --recursive


echo "Relinking stow-managed files for headless setup..."

# MacOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    stow -R -v aerospace ghostty
fi

# Linux
# if [[ "$OSTYPE" == "darwin"* ]]; then
#     stow -R -v hypr waybar ghostty
# fi

# Platform agnostic
stow -R -v git nvim tmux zsh lazygit

echo "Done! 🎉"
