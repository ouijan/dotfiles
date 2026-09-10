# Agent Instructions

## Communication

- Keep communication brief, clear, and actionable.
- DO NOT present findings with things like "It's worse than I thought.", instead focus on the actionable outcomes, and avoid unnecessary commentary.

## Rules

- Never commit/push to main directly
- Never run destructive commands without approval
- Never commit secrets
- Ask before expanding scope

## Code Style

- Follow Pragmatic Programmer principles, communicate by referencing patterns in the book.
- Max 3 nesting levels
- Methods should be no longer than 50 lines
- Self-documenting names
- Small, focused functions
- Intermediate variables for complex expressions
- Keep case statements under 3 lines and 1 level of nesting. Break logic into separate methods if needed.
- Don't use single letter variable names except for loop counters, and sort comparators

### Typescript Rules

- Don't await inside a condition/test expression — extract to an intermediate variable first. This applies to if / else if, while, and switch test expressions. Ternary (? :) expressions are excluded.
- Don't use `any` type.
- Don't use `| undefined` when declaring function arguments. Instead, use an optional argument or a default value.
- Don't use `return undefined` if a simple `return` will suffice.
- Indexed access is `T | undefined`. Narrow it before use — `const worker = workers[0]` must be followed by a guard, or wrapped in a helper that throws/returns a typed default. Never reach for `!` or `as` to silence it.
- Don't use non-null assertions (`!`) or type assertions (`as T`) to defeat the compiler. Use a type guard, an early return, or validation at the boundary.
- Rules are enforced by tooling, not vibes: Biome for lint/format, `tsc --noEmit` for types. Every repo runs `bun run check` (`bun run lint && bun run typecheck`) and it must exit 0 before a commit.

#### Required tsconfig flags

```jsonc
"strict": true,
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true,
"noImplicitOverride": true,
"noImplicitReturns": true,
"noFallthroughCasesInSwitch": true,
"noPropertyAccessFromIndexSignature": true,
"useUnknownInCatchVariables": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"forceConsistentCasingInFileNames": true
```

#### Required Biome lint rules

`suspicious/noExplicitAny`, `style/noNonNullAssertion`, `correctness/noUnusedVariables`, `correctness/noUnusedImports`, `suspicious/useAwait`, `nursery/noFloatingPromises`, `nursery/useExhaustiveSwitchCases`, and `complexity/noExcessiveCognitiveComplexity` (max 10) — all at `error`. Reference config: `~/code/github.com/ouijan/pragma/biome.json`.

A suppression needs a reason: `// biome-ignore lint/<rule>: why`. No blanket file-level disables.

### Principle Repo

Follow these rules when working within the Principle monorepo `~/code/github.com/principle-theorem/principle-theorem/`

- Never run any variation of `nx affected`, it will crash my machine. Instead target the projects directly with `nx run <project>:<target>`.
