import { describe, it, expect } from 'vitest';

import { createConcurrencyStrategy } from '../../../../src/server/concurrency';

describe('createConcurrencyStrategy', () => {
  it('should create async strategy', () => {
    const strategy = createConcurrencyStrategy({ model: 'async' });
    expect(strategy.model).toBe('async');
  });

  it('should create thread-pool strategy by default', () => {
    const strategy = createConcurrencyStrategy();
    expect(strategy.model).toBe('thread-pool');
  });

  it('should create thread strategy', () => {
    const strategy = createConcurrencyStrategy({ model: 'thread' });
    expect(strategy.model).toBe('thread');
  });

  it('should create process strategy', () => {
    const strategy = createConcurrencyStrategy({ model: 'process' });
    expect(strategy.model).toBe('process');
  });
});
