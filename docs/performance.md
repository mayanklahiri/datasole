---
title: Performance Benchmarks
order: 5.5
description: End-to-end performance benchmarks measured with Playwright against a live Node.js server.
---

# Performance Benchmarks

Every gate run measures end-to-end performance using Playwright (headless Chromium) against a live Node.js server on a random port. Each scenario runs for 3 seconds of sustained load.

## Latest results

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'

const history = ref([])
const loaded = ref(false)
const throughputCanvas = ref(null)
let throughputChart = null

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
  if (n < 0.01) return '<0.01ms'
  return n.toFixed(2) + 'ms'
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const scenarioLabels = {
  'rpc-echo': 'RPC echo (sequential)',
  'rpc-concurrent': 'RPC echo (10x concurrent)',
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
  if (!Chart || !throughputCanvas.value) return

  const labels = withBench.map(e => fmtDate(e.timestamp))
  const colors = ['#e8842c', '#3b82f6', '#22c55e', '#8b5cf6', '#6b7280', '#ef4444', '#eab308']

  const keyScenarios = ['rpc-echo', 'server-event-receive', 'state-sync-receive', 'client-event-emit', 'crdt-increment']
  const datasets = keyScenarios.map((name, i) => ({
    label: scenarioLabels[name] || name,
    data: withBench.map(e => {
      const s = e.benchmarks.find(b => b.name === name)
      return s ? s.opsPerSec : null
    }),
    borderColor: colors[i % colors.length],
    fill: false,
    tension: 0.3,
  }))

  if (throughputChart) throughputChart.destroy()
  throughputChart = new Chart(throughputCanvas.value, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          type: 'logarithmic',
          min: 1,
          ticks: { callback: v => fmtOps(v) },
        },
      },
      plugins: {
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtOps(ctx.parsed.y) + ' ops/sec' } },
      },
    },
  })
}, { immediate: true })
</script>

<div v-if="loaded && benchmarks.length > 0">

| Scenario | Ops/sec | P50 | P95 | P99 | Total ops |
| -------- | ------: | --: | --: | --: | --------: |

<template v-for="b in benchmarks" :key="b.name">

| <span>{{ label(b.name) }}</span> | <strong><span>{{ fmtOps(b.opsPerSec) }}</span></strong> | <span>{{ fmtMs(b.p50Ms) }}</span> | <span>{{ fmtMs(b.p95Ms) }}</span> | <span>{{ fmtMs(b.p99Ms) }}</span> | <span>{{ fmtOps(b.totalOps) }}</span> |
</template>

<p style="color: var(--vp-c-text-3); font-size: 0.85rem; margin-top: 1rem;">
Measured: <span>{{ latest.timestamp }}</span> — 3s sustained load per scenario, headless Chromium, single Node.js process.
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
Logarithmic Y axis. "Client event emit" throughput is much higher than RPC because emit is fire-and-forget (no round-trip).
</p>

</div>

<div v-else-if="loaded">
<p>Not enough data points for trends yet.</p>
</div>

## What's measured

Each benchmark connects a real browser client (datasole IIFE bundle in headless Chromium) to a live Node.js server via WebSocket and runs sustained load for 3 seconds:

| Scenario                 | Description                                                                |
| ------------------------ | -------------------------------------------------------------------------- |
| **RPC echo**             | Sequential `ds.rpc('echo', payload)` — measures full round-trip latency    |
| **RPC concurrent**       | 10 concurrent `ds.rpc()` calls per batch — measures multiplexed throughput |
| **Server event receive** | Server broadcasts at max rate, client counts received events               |
| **Live state sync**      | Server mutates state rapidly, client receives JSON Patch diffs             |
| **Client event emit**    | Client fires `ds.emit()` in a tight loop — fire-and-forget throughput      |
| **CRDT increment**       | Client increments a PN counter rapidly — measures CRDT op throughput       |
| **Mixed workload**       | Alternating RPC, emit, and add — combined throughput under mixed load      |

All benchmarks run as part of the CI gate on every push to `main`.
