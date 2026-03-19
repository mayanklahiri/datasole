import { describe, it, expect } from 'vitest';

import { StateStore } from '../../../src/client/state';

describe('StateStore', () => {
  it('should return initial state', () => {
    const store = new StateStore({ count: 0 });
    expect(store.getState()).toEqual({ count: 0 });
  });

  it.todo('should apply patches and notify subscribers');
});
