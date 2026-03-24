<script setup lang="ts">
import { useDatasole } from './composables/useDatasole';
import AppLayout from './components/AppLayout.vue';
import MetricsDashboard from './components/MetricsDashboard.vue';
import ChatRoom from './components/ChatRoom.vue';
import RpcDemo from './components/RpcDemo.vue';

useDatasole();
</script>

<template>
  <AppLayout>
    <MetricsDashboard />
    <ChatRoom />
    <RpcDemo />
  </AppLayout>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #0f1117;
  --surface: #1a1d27;
  --surface-hover: #22263a;
  --border: #2a2e3e;
  --text: #e4e6ed;
  --text-dim: #8b8fa3;
  --accent: #e8842c;
  --accent-soft: rgba(232, 132, 44, 0.15);
  --green: #22c55e;
  --red: #ef4444;
  --radius: 10px;
  --mono: 'JetBrains Mono', monospace;
  --sans: 'Inter', system-ui, sans-serif;
}

html,
body,
#app {
  height: 100%;
}
body {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  overflow-x: hidden;
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-dim);
}
</style>
