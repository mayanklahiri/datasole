<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { useDatasoleState, useDatasoleClient } from '../composables/useDatasole';

interface ChatMessage {
  id: string;
  text: string;
  username: string;
  ts: number;
}

// Server state → reactive ref. The server calls setState('chat:messages', [...]),
// datasole diffs it, compresses it, ships it via Web Worker, and this ref just updates.
const messages = useDatasoleState<ChatMessage[]>('chat:messages');
const ds = useDatasoleClient();
const input = ref('');
const bottomEl = ref<HTMLDivElement | null>(null);
const username = 'demo-user';

const messageCount = computed(() => messages.value?.length ?? 0);

function formatTime(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

// Auto-scroll is the only watch — and it's a UI concern, not state management.
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
    <div class="panel-header">
      Chat <span v-if="messageCount" class="msg-count">{{ messageCount }}</span>
    </div>
    <div class="panel-help">
      <code>const messages = useDatasoleState('chat:messages')</code> — the server IS the store.
      State syncs via JSON Patch over the wire. Open two tabs to see it live.
    </div>
    <div class="chat-messages">
      <div v-if="!messages || messages.length === 0" class="chat-empty">No messages yet</div>
      <TransitionGroup name="msg" tag="div" class="msg-list">
        <div v-for="msg in messages ?? []" :key="msg.id" class="chat-msg">
          <div class="author">
            {{ msg.username }}
            <span class="time">{{ formatTime(msg.ts) }}</span>
          </div>
          <div class="body">{{ msg.text }}</div>
        </div>
      </TransitionGroup>
      <div ref="bottomEl" />
    </div>
    <div class="chat-input-bar">
      <input v-model="input" placeholder="Type a message…" @keydown.enter="send" />
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
  display: flex;
  align-items: center;
  gap: 8px;
}
.msg-count {
  font-size: 0.65rem;
  background: var(--accent-soft);
  color: var(--accent);
  padding: 1px 7px;
  border-radius: 10px;
  font-family: var(--mono);
}
.panel-help {
  font-size: 0.75rem;
  color: var(--text-dim);
  line-height: 1.5;
  padding: 8px 20px 0;
}
.panel-help code {
  font-family: var(--mono);
  font-size: 0.7rem;
  background: var(--surface-hover);
  padding: 1px 5px;
  border-radius: 4px;
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
.msg-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* TransitionGroup slide-in animation */
.msg-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.msg-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.msg-enter-to {
  opacity: 1;
  transform: translateY(0);
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
.chat-msg .body {
  color: var(--text);
}
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
.chat-input-bar input:focus {
  border-color: var(--accent);
}
.chat-input-bar input::placeholder {
  color: var(--text-dim);
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
</style>
