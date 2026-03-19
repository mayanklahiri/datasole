import { describe, expect, it } from 'vitest';

import { DefaultConnectionContext } from '../../../src/server/transport/connection-context';

describe('DefaultConnectionContext', () => {
  it('initializes from auth', () => {
    const ctx = new DefaultConnectionContext({
      connectionId: 'conn-1',
      auth: { userId: 'user-42', roles: ['admin', 'user'], metadata: { org: 'acme' } },
      remoteAddress: '10.0.0.1',
    });

    expect(ctx.connectionId).toBe('conn-1');
    expect(ctx.userId).toBe('user-42');
    expect(ctx.auth).toEqual({
      userId: 'user-42',
      roles: ['admin', 'user'],
      metadata: { org: 'acme' },
    });
    expect(ctx.remoteAddress).toBe('10.0.0.1');
    expect(ctx.connectedAt).toBeLessThanOrEqual(Date.now());
    expect(ctx.metadata).toEqual({ org: 'acme' });
    expect(ctx.tags).toBeInstanceOf(Set);
    expect(ctx.tags.size).toBe(0);
  });

  it('handles null auth', () => {
    const ctx = new DefaultConnectionContext({
      connectionId: 'conn-2',
      auth: null,
      remoteAddress: '::1',
    });

    expect(ctx.userId).toBeNull();
    expect(ctx.auth).toBeNull();
    expect(ctx.metadata).toEqual({});
  });

  it('get/set/delete arbitrary keys', () => {
    const ctx = new DefaultConnectionContext({
      connectionId: 'conn-1',
      auth: null,
      remoteAddress: '127.0.0.1',
    });

    expect(ctx.get('foo')).toBeUndefined();

    ctx.set('foo', 'bar');
    expect(ctx.get('foo')).toBe('bar');

    ctx.set('num', 42);
    expect(ctx.get<number>('num')).toBe(42);

    expect(ctx.delete('foo')).toBe(true);
    expect(ctx.get('foo')).toBeUndefined();
    expect(ctx.delete('foo')).toBe(false);
  });

  it('tags are mutable', () => {
    const ctx = new DefaultConnectionContext({
      connectionId: 'conn-1',
      auth: null,
      remoteAddress: '127.0.0.1',
    });

    ctx.tags.add('premium');
    ctx.tags.add('beta');
    expect(ctx.tags.has('premium')).toBe(true);
    expect(ctx.tags.size).toBe(2);
  });
});
