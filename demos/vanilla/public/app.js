/* global Datasole */

(function () {
  'use strict';

  // ─── Datasole client ──────────────────────────────────────────────
  const ds = new Datasole.DatasoleClient({
    url: 'ws://' + location.host,
  });
  ds.connect();

  // ─── Connection status ────────────────────────────────────────────
  const connDot = document.getElementById('conn-dot');
  const connLabel = document.getElementById('conn-label');
  setInterval(function () {
    const state = ds.getConnectionState();
    connDot.classList.toggle('connected', state === 'connected');
    connLabel.textContent = state;
  }, 500);

  // ─── Username ─────────────────────────────────────────────────────
  const username = 'user-' + Math.random().toString(36).slice(2, 7);

  // ─── Metrics ──────────────────────────────────────────────────────
  const metricsEl = document.getElementById('metrics-content');

  function formatUptime(ms) {
    let s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    s = s % 60;
    return (h > 0 ? h + 'h ' : '') + m + 'm ' + s + 's';
  }

  ds.on('system-metrics', function (ev) {
    const d = ev.data;
    metricsEl.className = 'metrics-grid';
    metricsEl.innerHTML =
      '<div class="metric-card">' +
      '<div class="metric-label">Uptime</div>' +
      '<div class="metric-value accent">' +
      formatUptime(d.uptime) +
      '</div>' +
      '</div>' +
      '<div class="metric-card">' +
      '<div class="metric-label">Connections</div>' +
      '<div class="metric-value">' +
      d.connections +
      '</div>' +
      '</div>' +
      '<div class="metric-card">' +
      '<div class="metric-label">CPU</div>' +
      '<div class="metric-value">' +
      d.cpuUsage +
      '<span class="metric-unit">ms</span></div>' +
      '</div>' +
      '<div class="metric-card">' +
      '<div class="metric-label">Memory</div>' +
      '<div class="metric-value">' +
      d.memoryMB +
      '<span class="metric-unit">MB</span></div>' +
      '</div>' +
      '<div class="metric-card">' +
      '<div class="metric-label">CPUs</div>' +
      '<div class="metric-value">' +
      d.cpuCount +
      '</div>' +
      '</div>' +
      '<div class="metric-card">' +
      '<div class="metric-label">Total RAM</div>' +
      '<div class="metric-value">' +
      d.totalMemoryGB +
      '<span class="metric-unit">GB</span></div>' +
      '</div>' +
      '<div class="metric-card">' +
      '<div class="metric-label">Messages In</div>' +
      '<div class="metric-value">' +
      d.messagesIn +
      '</div>' +
      '</div>' +
      '<div class="metric-card">' +
      '<div class="metric-label">Messages Out</div>' +
      '<div class="metric-value">' +
      d.messagesOut +
      '</div>' +
      '</div>' +
      '<div class="metric-card span-2">' +
      '<div class="metric-label">Server Time</div>' +
      '<div class="metric-value">' +
      d.serverTime +
      '<span class="metric-unit">' +
      d.timezone +
      '</span></div>' +
      '</div>';
  });

  // ─── Chat ─────────────────────────────────────────────────────────
  const chatMessages = document.getElementById('chat-messages');
  const chatEmpty = document.getElementById('chat-empty');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  const seenIds = new Set();

  function formatTime(ts) {
    const d = new Date(ts);
    return (
      d.getHours().toString().padStart(2, '0') +
      ':' +
      d.getMinutes().toString().padStart(2, '0') +
      ':' +
      d.getSeconds().toString().padStart(2, '0')
    );
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function appendMessage(msg) {
    if (seenIds.has(msg.id)) return;
    seenIds.add(msg.id);
    if (chatEmpty) chatEmpty.style.display = 'none';
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML =
      '<div class="author">' +
      escapeHtml(msg.username) +
      '<span class="time">' +
      formatTime(msg.ts) +
      '</span></div>' +
      '<div class="body">' +
      escapeHtml(msg.text) +
      '</div>';
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  ds.on('chat:message', function (ev) {
    appendMessage(ev.data);
  });

  ds.subscribeState('chat:messages', function (messages) {
    if (!messages) return;
    seenIds.clear();
    chatMessages.innerHTML = '';
    messages.forEach(function (msg) {
      appendMessage(msg);
    });
  });

  function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    ds.emit('chat:send', { text, username });
    chatInput.value = '';
  }

  chatSend.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendChat();
  });

  // ─── RPC ──────────────────────────────────────────────────────────
  const rpcCall = document.getElementById('rpc-call');
  const rpcResult = document.getElementById('rpc-result');
  const rpcHistory = document.getElementById('rpc-history');
  const rpcMin = document.getElementById('rpc-min');
  const rpcMax = document.getElementById('rpc-max');
  const history = [];

  rpcCall.addEventListener('click', async function () {
    let min = parseInt(rpcMin.value, 10) || 1;
    let max = parseInt(rpcMax.value, 10) || 100;
    if (min > max) {
      [min, max] = [max, min];
    }

    rpcCall.disabled = true;
    const start = performance.now();
    try {
      const data = await ds.rpc('randomNumber', { min, max });
      const elapsed = (performance.now() - start).toFixed(1);

      rpcResult.innerHTML =
        '<div class="rpc-result-value">' +
        data.value +
        '</div>' +
        '<div class="rpc-result-meta">Range [' +
        min +
        ', ' +
        max +
        '] &middot; ' +
        elapsed +
        ' ms</div>';

      history.unshift({ value: data.value, min, max, ms: elapsed });
      if (history.length > 10) history.pop();
      renderHistory();
    } catch (err) {
      rpcResult.innerHTML =
        '<div class="rpc-result-empty" style="color:var(--red)">Error: ' +
        escapeHtml(err.message || String(err)) +
        '</div>';
    }
    rpcCall.disabled = false;
  });

  function renderHistory() {
    if (history.length === 0) {
      rpcHistory.innerHTML = '';
      return;
    }
    let html = '<div class="rpc-history-title">History</div>';
    history.forEach(function (h) {
      html +=
        '<div class="rpc-history-item">' +
        '<span class="val">' +
        h.value +
        '</span>' +
        '<span class="meta">[' +
        h.min +
        '–' +
        h.max +
        '] ' +
        h.ms +
        ' ms</span>' +
        '</div>';
    });
    rpcHistory.innerHTML = html;
  }
})();
