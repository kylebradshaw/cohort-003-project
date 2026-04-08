# Essential AI Coding Feedback Loops For TypeScript Projects

When working with AI coding agents, especially those operating independently, you need feedback loops so the AI can verify its own work. Feedback loops are especially important when you're doing AFK coding, such as with [Ralph Wiggum](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum).

## 1. Set Up TypeScript and Type Checking

[TypeScript](https://www.typescriptlang.org/) is essentially free feedback for your AI. Use it over JavaScript.

Create a `typecheck` script in your `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc"
  }
}
```

TypeScript catches errors the AI would never find without testing in a browser.

## 2. Add Automated Tests

Use a test framework like [Vitest](https://vitest.dev/) for logical errors:

```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

Basic unit tests covering core functionality help keep the AI on track.

## 3. Install Husky for Pre-commit Hooks

[Husky](https://typicode.github.io/husky/) enforces feedback loops before every commit.

Install and initialize Husky:

```bash
pnpm install --save-dev husky
pnpm exec husky init
```

Create a `.husky/pre-commit` file that runs all your checks:

```bash
npx lint-staged
npm run typecheck
npm run test
```

If any step fails, the commit is blocked and the AI gets an error message.

Another powerful feedback loop is making sure the LLM can access your running dev server locally to check your frontend. [See this video](https://www.youtube.com/watch?v=pSritFeoYFo) for how to set that up.

## 4. Set Up Automatic Code Formatting

Use [lint-staged](https://github.com/lint-staged/lint-staged) with [Prettier](https://prettier.io/) to auto-format code before commits.

Install lint-staged:

```bash
pnpm install --save-dev lint-staged
```

Configure `.lintstagedrc`:

```json
{
  "*": "prettier --ignore-unknown --write"
}
```

This runs Prettier on all staged files and automatically restages them. All AI-generated code now conforms to your formatting standards.

We could also run [ESLint](https://eslint.org/) here since it works nicely with lint-staged.

## Why This Works for AI

AI agents don't get frustrated by repetition. When code fails type checking or tests, the agent simply tries again. This makes feedback loops (and pre-commit hooks, especially) incredibly powerful for AI-driven development.
