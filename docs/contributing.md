---
title: Contributing
order: 8
description: Development setup, quality gate, build commands, and PR guidelines.
---

# Contributing

## Setup

Requires **Node.js 22 or later** (tested on Node 22 LTS and Node 24).

```bash
git clone https://github.com/mayanklahiri/datasole.git
cd datasole
npm install
npx playwright install chromium
```

`npm install` automatically sets up git hooks via husky.

## Quality Gate

The **quality gate** is the single command that validates the entire project:

```bash
npm run gate
```

It runs the following pipeline, in order, and stops on the first failure:

| Step          | Command           | What it checks                                     |
| ------------- | ----------------- | -------------------------------------------------- |
| 1. Clean      | `clean`           | Remove all build artifacts                         |
| 2. Format     | `format:check`    | Prettier formatting                                |
| 3. Lint       | `lint`            | ESLint + TypeScript (`tsc --noEmit`)               |
| 4. Build      | `build`           | Rollup multi-target bundles (6 outputs)            |
| 5. Unit tests | `test --coverage` | Vitest + v8 coverage                               |
| 6. E2E tests  | `test:e2e`        | Playwright + headless Chromium + production bundle |
| 7. Metrics    | `collect-metrics` | Bundle sizes, coverage, e2e results → `reports/`   |
| 8. Docs       | `docs:build`      | Generate static documentation site                 |
| 9. Summary    | `gate:summary`    | Print pass/fail with statistics                    |

On success, the gate prints a summary with bundle sizes, coverage percentages, doc page counts, and a `GATE PASSED` status.

`npm run dist` is an alias for `npm run gate`.

### When the gate runs automatically

| Trigger        | What runs                  | How                                 |
| -------------- | -------------------------- | ----------------------------------- |
| **Pre-commit** | Format + lint staged files | `lint-staged` via husky             |
| **Pre-push**   | Full quality gate          | `npm run gate` via husky            |
| **CI**         | Full quality gate          | GitHub Actions on push/PR to `main` |
| **Publish**    | Full quality gate          | `prepublishOnly` hook               |

### Quick commands for development

| Command                  | Description                                |
| ------------------------ | ------------------------------------------ |
| `npm run build`          | Build all targets (no lint/test)           |
| `npm test`               | Run unit tests only                        |
| `npm run test:watch`     | Unit tests in watch mode                   |
| `npm run test:e2e`       | E2E tests only (builds first)              |
| `npm run test:e2e:demos` | Demo e2e tests (builds + runs all 3 demos) |
| `npm run lint`           | ESLint + type check only                   |
| `npm run format`         | Auto-format all files                      |
| `npm run format:check`   | Check formatting without fixing            |
| `npm run docs:build`     | Build docs site only                       |
| `npm run docs:preview`   | Preview docs site locally                  |
| `npm run gate`           | **Full quality gate**                      |

## Learning the Codebase

If you're new to datasole:

1. Read the [Tutorials](tutorials.md) — they show every feature with runnable code
2. Read the [Architecture](architecture.md) — the learning path diagram shows how concepts connect
3. Read the [ADRs](decisions.md) — they explain _why_ the code is structured this way

## Architecture Decisions

All ADRs are in `docs/decisions.md`. **Read them before making structural changes.**

If your change involves an architectural decision:

1. Add a new ADR section to `docs/decisions.md`
2. Use the next sequential number (e.g., ADR-018)
3. Include: Status, Date, Context, Decision, Consequences
4. Reference the ADR number in your commit message

## PR Guidelines

1. **Run `npm run gate` locally** — it must pass before opening a PR
2. Add/update tests for any new functionality
3. Update relevant `docs/*.md` files — especially tutorials and examples if your change adds user-facing features
4. If your change involves an architectural decision, add an ADR to `docs/decisions.md`
5. Include the ADR number in the commit message if applicable

## Git Hooks

Hooks are managed by [husky](https://typicode.github.io/husky/) and installed automatically by `npm install`:

- **pre-commit**: Runs `lint-staged` — auto-formats and lints only staged `.ts` files. Fast (~2s).
- **pre-push**: Runs `npm run gate` — the full quality pipeline. Takes ~30s. Prevents pushing broken code.

To bypass hooks in an emergency: `git push --no-verify` (discouraged).

## Documentation Style

When writing or updating docs:

- Every feature should have at least one **runnable example** (both server and client code)
- Examples should be as short as possible while remaining complete and copy-pasteable
- Cross-reference related tutorials: `> **Tutorial:** [Name](tutorials.md#anchor)`
- If adding a new pattern, add it to `docs/tutorials.md` (progressive build-up) and `docs/examples.md` (standalone recipe)
