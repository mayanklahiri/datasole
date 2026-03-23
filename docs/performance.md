---
title: Performance Benchmarks
order: 5.5
description: End-to-end performance benchmarks measured with Playwright against a live Node.js server.
---

# Performance Benchmarks

Every gate run measures end-to-end performance using Playwright (headless Chromium) against a live Node.js server on a random port. Each scenario runs for 3 seconds of sustained load. Web Worker transport and pako compression are enabled (defaults).

## Latest results

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'

const history = ref([])
const loaded = ref(false)
const throughputCanvas = ref(null)
const latencyCanvas = ref(null)
let throughputChart = null
let latencyChart = null

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
  if (h.length === 0) return null
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i].benchmarks && h[i].benchmarks.length > 0) return h[i]
  }
  return null
})

const benchmarks = computed(() => latest.value?.benchmarks ?? [])

function fmtOps(n) {
  if (n == null) return '—'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function fmtMs(n) {
  if (n == null || n === 0) return '—'
  if (n < 0.01) return '<0.01 ms'
  return n.toFixed(2) + ' ms'
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const scenarioLabels = {
  'rpc-echo': 'RPC echo (sequential)',
  'rpc-concurrent': 'RPC echo (10× concurrent)',
  'rpc-small-payload': 'RPC small payload (<256 B)',
  'rpc-large-json': 'RPC large JSON (>256 B, compressed)',
  'binary-frame-1kb': 'Binary frame streaming (1 KB)',
  'two-way-latency': 'Two-way emit (game tick / trade)',
  'server-event-receive': 'Server event receive',
  'state-sync-receive': 'Live state sync receive',
  'client-event-emit': 'Client event emit',
  'crdt-increment': 'CRDT PN counter increment',
  'mixed-workload': 'Mixed workload (RPC + events)',
}

function label(name) {
  return scenarioLabels[name] || name
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
  if (!loaded.value) return
  const withBench = history.value.filter(e => e.benchmarks && e.benchmarks.length > 0)
  if (withBench.length < 2) return
  await nextTick()
  const Chart = await loadChartJs()
  if (!Chart) return

  const labels = withBench.map(e => fmtDate(e.timestamp))
  const colors = ['#e8842c', '#3b82f6', '#22c55e', '#8b5cf6', '#6b7280', '#ef4444', '#eab308', '#14b8a6', '#f97316', '#a855f7', '#ec4899']

  // Throughput chart
  if (throughputCanvas.value) {
    const throughputScenarios = [
      'rpc-echo', 'rpc-small-payload', 'rpc-large-json', 'binary-frame-1kb',
      'server-event-receive', 'state-sync-receive', 'client-event-emit', 'crdt-increment', 'two-way-latency'
    ]
    const datasets = throughputScenarios.map((name, i) => ({
      label: scenarioLabels[name] || name,
      data: withBench.map(e => {
        const s = (e.benchmarks || []).find(b => b.name === name)
        return s ? s.opsPerSec : null
      }),
      borderColor: colors[i % colors.length],
      fill: false,
      tension: 0.3,
    })).filter(ds => ds.data.some(v => v != null))

    if (throughputChart) throughputChart.destroy()
    throughputChart = new Chart(throughputCanvas.value, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            title: { display: true, text: 'Date', font: { weight: 'bold' } },
          },
          y: {
            type: 'logarithmic',
            min: 1,
            title: { display: true, text: 'Throughput (ops/sec)', font: { weight: 'bold' } },
            ticks: { callback: v => fmtOps(v) },
          },
        },
        plugins: {
          tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtOps(ctx.parsed.y) + ' ops/sec' } },
        },
      },
    })
  }

  // Latency chart
  if (latencyCanvas.value) {
    const latencyScenarios = ['rpc-echo', 'rpc-small-payload', 'rpc-large-json', 'two-way-latency', 'crdt-increment', 'mixed-workload']
    const latencyDatasets = latencyScenarios.map((name, i) => ({
      label: scenarioLabels[name] || name,
      data: withBench.map(e => {
        const s = (e.benchmarks || []).find(b => b.name === name)
        return s && s.p50Ms > 0 ? s.p50Ms : null
      }),
      borderColor: colors[i % colors.length],
      fill: false,
      tension: 0.3,
    })).filter(ds => ds.data.some(v => v != null))

    if (latencyChart) latencyChart.destroy()
    latencyChart = new Chart(latencyCanvas.value, {
      type: 'line',
      data: { labels, datasets: latencyDatasets },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            title: { display: true, text: 'Date', font: { weight: 'bold' } },
          },
          y: {
            title: { display: true, text: 'Median latency — P50 (ms)', font: { weight: 'bold' } },
            ticks: { callback: v => v + ' ms' },
          },
        },
        plugins: {
          tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + (ctx.parsed.y != null ? ctx.parsed.y.toFixed(2) : '—') + ' ms' } },
        },
      },
    })
  }
}, { immediate: true })
</script>

<div v-if="loaded && benchmarks.length > 0">

<div class="bench-table">

| Scenario | Throughput | P50 latency | P95 latency | P99 latency | Total ops |
| :------- | ---------: | ----------: | ----------: | ----------: | --------: |

<template v-for="b in benchmarks" :key="b.name">
| {{ label(b.name) }} | **{{ fmtOps(b.opsPerSec) }} ops/s** | {{ fmtMs(b.p50Ms) }} | {{ fmtMs(b.p95Ms) }} | {{ fmtMs(b.p99Ms) }} | {{ fmtOps(b.totalOps) }} |
</template>

</div>

<p style="color: var(--vp-c-text-3); font-size: 0.85rem; margin-top: 1rem;">
Measured: {{ new Date(latest.timestamp).toLocaleString() }} — 3 s sustained load per scenario, headless Chromium, single Node.js process, Web Worker + pako compression enabled.
</p>

</div>

<div v-else-if="loaded">
<p>No benchmark data available yet. Run <code>npm run test:e2e</code> followed by <code>npm run collect-metrics</code> to generate benchmarks.</p>
</div>

<div v-else>
<p>Loading benchmark data...</p>
</div>

## Throughput over time

<div v-if="loaded && history.filter(e => e.benchmarks && e.benchmarks.length > 0).length > 1">

<div style="max-width: 800px; margin: 1rem 0;">
<canvas ref="throughputCanvas"></canvas>
</div>

<p style="color: var(--vp-c-text-3); font-size: 0.8rem;">
Logarithmic Y axis (ops/sec). "Client event emit" throughput is much higher than RPC because emit is fire-and-forget (no round-trip).
</p>

</div>

<div v-else-if="loaded">
<p>Not enough data points for trends yet.</p>
</div>

## Median latency over time

<div v-if="loaded && history.filter(e => e.benchmarks && e.benchmarks.length > 0).length > 1">

<div style="max-width: 800px; margin: 1rem 0;">
<canvas ref="latencyCanvas"></canvas>
</div>

<p style="color: var(--vp-c-text-3); font-size: 0.8rem;">
P50 (median) latency in milliseconds for round-trip scenarios. Lower is better.
</p>

</div>

<div v-else-if="loaded">
<p>Not enough data points for trends yet.</p>
</div>

## What's measured

Each benchmark connects a real browser client (datasole IIFE bundle in headless Chromium) to a live Node.js server via WebSocket and runs sustained load for 3 seconds:

| Scenario                     | Description                                                                                       |
| :--------------------------- | :------------------------------------------------------------------------------------------------ |
| **RPC echo**                 | Sequential `ds.rpc('echo', payload)` — full round-trip latency                                    |
| **RPC concurrent**           | 10 concurrent `ds.rpc()` calls per batch — multiplexed throughput                                 |
| **RPC small payload**        | `ds.rpc()` with a tiny JSON body (<256 B, below compression threshold)                            |
| **RPC large JSON**           | `ds.rpc()` with randomized JSON (~1 KB, above compression threshold) — exercises pako             |
| **Binary frame streaming**   | Server pushes 1 KB binary-like frames at max rate — simulates audio/video metadata streaming      |
| **Two-way low-latency emit** | Client emits, server echoes — measures full round-trip at emit speed (game ticks, trade confirms) |
| **Server event receive**     | Server broadcasts at max rate, client counts received events                                      |
| **Live state sync**          | Server mutates state rapidly, client receives JSON Patch diffs                                    |
| **Client event emit**        | Client fires `ds.emit()` in a tight loop — fire-and-forget throughput                             |
| **CRDT increment**           | Client increments a PN counter rapidly — CRDT op throughput                                       |
| **Mixed workload**           | Alternating RPC, emit, and add — combined throughput under mixed load                             |

All benchmarks run as part of the CI gate on every push to `main`.

<style>
.bench-table table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.bench-table th,
.bench-table td {
  padding: 8px 12px;
  white-space: nowrap;
}
.bench-table th {
  text-align: right;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.bench-table th:first-child {
  text-align: left;
}
.bench-table td:first-child {
  text-align: left;
  font-weight: 500;
}
.bench-table td {
  text-align: right;
  font-family: var(--vp-font-family-mono);
  font-size: 0.85rem;
}
.bench-table tr:hover td {
  background: var(--vp-c-bg-soft);
}
</style>
