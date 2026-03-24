---
title: Build & Release
order: 9
description: Quality gate, build pipeline, dist artifacts, and publishing workflow.
---

# Build & Release

## Quality Gates

The default developer gate is:

```bash
npm run gate
```

Pipeline (runs in order, stops on first failure):

```
clean → format:check → lint → build:all → test+coverage → e2e(core) → e2e(demos) → gate:summary
```

`npm run dist` is an alias for `npm run gate`.

The exhaustive CI/nightly gate is:

```bash
npm run gate:full
```

It runs:

```
npm run gate → bench → docs:build → collect-metrics → gate:summary
```

### Gate enforcement

| Trigger                 | What runs                                     |
| ----------------------- | --------------------------------------------- |
| **Pre-commit**          | `lint-staged`, then `npm run gate`            |
| **Pre-push**            | `npm run gate`                                |
| **CI (GitHub Actions)** | `npm run gate:full` on push/PR to `main`      |
| **Nightly deps**        | `npm run gate:full`, then bot artifact commit |
| **npm publish**         | `npm run gate:full` via `prepublishOnly`      |

### Gate output

On success, the gate prints a summary:

```
╔════════════════════════════════════════════════════════════╗
║  DATASOLE QUALITY GATE                                     ║
╠════════════════════════════════════════════════════════════╣
║  📦 Bundles                                                ║
║  client/datasole-worker.iife.min.js  48.3 KB / 15.3 KB gz ║
║  client/datasole.iife.min.js         72.0 KB / 22.2 KB gz ║
║  server/index.cjs                    72.1 KB / 16.1 KB gz ║
║  ...                                                       ║
╟────────────────────────────────────────────────────────────╢
║  📊 Coverage                                               ║
║  Lines: 87.9%  Branches: 75.1%  Funcs: 85.4%               ║
╟────────────────────────────────────────────────────────────╢
║  🌐 E2E Tests                                              ║
║  Passed: 48  Failed: 0  Total: 48                          ║
╟────────────────────────────────────────────────────────────╢
║  ✅ GATE PASSED                                             ║
╚════════════════════════════════════════════════════════════╝
```

## Build Targets

| Artifact                                  | Format            | Entry                                   |
| ----------------------------------------- | ----------------- | --------------------------------------- |
| `dist/client/datasole.iife.min.js`        | IIFE (script tag) | `src/client/index.ts`                   |
| `dist/client/datasole.mjs`                | ESM               | `src/client/index.ts`                   |
| `dist/client/datasole.cjs`                | CJS               | `src/client/index.ts`                   |
| `dist/client/datasole-worker.iife.min.js` | IIFE (worker)     | `src/client/worker/transport-worker.ts` |
| `dist/server/index.mjs`                   | ESM               | `src/server/index.ts`                   |
| `dist/server/index.cjs`                   | CJS               | `src/server/index.ts`                   |
| `dist/shared/index.mjs`                   | ESM               | `src/shared/index.ts`                   |
| `dist/shared/index.cjs`                   | CJS               | `src/shared/index.ts`                   |

## Reports

After `npm run gate:full`, the `reports/` directory contains:

| File                 | Contents                                                          |
| -------------------- | ----------------------------------------------------------------- |
| `build-metrics.json` | Machine-readable: bundle sizes, coverage, e2e results, docs stats |
| `build-metrics.md`   | Human-readable: same data as Markdown tables                      |

CI uploads these as artifacts and prints `build-metrics.md` to the GitHub Actions step summary.

## Publishing

```bash
npm version patch  # or minor, major
npm publish
```

`prepublishOnly` runs the full quality gate automatically. If the gate fails, publish is aborted.

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`:

1. `npm run install:all`
2. `npx playwright install --with-deps chromium`
3. `npm run gate:full` (root build, demo builds, unit tests, integration/demo e2e, core e2e, benchmarks, metrics, docs)
4. Upload `reports/`, `coverage/`, `docs-site/dist/` as artifacts
5. On pushes to `main`, commit verified generated artifacts back to `main` with `[skip ci]`
6. Deploy docs site to GitHub Pages
