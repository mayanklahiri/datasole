import { describe, it, expect } from 'vitest';

import { diff } from '../../../../src/shared/diff/json-diff';

describe('json-diff', () => {
  it('identical objects produce empty patch list', () => {
    const o = { a: 1, b: { c: 2 } };
    expect(diff(o, o)).toEqual([]);
    expect(diff({ x: 1 }, { x: 1 })).toEqual([]);
  });

  it('add, remove, replace', () => {
    const oldState = { a: 1, b: 2 };
    const newState = { a: 1, c: 3 };
    const patches = diff(oldState, newState);
    const paths = patches.map((p) => p.path);
    expect(paths).toContain('/b');
    expect(paths).toContain('/c');
    const add = patches.find((p) => p.op === 'add' && p.path === '/c');
    expect(add?.value).toBe(3);
    const rem = patches.find((p) => p.op === 'remove' && p.path === '/b');
    expect(rem).toBeDefined();
  });

  it('diff arrays', () => {
    const patches = diff({ items: [1, 2] }, { items: [1, 2, 3] });
    expect(patches.length).toBeGreaterThan(0);
  });

  it('null and undefined old/new are treated as empty object', () => {
    expect(diff(null, { a: 1 })).toEqual([{ op: 'add', path: '/a', value: 1 }]);
    expect(diff(undefined, { a: 1 })).toEqual([{ op: 'add', path: '/a', value: 1 }]);
    expect(diff({ a: 1 }, null)).toEqual([{ op: 'remove', path: '/a' }]);
    expect(diff({ a: 1 }, undefined)).toEqual([{ op: 'remove', path: '/a' }]);
  });
});
