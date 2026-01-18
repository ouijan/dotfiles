# dotfiles

Personal dotfiles managed with [chezmoi](https://www.chezmoi.io/).

## Quick Start (New Machine)

```bash
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply <github-username>
```

## Installation (Existing Clone)

```bash
# Apply dotfiles first
chezmoi init --source ~/dotfiles --apply

# Then run full setup (packages, shell plugins, etc.)
ouijan-install
```

## Updating

```bash
chezmoi update
```

## Structure

```
dotfiles/
├── dot_config/              # ~/.config/
│   ├── aerospace/           # macOS window manager (macOS only)
│   ├── alacritty/           # Terminal emulator
│   ├── lazygit/             # Git TUI
│   ├── nvim/                # Neovim configuration
│   ├── opencode/            # OpenCode AI assistant
│   └── tmux/                # Tmux configuration
├── private_dot_local/
│   └── bin/                 # CLI scripts (~/.local/bin/)
├── dot_zshrc                # Zsh configuration
├── dot_p10k.zsh             # Powerlevel10k theme
├── dot_gitconfig.tmpl       # Git config (templated)
├── .chezmoiignore           # OS-conditional file exclusions
└── .chezmoiexternal.toml    # External dependencies
```

## CLI Scripts

Scripts installed to `~/.local/bin/` and available in PATH on all systems.

| Command | Description | Platforms |
|---------|-------------|-----------|
| `ouijan-cli` | App launcher helper for aerospace/shortcuts | macOS only |
| `ouijan-install` | Bootstrap script for new machines (packages, shell, configs) | All |
| `ouijan-pr` | Create GitHub PR with Gemini AI-generated description | All |
| `ouijan-tmux` | Launch standardized tmux workspace (nvim, opencode, lazygit) | All |

### Usage Examples

```bash
# Bootstrap a new machine
ouijan-install

# Start a tmux dev session in current directory
ouijan-tmux

# Start a named tmux session
ouijan-tmux my-project

# Create a PR with AI-generated description
ouijan-pr

# Launch apps via aerospace (macOS)
ouijan-cli browser https://github.com
ouijan-cli terminal
ouijan-cli editor
```

## Configurations

### Shell (Zsh + Oh My Zsh)

- **Theme**: Powerlevel10k
- **Plugins**: zsh-syntax-highlighting, zsh-autosuggestions, fzf-tab, nvm
- **Tools**: fzf (fuzzy finder), zoxide (smart cd), eza (ls replacement)

### Neovim

LazyVim-based configuration with LSP support.

### Tmux

Custom keybindings with Catppuccin theme.

### Aerospace (macOS)

Tiling window manager configuration.

## Platform Support

| Platform | Status |
|----------|--------|
| macOS (Homebrew) | Full support |
| Arch Linux (pacman) | Full support |

OS-specific files are automatically included/excluded via `.chezmoiignore`.
