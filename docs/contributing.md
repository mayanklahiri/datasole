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

## Quality Gates

The default **developer gate** is:

```bash
npm run gate
```

It runs the following non-performance pipeline, in order, and stops on the first failure:

| Step           | Command              | What it checks                            |
| -------------- | -------------------- | ----------------------------------------- |
| 1. Clean       | `clean`              | Remove all build artifacts                |
| 2. Format      | `format:check`       | Prettier formatting                       |
| 3. Lint        | `lint`               | ESLint + TypeScript (`tsc --noEmit`)      |
| 4. Build       | `build:all`          | Root package + all demo builds            |
| 5. Unit tests  | `test --coverage`    | Vitest + v8 coverage                      |
| 6. Core e2e    | `test:e2e:run`       | Playwright functional e2e (non-benchmark) |
| 7. Integration | `test:e2e:demos:run` | Demo/integration e2e across all demos     |
| 8. Summary     | `gate:summary`       | Print pass/fail with statistics           |

On success, the gate prints a summary with bundle sizes, coverage percentages, and a `GATE PASSED` status. The exhaustive gate additionally captures docs and metrics.

`npm run dist` is an alias for `npm run gate`.

The exhaustive **CI/nightly gate** is:

```bash
npm run gate:full
```

It runs `npm run gate` plus:

| Step          | Command           | What it checks                               |
| ------------- | ----------------- | -------------------------------------------- |
| 9. Benchmarks | `test:bench:run`  | Playwright load/performance scenarios        |
| 10. Metrics   | `collect-metrics` | Bundle sizes, coverage, e2e, benchmark stats |
| 11. Docs      | `docs:build`      | Generate static documentation site           |

### When the gate runs automatically

| Trigger        | What runs                             | How                                         |
| -------------- | ------------------------------------- | ------------------------------------------- |
| **Pre-commit** | Staged format/lint + developer gate   | `lint-staged` then `npm run gate` via husky |
| **Pre-push**   | Developer gate                        | `npm run gate` via husky                    |
| **CI**         | Exhaustive gate                       | `npm run gate:full` on push/PR to `main`    |
| **Nightly**    | Exhaustive gate + bot artifact commit | Dependency workflow on `main`               |
| **Publish**    | Exhaustive gate                       | `prepublishOnly` hook                       |

### Quick commands for development

| Command                    | Description                                |
| -------------------------- | ------------------------------------------ |
| `npm run build`            | Build all targets (no lint/test)           |
| `npm test`                 | Run unit tests only                        |
| `npm run test:watch`       | Unit tests in watch mode                   |
| `npm run test:e2e`         | E2E tests only (builds first)              |
| `npm run test:e2e:demos`   | Demo e2e tests (builds + runs all 3 demos) |
| `npm run test:integration` | Alias for demo/integration e2e             |
| `npm run test:bench`       | Performance/load benchmarks                |
| `npm run lint`             | ESLint + type check only                   |
| `npm run format`           | Auto-format all files                      |
| `npm run format:check`     | Check formatting without fixing            |
| `npm run docs:build`       | Build docs site only                       |
| `npm run docs:preview`     | Preview docs site locally                  |
| `npm run gate`             | **Developer gate (non-performance)**       |
| `npm run gate:full`        | **Exhaustive CI/nightly gate**             |

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
6. Write commit titles and opening body lines around the intention behind the change, not just the files touched

## Git Hooks

Hooks are managed by [husky](https://typicode.github.io/husky/) and installed automatically by `npm install`:

- **pre-commit**: Runs `lint-staged`, then `npm run gate` — non-performance validation only.
- **pre-push**: Runs `npm run gate` — the same non-performance developer gate.

To bypass hooks in an emergency: `git push --no-verify` (discouraged).

## Documentation Style

When writing or updating docs:

- Every feature should have at least one **runnable example** (both server and client code)
- Examples should be as short as possible while remaining complete and copy-pasteable
- Cross-reference related tutorials: `> **Tutorial:** [Name](tutorials.md#anchor)`
- If adding a new pattern, add it to `docs/tutorials.md` (progressive build-up) and `docs/examples.md` (standalone recipe)
