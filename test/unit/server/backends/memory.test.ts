import { describe, it, expect } from 'vitest';

import { MemoryBackend } from '../../../../src/server/state/backends';

describe('MemoryBackend', () => {
  it('should set and get values', async () => {
    const backend = new MemoryBackend();
    await backend.set('key1', { value: 42 });
    const result = await backend.get('key1');
    expect(result).toEqual({ value: 42 });
  });

  it('should delete values', async () => {
    const backend = new MemoryBackend();
    await backend.set('key1', 'value');
    const deleted = await backend.delete('key1');
    expect(deleted).toBe(true);
    expect(await backend.get('key1')).toBeUndefined();
  });
});
