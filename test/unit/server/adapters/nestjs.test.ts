import { createServer } from 'http';

import { describe, it, expect } from 'vitest';

import { DatasoleNestAdapter } from '../../../../src/server/adapters/nestjs';

describe('DatasoleNestAdapter', () => {
  it('constructs', () => {
    const adapter = new DatasoleNestAdapter();
    expect(adapter).toBeDefined();
  });

  it('attach and detach lifecycle', () => {
    const adapter = new DatasoleNestAdapter();
    const server = createServer();
    adapter.attach(server);
    adapter.detach();
    server.close();
  });

  it('create returns server', () => {
    const adapter = new DatasoleNestAdapter();
    const server = createServer();
    adapter.attach(server);
    expect(adapter.create(3000)).toBe(server);
    adapter.detach();
    server.close();
  });

  it('close detaches', () => {
    const adapter = new DatasoleNestAdapter();
    const server = createServer();
    adapter.attach(server);
    adapter.close(server);
    server.close();
  });
});
