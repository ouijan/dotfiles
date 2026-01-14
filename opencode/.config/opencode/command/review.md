---
description: Orchestrate multi-agent code review with actionable findings
agent: build
---

Perform a comprehensive code review using specialist agents.

## Target

$ARGUMENTS

## Phase 1: Gather Specialist Reviews

Run these agents in parallel to gather specialized perspectives:

- @typescript-reviewer: TypeScript patterns, types, and idioms
- @code-simplicity-reviewer: Readability, complexity, maintainability
- @security-reviewer: Vulnerabilities and security concerns
- @performance-reviewer: Performance issues and optimizations

Collect all findings from each agent before proceeding.

## Phase 2: Analyze & Synthesize

Consolidate findings from all agents:

1. Remove duplicates and overlapping issues
2. Categorize by type (security, performance, quality, architecture)
3. Assign severity:
   - **P1 Critical**: Blocks merge (security vulnerabilities, data corruption, breaking changes)
   - **P2 Important**: Should fix (performance issues, significant quality problems)
   - **P3 Enhancement**: Nice to have (minor improvements, cleanup)

Apply perspective checks to validate findings:

- Developer: Is this easy to understand and modify?
- Operations: Can this be deployed and monitored safely?
- End User: Does this solve the problem effectively?
- Security: What's the attack surface?
- Business: What's the risk vs. value?

## Phase 3: Create Actionables

Generate a todo file at `.opencode/workflow/review-todos.md` using template:
@~/.config/opencode/templates/todo.md

Each finding becomes an actionable item that other agents can reference and resolve.

## Phase 4: Report

Generate a todo file at `.opencode/workflow/review-report.md` using template:
@~/.config/opencode/templates/review-report.md. Then present the report to the user.

Include:

- Total findings by severity
- P1 blockers requiring immediate attention
- Link to generated todo file
- Recommended next steps
