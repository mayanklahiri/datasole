<script setup lang="ts">
import { useDatasoleEvent } from '../composables/useDatasole';

interface Metrics {
  uptime: number;
  connections: number;
  cpuUsage: number;
  memoryMB: number;
  cpuCount: number;
  totalMemoryGB: number;
  serverTime: string;
  timezone: string;
  messagesIn: number;
  messagesOut: number;
  timestamp: number;
}

const metrics = useDatasoleEvent<Metrics>('system-metrics');

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (h > 0 ? `${h}h ` : '') + `${m}m ${sec}s`;
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">Server Metrics</div>
    <div class="panel-body">
      <div class="panel-help"><code>useDatasoleEvent('system-metrics')</code> &mdash; one line, no Pinia/Vuex, no <code>watch()</code>. Data arrives reactively from the Web Worker.</div>
      <div v-if="!metrics" class="metrics-waiting">Waiting for metrics&hellip;</div>
      <div v-else class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Uptime</div>
          <div class="metric-value accent">{{ formatUptime(metrics.uptime) }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Connections</div>
          <div class="metric-value">{{ metrics.connections }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">CPU</div>
          <div class="metric-value">{{ metrics.cpuUsage }}<span class="metric-unit">ms</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Memory</div>
          <div class="metric-value">{{ metrics.memoryMB }}<span class="metric-unit">MB</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">CPUs</div>
          <div class="metric-value">{{ metrics.cpuCount }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total RAM</div>
          <div class="metric-value">{{ metrics.totalMemoryGB }}<span class="metric-unit">GB</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Messages In</div>
          <div class="metric-value">{{ metrics.messagesIn }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Messages Out</div>
          <div class="metric-value">{{ metrics.messagesOut }}</div>
        </div>
        <div class="metric-card span-2">
          <div class="metric-label">Server Time</div>
          <div class="metric-value">{{ metrics.serverTime }}<span class="metric-unit">{{ metrics.timezone }}</span></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  overflow: hidden;
}
.panel-header {
  padding: 12px 20px;
  font-size: 0.82rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.metric-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  transition: border-color 0.2s;
}
.metric-card:hover { border-color: var(--accent); }
.metric-card.span-2 { grid-column: span 2; }
.panel-help {
  font-size: 0.75rem;
  color: var(--text-dim);
  line-height: 1.5;
  padding-bottom: 10px;
}
.panel-help code {
  font-family: var(--mono);
  font-size: 0.7rem;
  background: var(--surface-hover);
  padding: 1px 5px;
  border-radius: 4px;
}
.metric-label {
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  margin-bottom: 6px;
}
.metric-value {
  font-size: 1.6rem;
  font-weight: 700;
  font-family: var(--mono);
  color: var(--text);
  line-height: 1.2;
}
.metric-value.accent { color: var(--accent); }
.metric-unit {
  font-size: 0.7rem;
  color: var(--text-dim);
  margin-left: 4px;
  font-weight: 400;
}
.metrics-waiting {
  color: var(--text-dim);
  font-size: 0.85rem;
  text-align: center;
  padding: 40px 0;
}
</style>
