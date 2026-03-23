import type { ReactNode } from 'react';
import type { ConnectionState } from 'datasole/client';

interface LayoutProps {
  connectionState: ConnectionState;
  children: ReactNode;
}

export function Layout({ connectionState, children }: LayoutProps) {
  return (
    <div className="app">
      <header>
        <h1>datasole</h1>
        <span className="subtitle">React + Express Demo</span>
        <a
          className="gh-link"
          href="https://github.com/mayanklahiri/datasole"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <div className="conn-badge">
          <span className={`conn-dot${connectionState === 'connected' ? ' connected' : ''}`} />
          <span>{connectionState}</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
