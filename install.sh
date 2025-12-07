#!/bin/bash

# ------------------------------------------------------
# MacOS packages 
# ------------------------------------------------------
if command -v brew &> /dev/null; then
    echo "Installing MacOS packages."
    brew install \
        zsh \
        git \
        curl \
        wget \
        stow \
        neovim \
        tmux \
        lazygit \
        zoxide \
        tealdeer \
        eza \
        fzf
fi

# ------------------------------------------------------
# Arch Linux packages 
# ------------------------------------------------------
if command -v pacman >/dev/null 2>&1; then
    echo "Installing Arch packages."
    pacman -S --needed \
        zsh \
        git \
        curl \
        wget \
        stow \
        neovim \
        tmux \
        lazygit \
        zoxide \
        tealdeer \
        eza \
        fzf
fi

# ------------------------------------------------------
# Univeral setup
# ------------------------------------------------------
# Install Oh My Zsh 
if [ -d "$HOME/.oh-my-zsh" ]; then
    echo "Oh My Zsh already installed."
else
    echo "Installing Oh My Zsh..."
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
fi

# Install Powerlevel10k theme
if [ -d "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k" ]; then
    echo "Powerlevel10k theme already installed."
else
    echo "Installing Powerlevel10k theme..."
    git clone --depth=1 https://github.com/romkatv/powerlevel10k.git "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k"
fi

./sync-configs.sh
