---
name: do-work
description: Plan, implement, validate, and commit a piece of work end-to-end. Use when user says "do work", "implement this", "build this feature", "fix this bug", or wants a full plan-to-commit workflow.
---

# Do Work

End-to-end workflow: plan → implement → validate → commit.

## Workflow

### 1. Understand the task

Read any referenced plan or PRD. Explore the codebase to understand the relevant files,patterns, and conventions. If the task is ambiguous, ask the user to clarify scope before proceeding.

### 2. Plan the implementation (optional)

If the task has not already been planned, create a plan for it.

If the task has not already been planned, create a plan for it. A good plan breaks the work into clear steps and includes any necessary details or decisions. If a plan already exists, review it to ensure you understand it before moving on to implementation.

### 3. Implement

Work through the plan step by step.

### 4. Validate

Run the feedback loops and fix any issues. Repeat until both pass cleanly.

```
pnpm run typecheck
pnpm run test
```

If either fails, fix the issues and re-run both commands. Do not proceed to 5. until both pass.

### 5. Commit

Use `/commit` to create a well-structured commit with a clear message.

## Important

- Never commit code that fails typecheck or tests.
- If stuck in a validation loop (3+ attempts), stop and ask the user for guidance.
