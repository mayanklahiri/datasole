import { createServer } from 'http';

import { describe, it, expect, vi } from 'vitest';

import { NativeHttpAdapter } from '../../../../src/server/adapters/native-http';

describe('NativeHttpAdapter', () => {
  it('attaches to HTTP server', () => {
    const adapter = new NativeHttpAdapter();
    const server = createServer();
    adapter.attach(server);
    expect(adapter).toBeDefined();
    adapter.detach();
    server.close();
  });

  it('onUpgrade throws before attach', () => {
    const adapter = new NativeHttpAdapter();
    expect(() => adapter.onUpgrade(() => {})).toThrow('not attached');
  });

  it('onUpgrade registers upgrade listener', () => {
    const adapter = new NativeHttpAdapter();
    const server = createServer();
    adapter.attach(server);
    const handler = vi.fn();
    adapter.onUpgrade(handler);
    adapter.detach();
    server.close();
  });

  it('detach is idempotent', () => {
    const adapter = new NativeHttpAdapter();
    adapter.detach();
  });
});
