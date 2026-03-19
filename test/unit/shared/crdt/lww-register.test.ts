import { describe, it, expect } from 'vitest';

import { LWWRegister } from '../../../../src/shared/crdt';

describe('LWWRegister', () => {
  it('should store and retrieve value', () => {
    const reg = new LWWRegister('node-1', 'hello');
    expect(reg.value()).toBe('hello');
  });

  it('should update with newer timestamp', () => {
    const reg = new LWWRegister('node-1', 'old', 100);
    reg.set('new', 200);
    expect(reg.value()).toBe('new');
  });

  it('should ignore older timestamps', () => {
    const reg = new LWWRegister('node-1', 'current', 200);
    reg.set('stale', 100);
    expect(reg.value()).toBe('current');
  });

  it('should merge with remote state', () => {
    const local = new LWWRegister('node-1', 'local', 100);
    local.merge({
      type: 'lww-register',
      value: 'remote',
      metadata: { type: 'lww-register', nodeId: 'node-2', timestamp: 200, version: 1 },
    });
    expect(local.value()).toBe('remote');
  });
});
