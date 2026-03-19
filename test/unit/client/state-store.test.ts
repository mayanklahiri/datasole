import { describe, it, expect, vi } from 'vitest';

import { StateStore } from '../../../src/client/state/state-store';

describe('StateStore', () => {
  it('getState returns initial', () => {
    const s = new StateStore({ n: 0 });
    expect(s.getState()).toEqual({ n: 0 });
  });

  it('applyPatches updates state', () => {
    const s = new StateStore({ a: 1 });
    s.applyPatches([{ op: 'add', path: '/b', value: 2 }]);
    expect(s.getState()).toEqual({ a: 1, b: 2 });
  });

  it('subscribe fires on update', () => {
    const s = new StateStore({ x: 1 });
    const h = vi.fn();
    s.subscribe(h);
    s.applyPatches([{ op: 'replace', path: '/x', value: 2 }]);
    expect(h).toHaveBeenCalled();
    expect(h.mock.calls.at(-1)![0]).toEqual({ x: 2 });
  });

  it('unsubscribe stops notifications', () => {
    const s = new StateStore({ x: 0 });
    const h = vi.fn();
    const sub = s.subscribe(h);
    sub.unsubscribe();
    s.applyPatches([{ op: 'replace', path: '/x', value: 9 }]);
    expect(h).not.toHaveBeenCalled();
  });
});
