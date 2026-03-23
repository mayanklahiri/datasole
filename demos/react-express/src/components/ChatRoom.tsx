import { useEffect, useRef, useState } from 'react';
import { useDatasoleState, useDatasoleClient } from '../hooks/useDatasole';

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

export function ChatRoom() {
  const messages = useDatasoleState<ChatMessage[]>('chat:messages');
  const ds = useDatasoleClient();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

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
        <code>useDatasoleState('chat:messages')</code> &mdash; the server IS the store. No dedup, no
        manual subscribe. Open a second tab to try.
      </div>
      <div className="chat-messages">
        {(!messages || messages.length === 0) && (
          <div className="chat-empty">No messages yet</div>
        )}
        {(messages ?? []).map((msg) => (
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
