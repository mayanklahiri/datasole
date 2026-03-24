---
title: AI & LLM Guide
order: 8
description: Instructions for AI coding agents working with the datasole codebase.
---

# AI & LLM Guide

This page consolidates all guidance for AI coding agents (Cursor, Copilot, Cline, etc.) working on the datasole codebase.

## Quick reference

| File                                                                                                                                    | Purpose                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`AGENTS.md`](https://github.com/mayanklahiri/datasole/blob/main/AGENTS.md)                                                             | Top-level AI agent instructions (project structure, gate, ADRs, conventions) |
| [`.cursor/rules/datasole.mdc`](https://github.com/mayanklahiri/datasole/blob/main/.cursor/rules/datasole.mdc)                           | Cursor-specific rule file (auto-applied to matching globs)                   |
| [`.cursor/skills/codebase-health/SKILL.md`](https://github.com/mayanklahiri/datasole/blob/main/.cursor/skills/codebase-health/SKILL.md) | Codebase health scan & fix skill                                             |

## Project structure

```
src/shared/     Code shared between client and server (protocol, codec, diff, types, CRDTs)
src/client/     Browser client (Web Worker transport, state store, RPC, events, CRDT store)
src/server/     Node.js server (ws transport, auth, backends, RPC, events, metrics, adapters)
build/          Rollup/TypeScript configs, metrics collection, gate summary
test/unit/      Vitest unit tests
test/e2e/       Playwright e2e tests
docs/           Canonical documentation (these pages)
```

**Dependency rule:** `shared ← client`, `shared ← server`. No `client ↔ server` imports.

## Quality gate

```bash
npm run gate
```

Runs the developer gate: clean → format:check → lint → build:all → test (coverage) → core e2e → demo/integration e2e → gate:summary.

`npm run gate:full` adds benchmarks, metrics collection, and docs build. CI/nightly use `npm run gate:full`; local hooks use `npm run gate`.

## Key conventions

- TypeScript strict mode; no `any` in public APIs
- `src/shared/build-constants.ts` is the single source of truth for version, protocol, defaults
- Architecture decisions recorded in `docs/decisions.md`
- Changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- Barrel exports via `index.ts` in each directory
- Commit messages should lead with intent; the title and first few body lines explain why the change exists

## Integration patterns

Define `AppContract` with `RpcMethod` / `Event` / `StateKey` enums in `shared/contract.ts`; use `new DatasoleClient<AppContract>(...)`. The RPC method is `client.rpc(RpcMethod.Foo, params)` (not `call()`). State: `client.subscribeState(StateKey.Bar, handler)`. Events: `client.on(Event.Baz, handler)`, `client.emit(Event.Baz, data)`.

See [AGENTS.md](https://github.com/mayanklahiri/datasole/blob/main/AGENTS.md) for full stack-specific wiring (NestJS, Next.js, Express, AdonisJS) and common pitfalls.

## Running the codebase-health scan

Ask the agent: _"Run the codebase-health skill"_ — this performs a 7-phase audit:

1. **Source scan** — grep `src/` for TODO/FIXME/STUB/unimplemented markers → implement missing code
2. **Test scan** — grep `test/` for skipped/pending tests → implement or remove
3. **Doc-code alignment** — cross-reference `docs/*.md` API refs against `src/` → fix discrepancies
4. **README alignment** — verify bundle sizes, feature claims, code examples
5. **AGENTS.md alignment** — verify project structure and gate steps
6. **Regenerate** — `npm run gate` for local validation or `npm run gate:full` when validating CI/nightly behavior
7. **Commit** — stage and commit all fixes
