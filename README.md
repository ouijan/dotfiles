# dotfiles

Personal dotfiles managed with [chezmoi](https://www.chezmoi.io/).

## New machine setup

1. Install chezmoi and apply (prompts for git email + Bitwarden Secrets machine token):

   ```bash
   sh -c "$(curl -fsLS get.chezmoi.io)" -- -b ~/.local/bin init --apply git@github.com:ouijan/dotfiles.git
   ```

   The secrets template needs the `bws` CLI at apply time. If the first apply fails
   on it, install packages (step 2) and re-run `chezmoi apply`.

2. Install packages and shell (Oh My Zsh, p10k, plugins):

   ```bash
   ~/.local/bin/ouijan-install
   ```

   Supports macOS (brew), Arch (pacman), and Debian/Ubuntu (apt).

3. Switch shell and finish:

   ```bash
   chsh -s "$(command -v zsh)"
   ```

   Neovim plugins bootstrap on first launch.

## Updating

- Any machine: `chezmoi update` (pull + apply)
- Primary (macOS) only: `chezmoi add`/`re-add` auto-commits and pushes to main
  (configured in `.chezmoi.toml.tmpl`). Remote machines are consumers.

## Layout

```
dot_config/           ~/.config/  (nvim, tmux, herdr, opencode, lazygit, ...)
dot_pi/agent/         pi coding agent (settings, extensions, themes)
dot_zshrc             zsh + Oh My Zsh + p10k
private_dot_local/bin CLI scripts (~/.local/bin)
.chezmoitemplates/    per-OS package install scripts
.chezmoiignore        OS-conditional exclusions (macOS-only tools skipped on Linux)
.chezmoi.toml.tmpl    machine config: prompts for email + bws token
```

## Secrets

`~/.secrets.zsh` is generated at apply time from Bitwarden Secrets Manager via the
`bws` CLI and the machine access token stored in `~/.config/chezmoi/chezmoi.toml`.
No secrets are committed to this repo.
