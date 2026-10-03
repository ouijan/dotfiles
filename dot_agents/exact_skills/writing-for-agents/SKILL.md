---
name: writing-for-agents
description: Writing documents for agents. Use when creating or editing a skill, AGENTS.md, or CLAUDE.md.
metadata:
  credits:
    skill: writing-for-agents
    author: Matt Pocock
    url: "https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md"
---

# Writing for agents

The aim is a predictable _process_: the agent takes the same path every run. Every line spends the agent's attention, so each one has to change behaviour.

## Pointers

A skill description, or an `AGENTS.md` line naming a doc, is a **pointer**. It is always loaded and decides when the agent reaches the material.

- Say what the material is, then give one trigger per distinct case. Collapse synonyms into one trigger.
- Front-load the word the user actually types.
- When must-have material goes unread, sharpen the pointer first. Inline the material only if that fails.

## Structure beats prose

Before writing a rule, look for a mechanism that enforces it: a lint rule, hook, script, type, or frontmatter flag. Build the mechanism and drop the line. Prose is for judgment calls.

## Placement

Rank material by how many runs need it:

1. **Steps**, in order, in the main file.
2. **Reference every path needs**, in the main file, with each concept's rules and caveats under one heading.
3. **Reference only some paths need**, in a sibling file behind a pointer.

Disclose too little and the steps drown. Disclose too much and the agent misses what it needs.

## Steps

End every step on a **completion criterion** the agent can check. Make it demanding: "every caller updated", not "update callers". A vague bound lets attention slip to the next step. Sharpen the bound before splitting the sequence.

## Wording

- Use **leading words**: one pretrained term (_tracer bullet_, _red_, _tight_) in place of a phrase repeated across the doc.
- State the behaviour you want. A prohibition primes the thing it bans. Keep bans for hard guardrails, paired with the positive.
- Write real names: file paths, commands, symbols.

## Pruning

- Keep each meaning in one place. Duplication drifts and inflates its rank.
- Leave lookups to the environment (`package.json`, `--help`, config files). Write what looking can't find: conventions, reasons, gotchas.
- Delete any sentence the model obeys by default. Settle doubts by running the doc. If a word is too weak to beat the default, pick a stronger word.
- Cut stale lines whenever you touch a doc.

## Skills

- **Model-invoked** (default): the description is a permanent pointer. Write its triggers for the agent.
- **User-invoked** (`disable-model-invocation: true`, where supported): costs no context. The description becomes a one-line summary for humans. Choose this when only a person ever fires the skill.

## Done when

1. `name` matches the folder name (lowercase, hyphens) and `description` is present.
2. Every relative link resolves to a file.
3. Every skill the doc names exists.
4. For a skill with steps or a fixed output shape: run two or three realistic prompts in a fresh agent that doesn't know it's a test, and check which files it read.

Report what the skill does, the invocation choice, what you disclosed and why, and the check results.
