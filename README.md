# dotfiles

Personal dotfiles managed with [chezmoi](https://www.chezmoi.io/).

## Quick Start (New Machine)

```bash
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply <github-username>
```

## Installation (Existing Clone)

```bash
# Full setup (packages + configs)
./install.sh

# Or just apply dotfiles
chezmoi init --source ~/dotfiles --apply
```

## Updating

```bash
chezmoi update
```

## Structure

- `dot_config/` - XDG config files (`~/.config/`)
- `dot_gemini/` - Gemini CLI config (`~/.gemini/`)
- `dot_zshrc`, `dot_p10k.zsh`, etc. - Home directory dotfiles
- `.chezmoiignore` - OS-conditional file exclusions
- `.chezmoiexternal.toml` - External dependencies (e.g., tmux catppuccin theme)
