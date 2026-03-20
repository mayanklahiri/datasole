import type { IncomingMessage } from 'http';

import { describe, it, expect, vi } from 'vitest';

import { handleUpgrade } from '../../../../src/server/transport/upgrade-handler';

function fakeRequest(headers?: Record<string, string>): IncomingMessage {
  return { headers: headers ?? {} } as unknown as IncomingMessage;
}

describe('handleUpgrade', () => {
  it('returns authenticated:true when no authHandler provided', async () => {
    const result = await handleUpgrade(fakeRequest());
    expect(result).toEqual({ authenticated: true });
  });

  it('calls authHandler and returns its result', async () => {
    const authHandler = vi.fn().mockResolvedValue({
      authenticated: true,
      userId: 'user-1',
      roles: ['admin'],
    });
    const req = fakeRequest({ authorization: 'Bearer tok' });

    const result = await handleUpgrade(req, authHandler);
    expect(authHandler).toHaveBeenCalledWith(req);
    expect(result).toEqual({
      authenticated: true,
      userId: 'user-1',
      roles: ['admin'],
    });
  });

  it('returns unauthenticated result from authHandler', async () => {
    const authHandler = vi.fn().mockResolvedValue({ authenticated: false });
    const result = await handleUpgrade(fakeRequest(), authHandler);
    expect(result).toEqual({ authenticated: false });
  });

  it('propagates errors from authHandler', async () => {
    const authHandler = vi.fn().mockRejectedValue(new Error('Auth failed'));
    await expect(handleUpgrade(fakeRequest(), authHandler)).rejects.toThrow('Auth failed');
  });
});
