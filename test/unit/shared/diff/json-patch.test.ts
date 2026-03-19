import { describe, it, expect } from 'vitest';

import { applyPatch } from '../../../../src/shared/diff/json-patch';

describe('json-patch (applyPatch)', () => {
  it('add operation', () => {
    const next = applyPatch({ a: 1 }, [{ op: 'add', path: '/b', value: 2 }]);
    expect(next).toEqual({ a: 1, b: 2 });
  });

  it('add operation with undefined initial state (empty document)', () => {
    const next = applyPatch(undefined, [{ op: 'add', path: '/value', value: 42 }]);
    expect(next).toEqual({ value: 42 });
  });

  it('remove operation', () => {
    const next = applyPatch({ a: 1, b: 2 }, [{ op: 'remove', path: '/b' }]);
    expect(next).toEqual({ a: 1 });
  });

  it('replace operation', () => {
    const next = applyPatch({ a: 1 }, [{ op: 'replace', path: '/a', value: 99 }]);
    expect(next).toEqual({ a: 99 });
  });

  it('empty patches returns state unchanged (same reference)', () => {
    const state = { x: { y: 1 } };
    expect(applyPatch(state, [])).toBe(state);
  });

  it('nested objects', () => {
    const next = applyPatch({ user: { name: 'a', meta: { n: 1 } } }, [
      { op: 'replace', path: '/user/meta/n', value: 2 },
    ]);
    expect(next).toEqual({ user: { name: 'a', meta: { n: 2 } } });
  });
});
