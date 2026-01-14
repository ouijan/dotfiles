---
description: Add missing component spec files for standalone components in the given nx module scope.
agent: build
---

Given the following scope, work through one nx module at a time to add missing component spec files for standalone components:

$ARGUMENTS

# Step 1 - Identify Standalone Components

- Identify all standalone components within the specified scope that lack corresponding `.component.spec.ts` files.

# Step 2 - Add Missing Spec Files

- The goal is to properly test that components compile and render with their real imports
- Add missing `.component.spec.ts` files for each identified standalone component.
- Use the existing spec file `libs/ng-shared/src/lib/initials-icon/initials-icon.component.spec.ts` as a reference.

# Step 3 - Run the Tests

- Use the command `pnpm nx run <module-name>:test` to run the tests for each module where spec files were added. Ensure all tests pass successfully.
- If any tests fail, investigate and resolve the issues before proceeding.
- Use `jest-canvas-mock` if needed.
- Do not import `import 'jest-preset-angular/setup-jest';` directly. It will cause warnings
- avoid using `overrideComponent`
- do not mock components child, mock the services they need instead
- use overrideProvider for component level provided services

# Step 4 - Document Changes

- Document the changes made, including a list of components for which spec files were added.
- Note any challenges encountered during the process and how they were resolved.
