import { createServer } from 'http';

import { describe, it, expect, vi } from 'vitest';

import { ExpressAdapter } from '../../../../src/server/adapters/express';

describe('ExpressAdapter', () => {
  it('attaches to HTTP server', () => {
    const adapter = new ExpressAdapter();
    const server = createServer();
    adapter.attach(server);
    expect(adapter).toBeDefined();
    adapter.detach();
    server.close();
  });

  it('onUpgrade throws before attach', () => {
    const adapter = new ExpressAdapter();
    expect(() => adapter.onUpgrade(() => {})).toThrow('not attached');
  });

  it('onUpgrade registers upgrade listener', () => {
    const adapter = new ExpressAdapter();
    const server = createServer();
    adapter.attach(server);
    const handler = vi.fn();
    adapter.onUpgrade(handler);
    adapter.detach();
    server.close();
  });

  it('detach is idempotent', () => {
    const adapter = new ExpressAdapter();
    adapter.detach();
    adapter.detach();
  });
});
