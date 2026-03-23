<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useDatasoleState, useDatasoleClient } from '../composables/useDatasole';

interface ChatMessage {
  id: string;
  text: string;
  username: string;
  ts: number;
}

const messages = useDatasoleState<ChatMessage[]>('chat:messages');
const ds = useDatasoleClient();
const input = ref('');
const bottomEl = ref<HTMLDivElement | null>(null);
const username = 'user-' + Math.random().toString(36).slice(2, 7);

function formatTime(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

watch(messages, () => {
  nextTick(() => bottomEl.value?.scrollIntoView({ behavior: 'smooth' }));
});

function send() {
  const text = input.value.trim();
  if (!text || !ds.value) return;
  ds.value.emit('chat:send', { text, username });
  input.value = '';
}
</script>

<template>
  <div class="panel chat-panel">
    <div class="panel-header">Chat</div>
    <div class="panel-help"><code>useDatasoleState('chat:messages')</code> &mdash; the server IS the store. No dedup, no manual subscribe. Open a second tab to try.</div>
    <div class="chat-messages">
      <div v-if="!messages || messages.length === 0" class="chat-empty">No messages yet</div>
      <div v-for="msg in messages ?? []" :key="msg.id" class="chat-msg">
        <div class="author">
          {{ msg.username }}
          <span class="time">{{ formatTime(msg.ts) }}</span>
        </div>
        <div class="body">{{ msg.text }}</div>
      </div>
      <div ref="bottomEl" />
    </div>
    <div class="chat-input-bar">
      <input
        v-model="input"
        placeholder="Type a message…"
        @keydown.enter="send"
      />
      <button class="btn" @click="send">Send</button>
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
.panel-help {
  font-size: 0.75rem;
  color: var(--text-dim);
  line-height: 1.5;
  padding: 8px 20px 0;
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chat-msg {
  max-width: 85%;
  padding: 8px 14px;
  border-radius: 12px;
  font-size: 0.85rem;
  line-height: 1.4;
  background: var(--surface);
  border: 1px solid var(--border);
  word-break: break-word;
}
.chat-msg .author {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 2px;
}
.chat-msg .time {
  font-size: 0.65rem;
  color: var(--text-dim);
  margin-left: 8px;
  font-weight: 400;
}
.chat-msg .body { color: var(--text); }
.chat-empty {
  color: var(--text-dim);
  font-size: 0.85rem;
  text-align: center;
  padding: 40px 0;
}
.chat-input-bar {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}
.chat-input-bar input {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 14px;
  color: var(--text);
  font-family: var(--sans);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}
.chat-input-bar input:focus { border-color: var(--accent); }
.chat-input-bar input::placeholder { color: var(--text-dim); }
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
</style>
