<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDatasoleClient } from '../composables/useDatasole';
import { RpcMethod } from '../../shared/contract';

const ds = useDatasoleClient();

interface RpcResult {
  value: number;
  min: number;
  max: number;
  ms: string;
}

const min = ref(1);
const max = ref(100);
const result = ref<RpcResult | null>(null);
const history = ref<RpcResult[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const pop = ref(false);

const avgLatency = computed(() => {
  if (history.value.length === 0) return null;
  const sum = history.value.reduce((a, r) => a + parseFloat(r.ms), 0);
  return (sum / history.value.length).toFixed(1);
});

async function generate() {
  if (!ds.value) return;
  loading.value = true;
  error.value = null;
  const lo = Math.min(min.value, max.value);
  const hi = Math.max(min.value, max.value);
  const start = performance.now();
  try {
    const data = await ds.value.rpc(RpcMethod.RandomNumber, { min: lo, max: hi });
    const elapsed = (performance.now() - start).toFixed(1);
    const entry: RpcResult = { value: data.value, min: lo, max: hi, ms: elapsed };
    result.value = entry;
    history.value = [entry, ...history.value].slice(0, 10);

    pop.value = true;
    setTimeout(() => {
      pop.value = false;
    }, 300);
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
  loading.value = false;
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">RPC &mdash; Random Number</div>
    <div class="panel-body">
      <div class="panel-help">
        <code>await ds.rpc(RpcMethod.RandomNumber, { min, max })</code> — typed request/response
        over the WebSocket. Latency is the full round trip. No REST endpoint needed.
      </div>
      <div class="rpc-section">
        <div class="rpc-controls">
          <div class="rpc-row">
            <label>Min</label>
            <input v-model.number="min" type="number" />
            <label>Max</label>
            <input v-model.number="max" type="number" />
          </div>
          <button class="btn" :disabled="loading || !ds" @click="generate">
            {{ loading ? 'Generating…' : 'Generate' }}
          </button>
        </div>

        <div class="rpc-result">
          <div v-if="error" class="rpc-result-empty" style="color: var(--red)">
            Error: {{ error }}
          </div>
          <template v-else-if="result">
            <div :class="['rpc-result-value', { pop }]">{{ result.value }}</div>
            <div class="rpc-result-meta">
              Range [{{ result.min }}, {{ result.max }}] &middot; {{ result.ms }}&thinsp;ms
            </div>
          </template>
          <div v-else class="rpc-result-empty">Press Generate to get a random number</div>
        </div>

        <div v-if="history.length > 0" class="rpc-history">
          <div class="rpc-history-title">
            History <span v-if="avgLatency" class="avg-badge">avg {{ avgLatency }}&thinsp;ms</span>
          </div>
          <TransitionGroup name="hist" tag="div" class="hist-list">
            <div
              v-for="(h, i) in history"
              :key="`${h.value}-${h.ms}-${i}`"
              class="rpc-history-item"
            >
              <span class="val">{{ h.value }}</span>
              <span class="meta">[{{ h.min }}–{{ h.max }}] {{ h.ms }}&thinsp;ms</span>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
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
.rpc-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.rpc-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rpc-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rpc-row label {
  font-size: 0.78rem;
  color: var(--text-dim);
  min-width: 36px;
}
.rpc-row input[type='number'] {
  width: 80px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--text);
  font-family: var(--mono);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}
.rpc-row input[type='number']:focus {
  border-color: var(--accent);
}
.rpc-result {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  text-align: center;
}
.rpc-result-value {
  font-size: 3rem;
  font-weight: 700;
  font-family: var(--mono);
  color: var(--accent);
  line-height: 1.2;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.rpc-result-value.pop {
  transform: scale(1.12);
}
.rpc-result-empty {
  color: var(--text-dim);
  font-size: 0.85rem;
}
.rpc-result-meta {
  font-size: 0.72rem;
  color: var(--text-dim);
  margin-top: 8px;
}
.rpc-history {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rpc-history-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.avg-badge {
  font-size: 0.65rem;
  font-weight: 400;
  font-family: var(--mono);
  text-transform: none;
  letter-spacing: 0;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 1px 7px;
  border-radius: 10px;
}
.hist-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hist-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}
.hist-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.hist-enter-to {
  opacity: 1;
  transform: translateX(0);
}
.rpc-history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--mono);
  font-size: 0.78rem;
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.rpc-history-item .val {
  color: var(--accent);
  font-weight: 600;
}
.rpc-history-item .meta {
  color: var(--text-dim);
  font-size: 0.7rem;
}
.btn {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 18px;
  font-family: var(--sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.btn:hover {
  opacity: 0.85;
}
.btn:active {
  opacity: 0.7;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
