import type { IncomingMessage } from 'http';

import { describe, it, expect, vi } from 'vitest';

import { createAuthHandler } from '../../../src/server/auth/auth-handler';

describe('createAuthHandler', () => {
  it('returns handler result when authenticated', async () => {
    const h = createAuthHandler(async () => ({ authenticated: true, userId: 'u' }));
    const r = await h.verify({} as never);
    expect(r).toEqual({ authenticated: true, userId: 'u' });
  });

  it('rejects when not authenticated, required, and anonymous not allowed', async () => {
    const h = createAuthHandler(async () => ({ authenticated: false }));
    const r = await h.verify({} as never);
    expect(r).toEqual({ authenticated: false });
  });

  it('returns unauthenticated result when allowAnonymous', async () => {
    const h = createAuthHandler(async () => ({ authenticated: false }), {
      allowAnonymous: true,
    });
    const r = await h.verify({} as never);
    expect(r).toEqual({ authenticated: false });
  });

  it('returns unauthenticated when required is false', async () => {
    const h = createAuthHandler(async () => ({ authenticated: false }), {
      required: false,
    });
    const r = await h.verify({} as never);
    expect(r).toEqual({ authenticated: false });
  });

  it('on throw, returns anonymous when allowAnonymous', async () => {
    const h = createAuthHandler(async () => Promise.reject(new Error('boom')), {
      allowAnonymous: true,
    });
    const r = await h.verify({} as never);
    expect(r).toEqual({ authenticated: true, userId: 'anonymous' });
  });

  it('on throw, returns not authenticated when anonymous not allowed', async () => {
    const h = createAuthHandler(async () => Promise.reject(new Error('boom')));
    const r = await h.verify({} as never);
    expect(r).toEqual({ authenticated: false });
  });

  it('invokes user handler with request', async () => {
    const fn = vi.fn(async () => ({ authenticated: true, userId: 'x' }));
    const req = { url: '/x' } as IncomingMessage;
    const h = createAuthHandler(fn);
    await h.verify(req);
    expect(fn).toHaveBeenCalledWith(req);
  });
});
