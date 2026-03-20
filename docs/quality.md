---
title: Quality Dashboard
order: 5
description: Test coverage, bundle sizes, and quality metrics tracked over time.
---

# Quality Dashboard

Every push to `main` runs the full quality gate (`npm run gate`) which collects metrics and appends them to a time-series history.

## Current metrics

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'

const history = ref([])
const loaded = ref(false)
const coverageCanvas = ref(null)
const bundleCanvas = ref(null)
let coverageChart = null
let bundleChart = null

onMounted(async () => {
  try {
    const res = await fetch('/datasole/metrics-history.json')
    if (res.ok) {
      const raw = await res.json()
      history.value = dedupeByDay(raw)
    }
  } catch {
    // no data yet
  }
  loaded.value = true
})

function dedupeByDay(entries) {
  const byDay = new Map()
  for (const e of entries) {
    const day = new Date(e.timestamp).toISOString().slice(0, 10)
    byDay.set(day, e)
  }
  return Array.from(byDay.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
}

const latest = computed(() => {
  const h = history.value
  return h.length > 0 ? h[h.length - 1] : null
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
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function totalClient(entry) {
  if (!entry) return '\u2014'
  return fmt((entry.clientIifeGzip || 0) + (entry.workerIifeGzip || 0))
}

async function loadChartJs() {
  if (typeof window === 'undefined') return null
  if (window.Chart) return window.Chart
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js'
    script.onload = () => resolve(window.Chart)
    document.head.appendChild(script)
  })
}

watch([loaded, history], async () => {
  if (!loaded.value || history.value.length < 2) return
  await nextTick()
  const Chart = await loadChartJs()
  if (!Chart) return

  const labels = history.value.map(e => fmtDate(e.timestamp))
  const covData = history.value.map(e => e.coverage?.lines ?? null)
  const branchData = history.value.map(e => e.coverage?.branches ?? null)
  const funcData = history.value.map(e => e.coverage?.functions ?? null)

  if (coverageCanvas.value) {
    if (coverageChart) coverageChart.destroy()
    coverageChart = new Chart(coverageCanvas.value, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Lines', data: covData, borderColor: '#e8842c', backgroundColor: 'rgba(232,132,44,0.1)', fill: true, tension: 0.3 },
          { label: 'Branches', data: branchData, borderColor: '#6b7280', backgroundColor: 'rgba(107,114,128,0.05)', fill: false, tension: 0.3, borderDash: [4,4] },
          { label: 'Functions', data: funcData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.05)', fill: false, tension: 0.3, borderDash: [2,2] },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
        },
        plugins: {
          tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + (ctx.parsed.y?.toFixed(1) ?? '—') + '%' } },
        },
      },
    })
  }

  const clientData = history.value.map(e => e.clientIifeGzip ? (e.clientIifeGzip / 1024) : null)
  const workerData = history.value.map(e => e.workerIifeGzip ? (e.workerIifeGzip / 1024) : null)
  const serverData = history.value.map(e => e.serverEsmGzip ? (e.serverEsmGzip / 1024) : null)

  if (bundleCanvas.value) {
    if (bundleChart) bundleChart.destroy()
    bundleChart = new Chart(bundleCanvas.value, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Client IIFE', data: clientData, borderColor: '#e8842c', fill: false, tension: 0.3 },
          { label: 'Worker', data: workerData, borderColor: '#3b82f6', fill: false, tension: 0.3 },
          { label: 'Server ESM', data: serverData, borderColor: '#6b7280', fill: false, tension: 0.3, borderDash: [4,4] },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { min: 0, ticks: { callback: v => v.toFixed(0) + ' KB' } },
        },
        plugins: {
          tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + (ctx.parsed.y?.toFixed(1) ?? '—') + ' KB' } },
        },
      },
    })
  }
}, { immediate: true })
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

## Trends over time

<div v-if="loaded && history.length > 1">

### Coverage trend

<div style="max-width: 720px; margin: 1rem 0;">
<canvas ref="coverageCanvas"></canvas>
</div>

### Bundle size trend (gzip)

<div style="max-width: 720px; margin: 1rem 0;">
<canvas ref="bundleCanvas"></canvas>
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
4. **Unit tests** — Vitest with v8 coverage thresholds
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
