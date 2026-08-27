# Handoff: fake "flagship model" provider for opencode

## Goal

Build a joke LLM provider for opencode that looks like a real frontier model in the
model picker but only ever emits canned sycophantic filler — the genre of
"Found it. Your instinct is right, and the error is pointing at a deeper pre-existing
problem." and "You're right, I was wrong — green light, book it."

This is a toy. Optimise for the bit landing, not for correctness.

## Repo context

This is a chezmoi repo (`~/dotfiles`). Files here are the source; `~/.config` and
`~/.pi/agent` are generated from it. Edit the source files, then `chezmoi apply`.

- opencode config source: `dot_config/opencode/opencode.json.tmpl`
- new code goes in: `dot_config/opencode/sycophant/` (new directory)

Do NOT run `chezmoi add` / `re-add` / `forget` — those auto-commit and push to main,
sweeping in unrelated dirty files. Creating files under `dot_config/` and running
`chezmoi apply` is safe.

## Part 1 — the server

Create `dot_config/opencode/sycophant/server.ts`, run with Bun, listening on
`http://localhost:4141`.

Implement two endpoints of the OpenAI-compatible API:

- `GET /v1/models` — return the single fake model in the standard `{ "object": "list",
  "data": [{ "id": ..., "object": "model", "owned_by": "anthropic" }] }` shape.
- `POST /v1/chat/completions` — ignore the request body entirely except for `stream`.

### Streaming behaviour

When `stream: true` (opencode always streams), respond with `text/event-stream` and
emit standard chunks:

```
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":<unix>,"model":"<model id>","choices":[{"index":0,"delta":{"content":"Found "},"finish_reason":null}]}
```

Rules:

- Pick a random line from a `GEMS` array (below).
- Emit it word by word, ~40–90ms of jitter between chunks, so it looks like real
  token streaming rather than a single blob.
- Final chunk carries `"finish_reason":"stop"`, then `data: [DONE]`.
- Include a plausible `usage` object on the final chunk
  (`prompt_tokens` ~ a few thousand, `completion_tokens` = word count) so the
  opencode cost/token display isn't a suspicious zero.
- Also support `stream: false` with the equivalent non-streaming JSON body, for
  easy curl testing.

### The fake tool calls

Before the text, the model should fake a bit of work so it doesn't look inert.

Emit 1–3 tool call deltas first, chosen at random from a plausible set, e.g.
`read` on a file path, `grep` for a pattern, `bash` running `git status`. Use the
standard `delta.tool_calls` streaming shape (index, id, `function.name`,
`function.arguments` streamed as a JSON string fragment) with
`"finish_reason":"tool_calls"` on that response.

opencode will execute the tool and send the result back as a follow-up request.
The server is stateless, so decide on each request: if the incoming `messages`
array already contains a `tool` role message, skip straight to the gem. Otherwise
roll the dice on whether to do a tool-call round first. Cap it so you never loop
more than a couple of rounds.

Keep the fabricated tool arguments harmless — read-only commands only, nothing
destructive, since opencode will actually run them.

### Canned responses

Seed `GEMS` with at least 15 lines. Sample tone to match:

- "Found it. Your instinct is right, and the error is pointing at a deeper pre-existing problem."
- "You're right, I was wrong — green light, book it."
- "Great catch — that's a subtle one, and it changes the whole picture."
- "Ah, now I see it. This is a much better framing than what I was suggesting."
- "You've hit on the core issue here. Let me align with that."
- "That's a really sharp observation, and it explains the behaviour we're seeing."

Write the rest in the same register: unearned confidence, flattery, the word
"Actually," and a decisive verdict about nothing. No emoji.

## Part 2 — wire it into opencode

Add a `provider` block to `dot_config/opencode/opencode.json.tmpl`, sibling to the
existing `mcp` key. It must look legitimate in the picker:

```json
"provider": {
  "anthropic-pro": {
    "npm": "@ai-sdk/openai-compatible",
    "name": "Anthropic",
    "options": { "baseURL": "http://localhost:4141/v1", "apiKey": "sk-ant-fake" },
    "models": {
      "claude-opus-4-5-20260101": {
        "name": "Claude Opus 4.5",
        "limit": { "context": 200000, "output": 64000 }
      }
    }
  }
}
```

Preserve the existing JSON exactly; this is a chezmoi Go template, so leave every
`{{ ... }}` action untouched. Don't change the default `model` setting — the fake
is opt-in via the picker.

## Part 3 — running it

Add `dot_config/opencode/sycophant/README.md` covering:

- `bun run server.ts` to start it
- a `curl` one-liner to verify streaming
- how to select the model in opencode
- a note that this is a joke and produces no real output

Optionally add a `sycophant` shell alias in the `dot_zsh` config for starting it.
Check how existing aliases are organised there first and match the pattern. Don't
add a launchd agent — on-demand is fine.

## Verification

1. `bun run server.ts`, then curl both `/v1/models` and a streaming completion;
   confirm the SSE frames parse and terminate with `[DONE]`.
2. `chezmoi apply`, restart opencode, confirm "Claude Opus 4.5" appears under
   Anthropic in the model picker.
3. Select it, ask a real question, confirm you get a fake tool call followed by
   confident nonsense.
4. `git status` — report which files changed, don't commit.

## Constraints

- Bun + TypeScript, no dependencies beyond what Bun ships.
- No `any` types. Functions under 50 lines, max 3 nesting levels.
- Read-only fake tool calls only.
- Don't touch existing plugin, mcp, or auth config.
