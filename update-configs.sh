#!/bin/bash


echo "Refreshing submodules..."
git submodule update --init --recursive


echo "Relinking stow-managed files for headless setup..."

# MacOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    stow -R -v -n aerospace ghostty
fi

# Linux
# if [[ "$OSTYPE" == "darwin"* ]]; then
#     stow -R -v -n hypr waybar ghostty
# fi

stow -R -v -n lazygit nvim tmux zsh



echo "Done! 🎉"
