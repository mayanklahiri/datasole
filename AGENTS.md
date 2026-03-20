# Datasole — Agent Instructions

## Project Structure

- `src/shared/` — Code shared between client and server (protocol, codec, diff, types, CRDTs)
- `src/client/` — Browser client library (Web Worker transport, state store, RPC, events, CRDT store)
- `src/server/` — Node.js server library (ws transport, auth, state backends, RPC, events, metrics, adapters, concurrency, rate limiting, sync channels, sessions)
- `build/` — Rollup and TypeScript build configurations, metrics collection, gate summary
- `test/unit/` — Vitest unit tests
- `test/e2e/` — Playwright end-to-end tests
- `docs/` — Canonical documentation (Markdown)
- `docs-site/` — Static documentation site generator

## Quality Gate

**Before committing or pushing, run the quality gate:**

```bash
npm run gate
```

This is the single command that validates everything. It runs, in order:

1. `clean` — remove dist/, reports/, coverage/, docs-site/dist/
2. `format:check` — Prettier formatting validation
3. `lint` — ESLint + TypeScript type check (`tsc --noEmit`)
4. `build` — Rollup multi-target bundle (client IIFE/ESM/CJS, worker, server ESM/CJS)
5. `test --coverage` — Vitest unit tests with v8 coverage
6. `test:e2e` — Playwright e2e tests (builds first, headless Chromium, production artifacts)
7. `collect-metrics` — Bundle sizes, coverage, e2e results, docs stats → `reports/`
8. `docs:build` — Generate static documentation site
9. `gate:summary` — Print pass/fail summary with statistics

**The gate MUST pass before any push.** This is enforced by:

- **pre-commit hook**: `lint-staged` (format + lint staged files)
- **pre-push hook**: `npm run gate` (full pipeline)
- **CI**: GitHub Actions runs `npm run gate` on every push/PR to `main`

`npm run dist` is an alias for `npm run gate`.

## Key Files

- `src/shared/build-constants.ts` — Single source of truth for version, protocol version, default path
- `src/shared/types/` — All shared TypeScript type definitions
- `package.json` — npm scripts, exports map, dependencies

## Documentation

**Always consult `docs/` before making structural changes.** Key docs:

- `docs/tutorials.md` — Progressive tutorials (start here for learning)
- `docs/examples.md` — Copy-paste recipes by pattern
- `docs/architecture.md` — System design, wire protocol, data flow
- `docs/decisions.md` — Architecture Decision Records (ADRs)
- `docs/contributing.md` — Build commands, PR guidelines

When adding user-facing features, update `docs/tutorials.md` and/or `docs/examples.md` with runnable examples.

## Architecture Decisions

All architecture decisions MUST be recorded in `docs/decisions.md` before implementation.

When making changes that involve:

- Adding or removing a dependency
- Changing the wire protocol or frame format
- Changing the build system or output targets
- Changing the transport mechanism (worker, SAB, fallback)
- Changing the state synchronization algorithm
- Adding a new adapter, backend, or exporter
- Changing the public API surface
- Changing the quality gate pipeline

You MUST:

1. Check `docs/decisions.md` for an existing relevant ADR
2. If no relevant ADR exists, add a new one with the next sequential number
3. If an existing ADR is being superseded, update its status to "Superseded by ADR-XXX"
4. Include the ADR number in the commit message (e.g. `feat: add Redis backend [ADR-005]`)

## Changelog

**`CHANGELOG.md` MUST be updated for every version bump.** Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format with sections:

- **Added** — new features
- **Changed** — changes to existing functionality
- **Deprecated** — features that will be removed
- **Removed** — features that were removed
- **Fixed** — bug fixes
- **Security** — vulnerability fixes

Version classification (SemVer):

- **Major** (X.0.0) — breaking API changes, protocol changes, minimum Node.js version bumps
- **Minor** (x.Y.0) — new features, new adapters/backends, new data-flow patterns
- **Patch** (x.y.Z) — bug fixes, dependency updates, docs improvements, CI changes

When making changes:

1. Check `package.json` for the current version
2. Add entries under the appropriate `## [version]` heading in `CHANGELOG.md`
3. Group entries under the correct section (Added/Changed/Fixed/etc.)
4. Use sub-headings (####) to group related entries within a section when there are many changes

## Coding Conventions

- TypeScript strict mode; no `any` in public APIs
- Use `unknown` with type guards instead of `any`
- Barrel exports via `index.ts` in each directory
- Imports from `shared` only — no cross-imports between `client` and `server`
- Run `npm run gate` before pushing — it catches everything

## Integrating datasole into an existing project

**Pattern:** server — `DatasoleServer` then `ds.attach(httpServer)` on the existing Node HTTP server; client — `DatasoleClient` (or a thin wrapper) pointed at that server.

**Stacks (key wiring only):**

- **NestJS + Vue 3**

```ts
const app = await NestFactory.create(AppModule);
const ds = new DatasoleServer(/* opts */);
ds.attach(app.getHttpServer());
```

Vue: composable with `shallowRef<DatasoleClient | null>`; create/dispose in `onMounted` / `onUnmounted`.

- **Next.js + Express**

Run Datasole in a **separate Node process** from the Next dev/server; Next app uses a `"use client"` provider that constructs `DatasoleClient`.

- **Express + React**

```ts
const httpServer = createServer(app);
const ds = new DatasoleServer(/* opts */);
ds.attach(httpServer);
```

React: `useRef` for the client + `useEffect` to construct and `disconnect()` on teardown.

- **AdonisJS + vanilla JS**

```ts
server.ready(() => {
  const httpServer = server.getNodeServer();
  if (httpServer) ds.attach(httpServer);
});
```

Browser: IIFE bundle via `<script>` tag — global is `window.Datasole`, use `new Datasole.DatasoleClient(opts)`.

**Docs:** `docs/integrations.md` — full copy-paste examples per stack; `docs/examples.md` — pattern recipes.

**Client API:** The RPC method is `client.rpc(method, params)` (not `call()`). State: `client.subscribeState(key, handler)`. Events: `client.on(event, handler)`, `client.emit(event, data)`.

**Pitfalls:**

- SSR / App Router — client code must run in a client boundary (`"use client"` or equivalent)
- React Native / Next.js — pass `useWorker: false` to `DatasoleClient`
- Default WebSocket path is `/__ds` (configure `path` / proxy if needed)
- Next.js requires `transpilePackages: ['datasole']` in `next.config.ts` and `--webpack` flag (Turbopack doesn't resolve subpath exports for linked packages)
- NestJS requires `import 'reflect-metadata'` before any NestJS imports
- `app.getHttpServer()` returns the raw Node `http.Server` — this is what `ds.attach()` expects
