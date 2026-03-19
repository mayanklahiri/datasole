import { describe, it, expect } from 'vitest';

import { Connection } from '../../../src/server/transport/connection';

describe('Connection', () => {
  it('constructor sets info and context from info', () => {
    const info = {
      id: 'conn-1',
      remoteAddress: '127.0.0.1',
      connectedAt: Date.now(),
      auth: { userId: 'u1', roles: ['admin'], metadata: { role: 'admin' } },
    };
    const c = new Connection(info);
    expect(c.info).toBe(info);
    expect(c.context.connectionId).toBe('conn-1');
    expect(c.context.userId).toBe('u1');
    expect(c.context.remoteAddress).toBe('127.0.0.1');
    expect(c.context.auth).toEqual(info.auth);
  });

  it('send throws when no WebSocket', async () => {
    const c = new Connection({
      id: 'x',
      remoteAddress: '::1',
      connectedAt: 0,
      auth: null,
    });
    await expect(c.send(new Uint8Array([1]))).rejects.toThrow(/not open/);
  });

  it('close does not throw without ws', () => {
    const c = new Connection({
      id: 'x',
      remoteAddress: '::1',
      connectedAt: 0,
      auth: null,
    });
    expect(() => c.close()).not.toThrow();
  });

  it('isOpen returns false when no ws', () => {
    const c = new Connection({
      id: 'x',
      remoteAddress: '::1',
      connectedAt: 0,
      auth: null,
    });
    expect(c.isOpen()).toBe(false);
  });
});
