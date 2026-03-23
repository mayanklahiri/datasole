<script setup lang="ts">
import type { ConnectionState } from 'datasole/client';

defineProps<{
  connectionState: ConnectionState;
}>();
</script>

<template>
  <div class="app">
    <header>
      <h1>datasole</h1>
      <span class="subtitle">Vue 3 + NestJS Demo</span>
      <div class="conn-badge">
        <span :class="['conn-dot', { connected: connectionState === 'connected' }]" />
        <span>{{ connectionState }}</span>
      </div>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}
header h1 {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.02em;
}
.subtitle {
  font-size: 0.78rem;
  color: var(--text-dim);
}
.conn-badge {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-family: var(--mono);
}
.conn-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--red);
  transition: background 0.3s;
}
.conn-dot.connected { background: var(--green); }
main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0;
  overflow: hidden;
}
@media (max-width: 1024px) {
  main {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    overflow-y: auto;
  }
}
</style>
