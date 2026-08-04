This is a chezmoi repo. It is used to manage the dotfiles of the user. The files in this repo are symlinked to the home directory.

- When attempting to read, write or update anything in the ~/.config directory, instead edit the files here.
- Managed config also includes `~/.pi/agent` (source: `dot_pi/agent`). Edit here, then `chezmoi apply`.

## chezmoi auto-commit

`~/.config/chezmoi/chezmoi.toml` sets `git.autoCommit = true` and `git.autoPush = true`.
Any `chezmoi add` / `chezmoi forget` / `chezmoi re-add` commits **and pushes to main immediately**,
sweeping in every dirty file in the working tree. This is intentional and overrides the global
"never commit/push to main" rule for this repo only.

- Before running a chezmoi write command, check `git status` and warn about unrelated dirty files.
- Plain `git`/`edit` changes to source files do NOT trigger a commit; only chezmoi commands do.

## pi config

- Runtime state (`auth.json`, `models-store.json`, `sessions/`, `npm/`, `trust.json`) is in `.chezmoiignore`.
- `dot_pi/agent/settings.json` is rewritten by pi at runtime; run `chezmoi re-add ~/.pi/agent/settings.json` after changing settings in the TUI.
- pi packages are declared in `settings.json` `packages[]`; `pi install` restores them. Don't vendor package source.
