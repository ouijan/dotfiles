# Agent Instructions

## Communication

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
