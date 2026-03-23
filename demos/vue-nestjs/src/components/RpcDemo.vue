<script setup lang="ts">
import { ref } from 'vue';
import type { DatasoleClient } from 'datasole/client';

const props = defineProps<{ ds: DatasoleClient | null }>();

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

async function generate() {
  if (!props.ds) return;
  loading.value = true;
  error.value = null;
  const lo = Math.min(min.value, max.value);
  const hi = Math.max(min.value, max.value);
  const start = performance.now();
  try {
    const data = (await props.ds.rpc('randomNumber', { min: lo, max: hi })) as {
      value: number;
      generatedAt: number;
    };
    const elapsed = (performance.now() - start).toFixed(1);
    const entry: RpcResult = { value: data.value, min: lo, max: hi, ms: elapsed };
    result.value = entry;
    history.value = [entry, ...history.value].slice(0, 10);
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
            <div class="rpc-result-value">{{ result.value }}</div>
            <div class="rpc-result-meta">
              Range [{{ result.min }}, {{ result.max }}] &middot; {{ result.ms }} ms
            </div>
          </template>
          <div v-else class="rpc-result-empty">Press Generate to get a random number</div>
        </div>

        <div v-if="history.length > 0" class="rpc-history">
          <div class="rpc-history-title">History</div>
          <div v-for="(h, i) in history" :key="i" class="rpc-history-item">
            <span class="val">{{ h.value }}</span>
            <span class="meta">[{{ h.min }}–{{ h.max }}] {{ h.ms }} ms</span>
          </div>
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
.rpc-row input[type="number"] {
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
.rpc-row input[type="number"]:focus { border-color: var(--accent); }
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
.rpc-history-item .val { color: var(--accent); font-weight: 600; }
.rpc-history-item .meta { color: var(--text-dim); font-size: 0.7rem; }
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
.btn:hover { opacity: 0.85; }
.btn:active { opacity: 0.7; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
