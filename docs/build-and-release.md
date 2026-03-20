---
title: Build & Release
order: 9
description: Quality gate, build pipeline, dist artifacts, and publishing workflow.
---

# Build & Release

## Quality Gate

The quality gate is the single command that validates everything:

```bash
npm run gate
```

Pipeline (runs in order, stops on first failure):

```
clean → format:check → lint → build → test+coverage → e2e → collect-metrics → docs:build → gate:summary
```

`npm run dist` is an alias for `npm run gate`.

### Gate enforcement

| Trigger                 | What runs                                      |
| ----------------------- | ---------------------------------------------- |
| **Pre-commit**          | `lint-staged` (format + lint staged .ts files) |
| **Pre-push**            | `npm run gate` (full pipeline)                 |
| **CI (GitHub Actions)** | `npm run gate` on push/PR to `main`            |
| **npm publish**         | `npm run gate` via `prepublishOnly`            |

### Gate output

On success, the gate prints a summary:

```
╔════════════════════════════════════════════════════════════╗
║  DATASOLE QUALITY GATE                                     ║
╠════════════════════════════════════════════════════════════╣
║  📦 Bundles                                                ║
║  client/datasole.iife.min.js              6.3 KB / 1.8 KB ║
║  server/index.esm.js                     27.5 KB / 5.8 KB ║
║  ...                                                       ║
╟────────────────────────────────────────────────────────────╢
║  📊 Coverage                                               ║
║  Lines: 85%    Branches: 72%    Funcs: 90%                 ║
╟────────────────────────────────────────────────────────────╢
║  📖 Documentation Site                                     ║
║  Pages: 13   Total size: 133.5 KB                          ║
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

## Reports

After `npm run gate`, the `reports/` directory contains:

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

1. Matrix: Node.js 22 (LTS), 24 (latest)
2. `npm ci`
3. `npx playwright install --with-deps chromium`
4. `npm run gate` (the full quality pipeline)
5. Upload `reports/`, `coverage/`, `docs-site/dist/` as artifacts
6. Print `build-metrics.md` to step summary
7. Deploy docs site to GitHub Pages (on push to `main`, from the Node 24 job)
