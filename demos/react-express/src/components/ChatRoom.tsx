import { useEffect, useRef, useState, useCallback } from 'react';
import type { DatasoleClient } from 'datasole/client';

interface ChatMessage {
  id: string;
  text: string;
  username: string;
  ts: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

const username = 'user-' + Math.random().toString(36).slice(2, 7);

export function ChatRoom({ ds }: { ds: DatasoleClient | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef(new Set<string>());

  const addMessage = useCallback((msg: ChatMessage) => {
    if (seenRef.current.has(msg.id)) return;
    seenRef.current.add(msg.id);
    setMessages((prev) => [...prev, msg]);
  }, []);

  useEffect(() => {
    if (!ds) return;

    const onBroadcast = (ev: { data: ChatMessage }) => addMessage(ev.data);
    ds.on('chat:message', onBroadcast);

    const unsub = ds.subscribeState('chat:messages', (msgs: ChatMessage[]) => {
      if (!msgs) return;
      seenRef.current = new Set(msgs.map((m) => m.id));
      setMessages(msgs);
    });

    return () => {
      ds.off('chat:message', onBroadcast);
      unsub();
    };
  }, [ds, addMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || !ds) return;
    ds.emit('chat:send', { text, username });
    setInput('');
  };

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">Chat</div>
      <div className="panel-help" style={{ padding: '8px 20px 0' }}>
        Global chatroom: messages are broadcast to all connected clients in real time. Open a second
        browser tab to try it.
      </div>
      <div className="chat-messages">
        {messages.length === 0 && <div className="chat-empty">No messages yet</div>}
        {messages.map((msg) => (
          <div key={msg.id} className="chat-msg">
            <div className="author">
              {msg.username}
              <span className="time">{formatTime(msg.ts)}</span>
            </div>
            <div className="body">{msg.text}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-bar">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message…"
        />
        <button className="btn" onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}
