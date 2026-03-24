---
name: codebase-health
description: Scan the datasole codebase for stubs, drafts, TODOs, unimplemented sections, incorrect code, and documentation drift. Fix all issues found by implementing missing functionality and updating docs (docs-site, README.md, AGENTS.md). Use when the user asks to scan for incomplete code, fix stubs, audit implementation completeness, or synchronize documentation with code.
---

# Codebase Health Scan & Fix

Systematic audit of the datasole repository for implementation gaps, stale documentation, and code quality issues. This skill both **finds** and **fixes** problems.

## How to invoke

Ask the agent: _"Run the codebase-health skill"_ or _"Scan for stubs and fix them"_.

## Scan procedure

Execute each phase in order. Use parallel subagents where noted.

### Phase 1 — Source code scan

Search `src/` for incomplete implementations. Run these searches in parallel:

```
Patterns to search (case-insensitive, across src/**/*.ts):
  TODO             FIXME             HACK
  XXX              STUB              stub
  not implemented  unimplemented     placeholder
  draft            skeleton          noop
  throw new Error\('not implemented  throw new Error\('TODO
```

For each match:

1. Read surrounding context (±20 lines minimum)
2. Determine if it is a genuine implementation gap or an intentional marker
3. If genuine: **implement the missing functionality** using test-first approach
   - Write a failing test first
   - Implement until the test passes
   - Run `npx vitest run` to confirm

### Phase 2 — Test scan

Search `test/` for skipped, pending, or placeholder tests:

```
Patterns: .skip  .todo  xit(  xdescribe(  pending  'not yet'
```

For each: either implement the test or remove it if the functionality it was meant to test no longer applies.

### Phase 3 — Documentation-to-code alignment

For each file in `docs/*.md`:

1. Read the doc file
2. Identify every API reference, constructor option, method signature, event name, and code example
3. Grep `src/` to verify each reference exists in the implementation
4. Fix discrepancies:
   - **Doc mentions non-existent API** → remove from docs or implement in code
   - **Code has API not in docs** → add to docs
   - **Signatures differ** (param names, types, defaults) → update docs to match code
   - **Code examples use wrong API** → fix the examples

Key files to cross-reference:

- `docs/client.md` ↔ `src/client/client.ts`
- `docs/server.md` ↔ `src/server/server.ts`
- `docs/shared.md` ↔ `src/shared/index.ts`
- `docs/tutorials.md` ↔ actual API
- `docs/examples.md` ↔ actual API
- `docs/integrations.md` ↔ actual API
- `docs/composability.md` ↔ actual API
- `docs/metrics.md` ↔ `src/server/metrics/`
- `docs/state-backends.md` ↔ `src/server/backends/`
- `docs/comparison.md` ↔ actual bundle sizes, features

### Phase 4 — README alignment

Compare `README.md` against:

- Actual bundle sizes from `npm run build` output or `reports/build-sizes.json`
- Feature claims vs actual implementation
- Code examples vs actual API signatures
- Comparison table entries vs actual capabilities

### Phase 5 — AGENTS.md alignment

Verify `AGENTS.md` reflects:

- Current project structure (`ls -R src/`)
- Current quality gate steps (`package.json` scripts)
- Current integration patterns (match `docs/integrations.md`)

### Phase 6 — Regenerate artifacts

After all fixes:

```bash
npm run gate:full
```

This rebuilds everything: bundles, types, unit tests, integration/demo e2e, core e2e, benchmarks, metrics, and the docs site.

If the gate fails, fix the failures and re-run until it passes.

### Phase 7 — Commit

Stage all changes and create a descriptive commit:

```bash
git add -A
git commit -m "fix: resolve stubs/TODOs and align docs with implementation"
```

## Output

When complete, report:

1. Number of issues found per phase
2. What was fixed
3. What was intentionally left (with justification)
4. Gate pass/fail status
