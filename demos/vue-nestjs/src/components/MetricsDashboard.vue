<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import type { DatasoleClient } from 'datasole/client';

const props = defineProps<{ ds: DatasoleClient | null }>();

interface Metrics {
  uptime: number;
  connections: number;
  cpuUsage: number;
  memoryMB: number;
  messagesIn: number;
  messagesOut: number;
  timestamp: number;
}

const metrics = ref<Metrics | null>(null);

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (h > 0 ? `${h}h ` : '') + `${m}m ${sec}s`;
}

let cleanup: (() => void) | null = null;

watch(
  () => props.ds,
  (ds) => {
    cleanup?.();
    cleanup = null;
    if (!ds) return;
    const handler = (ev: { data: Metrics }) => { metrics.value = ev.data; };
    ds.on('system-metrics', handler);
    cleanup = () => ds.off('system-metrics', handler);
  },
  { immediate: true },
);

onUnmounted(() => cleanup?.());
</script>

<template>
  <div class="panel">
    <div class="panel-header">Server Metrics</div>
    <div class="panel-body">
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
          <div class="metric-label">Messages In</div>
          <div class="metric-value">{{ metrics.messagesIn }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Messages Out</div>
          <div class="metric-value">{{ metrics.messagesOut }}</div>
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
