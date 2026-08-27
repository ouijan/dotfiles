# weave — personal pi extension

A single, chezmoi-managed pi extension under the `weave` namespace. Starts as a
lean replacement for the default status line (footer) and grows into the home
for all personal pi customizations, without pulling in package bloat like
pi-powerline-footer (queue system, stash, vibes, welcome overlay, bash mode).

## Desired outcomes (agreed 2026-02)

1. **A footer I actually read.** Two or more lines under the input box showing
   only signal: model + thinking level, context usage %, session cost, git
   branch + dirty state, cwd. No decoration for its own sake.
2. **Fast and quiet.** No async work on every render; git status cached and
   invalidated on file writes. Zero footprint when idle.
3. **Owned, not installed.** Lives in `dot_pi/agent/extensions/weave/`,
   versioned by chezmoi, applied with `chezmoi apply`. No npm publish, no
   `pi install`, no upstream churn.
4. **One namespace for future customization.** New commands are `/weave-*`
   (or a single `/weave` command with subcommands), statuses registered under
   the `weave` key, config under a `weave` settings block. Adding a new
   customization means adding a module, not a new package. Future candidates:
   herdr / subagent / MCP displays and helpers.
5. **Declaratively configured, like tmux/nvim powerlines.** Layout is data,
   not code: segments are declared by name in settings (lualine/tmux-powerline
   style `left | middle | right` zones per line). Changing the footer means
   editing settings, not TypeScript.
6. **Themed, not hardcoded.** Nerd Font glyph separators (Ghostty confirmed);
   colors come from the active theme (`catppuccin`) via `theme.fg(...)`.
7. **On by default.** Active at startup; `/weave footer off` (or similar)
   restores the built-in footer instantly.

### Decisions log

- Config style: declarative segment lists in settings, mirroring the
  `packages`/`extensions` declaration pattern and tmux/nvim powerline plugins.
- Layout: 2+ lines, each with `left` / `middle` / `right` zones.
- Startup: footer enabled automatically when the extension loads.
- Scope: powerline first. Herdr/subagent/MCP displays and helpers come later
  as weave modules.

From the grilling session (Q1–Q7):

- **Rendering model: text-only.** No background styling. Segments return
  `{ text, color }`; the engine resolves colors and joins. The join step is a
  pluggable seam so a bg-powerline style could be added later without
  changing the segment contract. Full powerline (bg + chevron transitions)
  was evaluated and rejected as strictly more complex: transition-color
  logic, a bg palette pi's theme doesn't provide, two-channel color config,
  segment-granular truncation.
- **Colors: per-segment config blocks.** Each segment instance has its own
  block under `segments`, with color fields accepting a pi theme token
  (`"dim"`, `"warning"`, ...) or a hex string (`"#a6e3a1"` → raw truecolor
  ANSI). Stateful segments use named fields (`warnColor`, `errorColor`).
  Context thresholds (70/90) are hardcoded; only their colors are exposed.
- **Segment keys are instance names, not types.** A key matching a built-in
  name gets that behavior; unknown keys warn in phase 1 and are reserved for
  declarative custom segments later (e.g. `{ "exec": "..." }` blocks).
  Adding exec segments is purely additive — no schema migration.
- **Reload: pi's own `/reload`.** Config is read whenever the footer is
  enabled, and `/reload` re-instantiates the extension and re-fires
  `session_start` (reason `"reload"`), so a weave-specific reload command was
  redundant and has been dropped; `/weave` still toggles. No file watcher (pi
  rewrites settings.json at runtime; watching it means debounce machinery
  running forever for a first-week need).
- **Separator: one configurable character, default `·`.** Directional glyph
  pairs and lualine's component/section split are pointless in text-only
  mode. Default look diverges from pi (dots vs spaces) — "mirror pi" means
  placement, not pixels.
- **Overflow: drop whole segments, fixed rule.** Right zone outside-in, then
  middle, then left; ellipsis-truncate only when a single surviving segment
  exceeds the width. Never garble mid-segment. Per-segment `priority`
  (p10k-style) is a known additive upgrade if the fixed rule ever drops the
  wrong thing.
- **No line wrapping, ever.** Wrapping makes footer height depend on
  terminal width and token counts → editor viewport jitter, and wrapped zone
  alignment has no natural semantics. Want more visible info? Declare more
  lines — the layout is already multi-line. A per-line
  `"overflow": "drop" | "wrap"` field is the additive escape hatch if a real
  narrow-pane use case emerges.
- Default layout mirrors pi's built-in footer placement; user tweaks from
  there:
  - line 1: `cwd git session` (left)
  - line 2: `tokens cost context` (left) · `model thinking` (right)
  - line 3: `statuses` (left, collapses when empty)
- Config lives in a `weave` block in `~/.pi/agent/settings.json`
  (precedent: pi-powerline-footer's `powerline` block; pi preserves custom
  keys). Remember `chezmoi re-add` after pi rewrites settings.

## Non-goals

- Reimplementing powerline-footer's queue, stash, welcome overlay, vibes, or
  bash mode. If one of those ever becomes wanted, it gets its own weave module
  and a fresh, minimal implementation.
- Publishing to npm. This is personal config.
- Supporting terminals/fonts we don't use.

## Architecture

```
dot_pi/agent/extensions/weave/
  index.ts          # entry: wires modules, registers /weave command(s)
  footer/
    footer.ts       # setFooter component: layout, truncation, render
    segments.ts     # one small function per segment (model, git, cost, ...)
    git.ts          # cached git status (branch, staged/unstaged/untracked)
  tools/
    register.ts     # wraps built-in tools: render the row, or hide it
    groups.ts       # per-turn call groups + the minimized counter line
    hide.ts         # patches empty rows down to zero lines
  lib/
    color.ts        # theme token | #rrggbb color resolver (shared)
    format.ts       # token/cost formatting (1.2k, $0.043), width helpers
```

### Config schema (draft)

Declarative, lualine-style. Segment names map to registered segment functions;
unknown names warn once and render nothing.

```jsonc
{
  "weave": {
    "footer": {
      "enabled": true,
      "separator": "·", // one character, rendered with surrounding spaces
      "lines": [
        { "left": ["cwd", "git", "session"] },
        { "left": ["tokens", "cost", "context"], "right": ["model", "thinking"] },
        { "left": ["statuses"] }
      ],
      "segments": {
        // every field optional; built-in defaults apply
        "git":     { "color": "#a6e3a1" },
        "context": { "color": "dim", "warnColor": "warning", "errorColor": "error" }
        // future (additive): { "exec": "kubectl config current-context", "color": "accent" }
        // future (additive): "priority": 5
      }
    }
  }
}
```

Segment contract: `(sctx) => { text: string; color: ColorRef } | null` where
`ColorRef` is a pi theme token or `#rrggbb`. The engine — not the segment —
resolves colors and applies separators, so per-segment config and future join
styles stay orthogonal to segment logic.

Segment registry (phase 1): `cwd` · `git` (branch) · `session` · `tokens`
(↑↓/cache/CH%) · `cost` · `context` (warn ≥70%, error ≥90%) · `model`
(provider prefix when multiple) · `thinking` · `statuses` · `hindsight` · `mcp`.

**Text width.** `cwd` and `git` accept `maxWidth` (characters; unset/0 = no
cap) and `truncate`: `"tail"` (default) keeps the identifying end behind a
leading `…`, `"head"` keeps the start, `"shorten"` abbreviates leading `/`
segments (`~/c/g/p/apps/frontend`) and falls back to tail truncation if that
still overflows. Deep worktree paths and long ticket branches therefore stop
eating the whole footer line:

```json
"segments": {
  "cwd": { "maxWidth": 40, "truncate": "shorten" },
  "git": { "maxWidth": 24 }
}
```

The `git` parens are decoration, not content, so they sit outside the budget:
`maxWidth: 24` yields `(…mory-stack-to-hindsight)`.

**Icons.** Every segment accepts `icon`, a literal prefix the *engine* prepends
after the segment returns (a single space is inserted unless the icon already
ends in one). Because it lives outside the segment, an icon costs no `format`
template and never eats into `maxWidth` — truncation still budgets the branch
name or path alone. That keeps decoration orthogonal to content, the same way
colors and separators already are.

`git` also takes a `format` with a single `{branch}` placeholder (default
`"({branch})"`), so an icon can replace the parens rather than stack with them:

```json
"segments": {
  "git": { "icon": "", "format": "{branch}", "maxWidth": 24 }
}
```

Renders ` …mory-stack-to-hindsight`. Leave `format` alone and you get
` (…mory-stack-to-hindsight)`.

**Format templates.** Segments that compose several values expose a `format`
string instead of hardcoded punctuation, so spacing and separators are config,
not code. Unknown `{names}` render literally so typos surface in the footer.

- `context`: `{used}` `{window}` `{remaining}` `{percent}`, each accepting a
  `:decimals` suffix, plus `{usedRaw}`/`{windowRaw}`/`{remainingRaw}`.
  `unitCase` picks `165.5K` vs `165.5k`. Default `"{percent:1}%/{window:0}"`.
- `hindsight`: `{bank}` `{status}`, default `"󰍛 {bank} {status}"`. Mirrors the
  `hindsight` extension status (`status` key, like a `status:` segment) with
  the active memory bank in front. Icons are literal template text — no `icon`
  or `showActiveBank` settings, because dropping `{bank}` or changing the glyph
  is the same edit. The bank is resolved the way hindsight resolves it
  (`PI_HINDSIGHT_PROJECT_BANK_ID`, then `<cwd>/.pi/hindsight.json[c]`, then
  `~/.pi/agent/hindsight.json[c]`) and only looked up when `{bank}` is present.
  Empty values collapse with their surrounding whitespace, so an unresolved
  bank never leaves a double space.
- `mcp`: `{enabled}` `{connected}` `{disabled}` `{total}` `{failed}`
  `{needsAuth}` `{tools}` `{resources}`, default `"🔌 {enabled} enabled"`.
  Counts come from the structured snapshot pi-mcp-adapter publishes on the
  shared event bus (`pi-mcp-adapter/status/v1`), not from parsing its prose
  footer text; the segment hides until the first snapshot arrives and when no
  servers are configured. It claims the adapter's `mcp` status key so the
  `statuses` catch-all never duplicates it.

First custom segment type (proves the Q3-B instance model): target a single
extension status by its `setStatus` key. Two spellings — inline sugar for the
common case, an instance block when you want styling or a friendlier name:

```jsonc
// inline: no segments block needed
"lines": [ { "left": ["cwd"], "right": ["status:hindsight", "status:mcp"] } ]

// block: named instance with color
"segments": { "mem": { "status": "hindsight", "color": "accent" } },
"lines":    [ { "left": ["cwd"], "right": ["mem"] } ]
```

Animated `llm` activity segment (opt-in, not in default layout): braille
spinner + elapsed time while the agent streams, hidden when idle. Fed by
`agent_start`/`agent_end`; the render timer runs **only** while streaming and
only when `llm` is referenced in `lines` (zero idle footprint). Config:
`frames`, `intervalMs`, `showElapsed`, `color` (default `accent`). No real
progress %: LLM streaming has no completion signal — spinner + elapsed only.

Claimed keys are excluded from the `statuses` catch-all so nothing renders
twice. Keys are author-chosen `ctx.ui.setStatus(key, text)` namespaces (by
convention the extension name, not guaranteed); `/weave statuses` lists what
is live. A renamed upstream key degrades harmlessly: the segment hides and
the text reappears in the catch-all.

Design rules (Pragmatic Programmer: orthogonality + small modules):

- Each segment is a pure function `(ctx, footerData, theme) => string | null`
  — returning `null` hides it. The footer composes whatever the config lists.
  Easy to add, delete, reorder ("Decoupled Code Is Easier to Change").
- Layout engine is segment-agnostic: it only knows lines/zones/separators.
  Segments and layout can change independently (orthogonality).
- `index.ts` stays a thin assembler. New feature = new folder + one wire-up
  line, keeping methods under 50 lines and nesting shallow.
- No state files on disk until a module genuinely needs one.

### Key pi APIs (docs/extensions.md, examples/custom-footer.ts)

- `ctx.ui.setFooter((tui, theme, footerData) => Component)` — full replacement;
  `footerData.getGitBranch()`, `footerData.getExtensionStatuses()`,
  `footerData.onBranchChange(cb)`.
- Token/cost/context: iterate `ctx.sessionManager.getBranch()` assistant
  messages (`usage.input/output/cost`), `ctx.model` for id + context window.
- `truncateToWidth` / `visibleWidth` from `@earendil-works/pi-tui`.
- `pi.registerCommand`, `ctx.ui.setStatus`, `ctx.ui.setWidget` for later phases.

## Phases

### Phase 1 — footer MVP ✅ (implements Q1–Q7; dogfooding)

Lives in `dot_pi/agent/extensions/weave/` (`index.ts`, `config.ts`,
`footer/{footer,segments,usage}.ts`, `lib/format.ts`). Typechecks clean;
auto-discovered via `~/.pi/agent/extensions/*/index.ts`. Implements the
`{ text, color }` contract, token|hex color resolver, `segments` blocks,
`·` separator, `/weave` toggle, whole-segment overflow dropping.
Smoke-tested at widths 120/60/30 with a fake session.
Omissions vs built-in footer (deliberate): `(auto)` compaction indicator and
`(sub)` subscription tag — not exposed to extensions.
Dogfooding notes go here before phase 2.

1. Scaffold `weave/` with entry + footer module; register in pi (extensions
   dir auto-discovery already covers `dot_pi/agent/extensions/`— verify).
2. Config loader: read the `weave.footer` block (settings or `weave.json`,
   per open question), validate, fall back to built-in default layout.
3. Layout engine: N lines × left/middle/right zones, Nerd Font separators,
   width-aware truncation (drop lowest-priority segments first when narrow).
4. Implement the agreed segment set with theme-derived colors.
5. Enable at startup; `/weave` command toggles footer on/off.
6. `chezmoi apply`, restart pi, iterate on look by eye.

Acceptance: default footer replaced at startup, layout matches the declared
config, segments render correctly at narrow and wide widths, off-switch works,
no flicker during streaming.

### Phase 2 — grouped tool calls ✅

Tool calls dominated the transcript, so `weave.tools` collapses a turn's calls
into a single line — `🔧 4 tool calls bash×2 read edit (1 failed)` — that ticks
up live as calls land, so the count is a steering signal rather than a wall of
output. ctrl+o (`app.tools.expand`) expands the turn into pi's ordinary rows;
`/weave tools` toggles the default for the session.

**Grouping happens at the row, not the tool.** The first cut wrapped pi's
built-ins: spread `create<Tool>ToolDefinition(cwd)` — which carries `execute`,
parameters and pi's own renderers — and decide only *whether* a row renders.
That can never reach a tool owned by another extension. `pi.getAllTools()`
returns metadata (`name`, `description`, `parameters`, `sourceInfo`) and
nothing executable, and `getToolDefinition()` lives on `ExtensionRunner`, not
`ExtensionAPI` — so re-registering `ask_user_question` would destroy it.

`ToolExecutionComponent.render` is the single place every tool row passes
through, whoever registered it. `tools/rows.ts` patches it, so grouping covers
built-ins, `ask_user_question`, `subagent`, `mcp__*` and anything installed
later, with no allowlist to maintain. `weave.tools.exclude` opts a name back
out. Expanded, or excluded, the original `render` is called straight through,
so rows keep pi's stock shell, spacing and tint.

Owning `render` also fixes the counter's appearance. Pi wraps row content in a
`Box` whose background comes from `toolPendingBg`/`toolSuccessBg`/`toolErrorBg`
according to *that row's* state — so a group of calls wore whatever colour the
leader happened to have. A summary is not a tool row, so it now renders as two
plain strings (one blank, one line) with no tool background. Status shows in
the tool names instead: each name in `{tools}` is coloured by the worst state
of the calls behind it — `dim` pending, `toolTitle` done, `error` failed. The
line is dimmed end to end and every coloured value re-opens `dim` after its own
`\x1b[39m`, since pi's `theme.fg` resets foreground only.

**Group boundaries are text, not turns.** A group was originally one assistant
turn (`turn_start`). That reasoning — a loop-scoped counter would be pinned
above every thinking block — expired once `tools/thinking.ts` started hiding
those labels: with the boundary invisible, per-turn scoping just produced runs
of `🔧 1 tool call`. Now `agent_start` opens the first group and *visible
assistant text* opens the next. Thinking never breaks a group; it is folded
into the counter line. Text does, because it is on screen, and calls that
follow it belong to what it just said. Text streams ahead of `tool_use` blocks,
so the break always lands before any of that message's rows join.

Rows are keyed by `toolCallId` and remember which group they joined, so
re-rendering an old row (scroll, resize) cannot re-join it to the current group
and inflate the count. Rows only join *while the agent is running*, so
scrollback from before weave loaded renders as pi's own. The leader is
re-rendered through the `invalidate()` handle stashed at first render, deferred
by a tick because invalidating another row mid-pass would reenter it.
Invalidation fires only on real state changes (a new call joins, a state
changes) — invalidating on every result would loop.

The patch works because pi's bundle aliases `@earendil-works/pi-coding-agent`
to its own live module instances, so an extension importing
`ToolExecutionComponent` gets the very class the UI instantiates. The class is
a public export, but its render internals are not a documented contract, so the
patch is guarded (typeof check, idempotence flag, try/catch) and no-ops if a
future pi version changes shape. Same caveat for the private fields it reads
(`toolName`, `toolCallId`, `expanded`, `isPartial`, `result`).

Template placeholders: `{count}` `{plural}` `{tools}` `{errors}` `{last}`
`{thinking}`.

```jsonc
{
  "weave": {
    "tools": {
      "enabled": true,      // false → pi's tools are left completely alone
      "minimize": true,     // one counter line per group; ctrl+o expands
      "minimizedFormat": "🔧 {count} tool call{plural} {tools} {errors}",
      "exclude": []         // tool names that always render as pi draws them
    }
  }
}
```

`minimizedFormat` follows
the same `format` contract as the footer: `{name}` placeholders, empty values
collapse with their surrounding whitespace, unknown names render literally so
typos surface.

### Phase 3 — absorbed loose extensions ✅

The two standalone customizations in `extensions/` became weave modules, so
`~/.pi/agent/extensions/` now holds weave plus third-party config only.

- `weave/roster/roster.ts` (was `agent-roster.ts`) — lists the delegatable
  agents under the startup header, stamped with the run id so resumed
  sessions don't replay every roster ever appended.
- `weave/skills/discover.ts` (was `discover-skills.ts`) — answers
  `resources_discover` with project skill directories pi doesn't know about.
  pi walks `.agents/skills` from cwd to the git root natively; this does the
  same walk for the harness dirs named in `weave.skills.dirs`, defaulting to
  Claude Code's `.claude/skills`. Saves a `.pi/settings.json` per repo.

Both are load-time registrations, so they sit outside the `/weave` toggle.

```jsonc
{
  "weave": {
    "roster": { "enabled": true },
    "skills": { "enabled": true, "dirs": [".claude/skills"] }
  }
}
```

### Phase 4 — git segment done right

Async `git status --porcelain` with short TTL cache, invalidated on
write/edit tool events (mirror powerline's approach without the rest).

### Phase 5+ — candidate modules (later, not now)

- `weave.editor`: background + horizontal padding for the input editor.
  Feasible with first-class primitives — pi-tui exports
  `applyBackgroundToLine()` (reset-safe bg painting, same as feed message
  `Box` bgFn) and `Editor.setPaddingX()`. Config: bg as theme bg token
  (`userMessageBg`, ...) or hex. User-wanted; next in line.
- Segments in the editor border (border-status-editor pattern) — **deferred**:
  same data already sits one line lower in the footer; revisit only if
  footer dogfooding leaves a gap.
- Herdr / subagent / MCP displays and helpers (user-flagged as likely next)

- Working message / spinner customization (`setWorkingMessage`/`setWorkingIndicator`)
- Terminal title (`setTitle`) with project + model
- Custom keybindings/commands that don't warrant their own extension
- Notification hooks (turn-complete notify)

## References

- pi extensions doc: `@earendil-works/pi-coding-agent/docs/extensions.md`
  (Widgets, Status, and Footer section)
- Example: `examples/extensions/custom-footer.ts`, `status-line.ts`,
  `model-status.ts`, `border-status-editor.ts`
- Prior art (for ideas only): `pi-powerline-footer` on npm
