import { describe, it, expect } from 'vitest';

import { Connection } from '../../../src/server/transport';

describe('Connection', () => {
  it('should store connection info', () => {
    const conn = new Connection({
      id: 'test-1',
      remoteAddress: '127.0.0.1',
      connectedAt: Date.now(),
      auth: null,
    });
    expect(conn.info.id).toBe('test-1');
  });
});
