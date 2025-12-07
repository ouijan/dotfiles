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
plugins=(git tmux docker)

source $ZSH/oh-my-zsh.sh


# Powerlevel10k configuration (zsh theme)
# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh


# -----------------------------------------------
# Environment variables
# -----------------------------------------------
# Config directory
export XDG_CONFIG_HOME="$HOME/.config"

# Default editor
export EDITOR=nvim

# -----------------------------------------------
# Aliases
# -----------------------------------------------
source ~/.aliases.zsh

# -----------------------------------------------
# CLI tools
# -----------------------------------------------
# Command-line fuzzy finder: https://github.com/junegunn/fzf
source <(fzf --zsh)

# Smarter cd command: https://github.com/ajeetdsouza/zoxide
eval "$(zoxide init zsh)"
