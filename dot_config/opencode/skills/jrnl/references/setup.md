# jrnl Setup Guide

## Installation

```bash
pipx install jrnl
```

If on Python 3.14+, use Python 3.13:
```bash
pipx install jrnl --python python3.13
```

## First Run

Run `jrnl` once to trigger interactive setup:
```bash
jrnl
```

This creates `~/.config/jrnl/jrnl.yaml`.

## Configuration File

Location: `~/.config/jrnl/jrnl.yaml`

### Example Configuration

```yaml
colors:
  body: none
  date: cyan
  tags: yellow
  title: bold
default_hour: 9
default_minute: 0
editor: ""
encrypt: false
highlight: true
indent_character: "|"
journals:
  default:
    journal: /Users/username/.local/share/jrnl/journal.txt
  work:
    journal: /Users/username/.local/share/jrnl/work.txt
  personal:
    journal: /Users/username/.local/share/jrnl/personal.txt
linewrap: 79
tagsymbols: "@"
template: false
timeformat: "%F %r"
version: v4.2.1
```

### Adding a New Journal

Edit `~/.config/jrnl/jrnl.yaml` and add under `journals:`:

```yaml
journals:
  default:
    journal: ~/.local/share/jrnl/journal.txt
  work:
    journal: ~/.local/share/jrnl/work.txt
  ideas:
    journal: ~/.local/share/jrnl/ideas.txt
```

### Encryption

To encrypt a journal:
```bash
jrnl work --encrypt
```

To decrypt:
```bash
jrnl work --decrypt
```

### External Editor

Set your preferred editor:
```yaml
editor: "code --wait"  # VS Code
editor: "nvim"         # Neovim
editor: "nano"         # Nano
```

Then use:
```bash
jrnl   # Opens editor for new entry
jrnl -n 1 --edit  # Edit last entry
```

## Recommended Journal Structure

For agent-assisted workflows, consider:

- `default` - General notes and thoughts
- `work` - Work-related logs
- `standup` - Daily standup notes
- `decisions` - Decision log with rationale
- `ideas` - Ideas and brainstorms

Each can have different settings (encryption, location, etc.).
