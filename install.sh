#!/bin/bash

log_header() {
cat << EOF
------------------------------------------------------
    $1
------------------------------------------------------
EOF
}

# ------------------------------------------------------
# MacOS packages 
# ------------------------------------------------------
if command -v brew &> /dev/null; then
    log_header "Installing MacOS packages"
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
        fzf \
        bitwarden
fi

# ------------------------------------------------------
# Arch Linux packages 
# ------------------------------------------------------
if command -v pacman >/dev/null 2>&1; then
    log_header "Installing Arch Linux packages"
    sudo cachyos-rate-mirrors
    sudo pacman -Syu \
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
# Shell setup
# ------------------------------------------------------
log_header "Univeral setup"

# Install Oh My Zsh 
if [ -d "$HOME/.oh-my-zsh" ]; then
    echo "Oh My Zsh already installed."
else
    echo "Installing Oh My Zsh"
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

    # Install zsh plugins
    git clone https://github.com/zsh-users/zsh-syntax-highlighting.git \
        ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
    git clone https://github.com/zsh-users/zsh-completions.git \
        ${ZSH_CUSTOM:-${ZSH:-~/.oh-my-zsh}/custom}/plugins/zsh-completions
    git clone https://github.com/zsh-users/zsh-autosuggestions \
        ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
    git clone https://github.com/Aloxaf/fzf-tab \
        ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/fzf-tab
fi

# Install Powerlevel10k theme
if [ -d "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k" ]; then
    echo "Powerlevel10k theme already installed."
else
    echo "Installing Powerlevel10k theme"
    git clone --depth=1 https://github.com/romkatv/powerlevel10k.git "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k"
fi


# ------------------------------------------------------
# Node setup
# ------------------------------------------------------
# TODO: Install node etc
# corepack enable pnpm

# ------------------------------------------------------
# Configs setup
# ------------------------------------------------------
./sync-configs.sh
