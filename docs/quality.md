---
title: Quality Dashboard
order: 5
description: Test coverage, bundle sizes, and quality metrics tracked over time.
---

# Quality Dashboard

Every push to `main` runs the full quality gate (`npm run gate`) which collects metrics and appends them to a time-series history.

## Current metrics

<script setup>
import { ref, onMounted, computed } from 'vue'

const history = ref([])
const loaded = ref(false)

onMounted(async () => {
  try {
    const res = await fetch('/datasole/metrics-history.json')
    if (res.ok) {
      history.value = await res.json()
    }
  } catch {
    // no data yet
  }
  loaded.value = true
})

const latest = computed(() => {
  const h = history.value
  return h.length > 0 ? h[h.length - 1] : null
})

const recent = computed(() => {
  return history.value.slice().reverse().slice(0, 20)
})

function fmt(bytes) {
  if (!bytes) return '\u2014'
  return (bytes / 1024).toFixed(1) + ' KB'
}

function pct(n) {
  if (n == null) return '\u2014'
  return n.toFixed(1) + '%'
}

function covLine(entry) {
  if (!entry || !entry.coverage) return '\u2014'
  return pct(entry.coverage.lines)
}

function covBranch(entry) {
  if (!entry || !entry.coverage) return '\u2014'
  return pct(entry.coverage.branches)
}

function covFunc(entry) {
  if (!entry || !entry.coverage) return '\u2014'
  return pct(entry.coverage.functions)
}

function covStmt(entry) {
  if (!entry || !entry.coverage) return '\u2014'
  return pct(entry.coverage.statements)
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function totalClient(entry) {
  if (!entry) return '\u2014'
  return fmt((entry.clientIifeGzip || 0) + (entry.workerIifeGzip || 0))
}
</script>

<div v-if="loaded && latest">

### Coverage

| Metric     | Value                                |
| ---------- | ------------------------------------ |
| Lines      | <span>{{ covLine(latest) }}</span>   |
| Branches   | <span>{{ covBranch(latest) }}</span> |
| Functions  | <span>{{ covFunc(latest) }}</span>   |
| Statements | <span>{{ covStmt(latest) }}</span>   |

### Bundle sizes (gzip)

| Bundle            | Size                                          |
| ----------------- | --------------------------------------------- |
| Client IIFE (min) | <span>{{ fmt(latest.clientIifeGzip) }}</span> |
| Worker IIFE (min) | <span>{{ fmt(latest.workerIifeGzip) }}</span> |
| Shared ESM        | <span>{{ fmt(latest.sharedEsmGzip) }}</span>  |
| Server ESM        | <span>{{ fmt(latest.serverEsmGzip) }}</span>  |
| **Total client**  | <span>{{ totalClient(latest) }}</span>        |

### Tests

| Suite      | Count                                      |
| ---------- | ------------------------------------------ |
| Unit tests | <span>{{ latest.unitTests ?? '—' }}</span> |
| E2E tests  | <span>{{ latest.e2eTests ?? '—' }}</span>  |

<p style="color: var(--vp-c-text-3); font-size: 0.85rem;">Last updated: <span>{{ latest.timestamp }}</span></p>

</div>

<div v-else-if="loaded">
<p>No metrics data available yet. Run <code>npm run gate</code> to generate metrics.</p>
</div>

<div v-else>
<p>Loading metrics...</p>
</div>

## Metrics over time

<div v-if="loaded && history.length > 1">

### Coverage trend

<div style="overflow-x: auto;">
<table>
<thead><tr><th>Date</th><th>Lines</th><th>Branches</th><th>Functions</th></tr></thead>
<tbody>
<tr v-for="(entry, idx) in recent" :key="idx">
<td><span>{{ fmtDate(entry.timestamp) }}</span></td>
<td><span>{{ covLine(entry) }}</span></td>
<td><span>{{ covBranch(entry) }}</span></td>
<td><span>{{ covFunc(entry) }}</span></td>
</tr>
</tbody>
</table>
</div>

### Bundle size trend (gzip)

<div style="overflow-x: auto;">
<table>
<thead><tr><th>Date</th><th>Client IIFE</th><th>Worker</th><th>Shared</th><th>Server</th></tr></thead>
<tbody>
<tr v-for="(entry, idx) in recent" :key="idx">
<td><span>{{ fmtDate(entry.timestamp) }}</span></td>
<td><span>{{ fmt(entry.clientIifeGzip) }}</span></td>
<td><span>{{ fmt(entry.workerIifeGzip) }}</span></td>
<td><span>{{ fmt(entry.sharedEsmGzip) }}</span></td>
<td><span>{{ fmt(entry.serverEsmGzip) }}</span></td>
</tr>
</tbody>
</table>
</div>

</div>

<div v-else-if="loaded">
<p>Not enough data points for trends yet. Metrics accumulate with each <code>npm run gate</code> run.</p>
</div>

## What the quality gate enforces

The gate (`npm run gate`) is a single command that runs everything:

1. **Format check** — Prettier on all source and test files
2. **Lint** — ESLint with `recommendedTypeChecked` + strict TypeScript (`tsc --noEmit`)
3. **Build** — Rollup multi-target bundles (client IIFE/ESM/CJS, worker, server ESM/CJS, shared)
4. **Unit tests** — Vitest with v8 coverage thresholds (lines ≥45%, branches ≥40%, functions ≥35%)
5. **E2E tests** — Playwright with headless Chromium, desktop + mobile viewports, production IIFE bundle
6. **Metrics collection** — Bundle sizes, coverage, e2e results → `reports/` + history append
7. **Docs build** — VitePress static site generation
8. **Summary** — Pass/fail with statistics

The gate runs:

- On every `git push` (pre-push hook)
- On every PR and push to `main` (GitHub Actions CI, Node 22 + 24 matrix)
- Nightly (dependency update workflow)

## Coverage thresholds

| Metric     | Minimum |
| ---------- | ------- |
| Lines      | 80%     |
| Branches   | 70%     |
| Functions  | 80%     |
| Statements | 80%     |

These are enforced by Vitest. The gate fails if any threshold is not met.
