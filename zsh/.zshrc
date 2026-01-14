# -----------------------------------------------
# Environment variables
# -----------------------------------------------
# Config directory
export XDG_CONFIG_HOME="$HOME/.config"

# Default editor
export EDITOR=nvim
export MANPAGER="nvim +Man!"

# -----------------------------------------------
# Oh My Zsh and Powerlevel10k theme setup
# -----------------------------------------------

# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# Oh My Zsh 
export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="powerlevel10k/powerlevel10k"


# -----------------------------------------------
# ZSH Plugins
# -----------------------------------------------
plugins=(
    zsh-syntax-highlighting
    zsh-autosuggestions
    fzf-tab
    nvm
)

# zsh-completions - https://github.com/zsh-users/zsh-completions
fpath+=${ZSH_CUSTOM:-${ZSH:-~/.oh-my-zsh}/custom}/plugins/zsh-completions/src
autoload -U compinit && compinit

# Load Oh My Zsh + Powerlevel10k
source $ZSH/oh-my-zsh.sh
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# -----------------------------------------------
# History settings
# -----------------------------------------------
HISTFILE=~/.zsh_history
HISTSIZE=5000
SAVEHIST=$HISTSIZE
HISTDUP=erase
setopt appendhistory
setopt sharehistory
setopt hist_ignore_space
setopt hist_ignore_all_dups
setopt hist_save_no_dups
setopt hist_ignore_dups
setopt hist_find_no_dups

# -----------------------------------------------
# Completion settings
# -----------------------------------------------
zstyle ':completion:*:git-checkout:*' sort false
zstyle ':completion:*:descriptions' format '[%d]'
zstyle ':completion:*' list-colors ${(s.:.)LS_COLORS}
zstyle ':completion:*' menu no
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'eza -1 --color=always $realpath'
zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'
zstyle ':fzf-tab:*' switch-group '<' '>'
# zstyle ':fzf-tab:*' fzf-command ftb-tmux-popup

# -----------------------------------------------
# Key bindings
# -----------------------------------------------
bindkey '^y' autosuggest-accept
bindkey '^p' history-search-backward
bindkey '^n' history-search-forward

# -----------------------------------------------
# Aliases
# -----------------------------------------------
# Neovim aliases
alias vim="nvim"
alias vi="nvim"

# eza aliases (ls replacement)
alias ls="eza -ha --icons"
alias ll="eza -lha --icons"
alias lt="eza -TL 2 --icons"

# Git aliases
alias lg="lazygit"

# -----------------------------------------------
# CLI tools
# -----------------------------------------------

# MacOS specific
if [[ -f "/opt/homebrew/bin/brew" ]] then
  # Add Homebrew libs to PATH
  eval "$(/opt/homebrew/bin/brew shellenv)"

  # Add local bin to PATH
  export PATH="$PATH:/Users/tobyharris/.local/bin"
fi

# Arch specific
if [[ -f "/usr/bin/pacman" ]] then
    eval "$(keychain --eval --quiet)"
fi

# Command-line fuzzy finder: https://github.com/junegunn/fzf
source <(fzf --zsh)

# Smarter cd command: https://github.com/ajeetdsouza/zoxide
eval "$(zoxide init zsh)"


# pnpm
export PNPM_HOME="/Users/tobyharris/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

# The next line updates PATH for the Google Cloud SDK.
if [ -f '/Users/tobyharris/Downloads/google-cloud-sdk/path.zsh.inc' ]; then . '/Users/tobyharris/Downloads/google-cloud-sdk/path.zsh.inc'; fi

# The next line enables shell command completion for gcloud.
if [ -f '/Users/tobyharris/Downloads/google-cloud-sdk/completion.zsh.inc' ]; then . '/Users/tobyharris/Downloads/google-cloud-sdk/completion.zsh.inc'; fi

# bun completions
[ -s "/Users/tobyharris/.bun/_bun" ] && source "/Users/tobyharris/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
# The following lines have been added by Docker Desktop to enable Docker CLI completions.
fpath=(/Users/tobyharris/.docker/completions $fpath)
autoload -Uz compinit
compinit
# End of Docker CLI completions
