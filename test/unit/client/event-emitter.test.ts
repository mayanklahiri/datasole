import { describe, it, expect, vi } from 'vitest';

import { ClientEventEmitter } from '../../../src/client/events/event-emitter';

describe('ClientEventEmitter', () => {
  it('on + emit fires handler', () => {
    const em = new ClientEventEmitter();
    const h = vi.fn();
    em.on('e', h);
    em.emit('e', { v: 1 });
    expect(h).toHaveBeenCalledOnce();
    expect(h.mock.calls[0]![0].event).toBe('e');
    expect(h.mock.calls[0]![0].data).toEqual({ v: 1 });
  });

  it('off removes handler', () => {
    const em = new ClientEventEmitter();
    const h = vi.fn();
    em.on('e', h);
    em.off('e', h);
    em.emit('e', 1);
    expect(h).not.toHaveBeenCalled();
  });

  it('emit with no handlers does not throw', () => {
    const em = new ClientEventEmitter();
    expect(() => em.emit('none', null)).not.toThrow();
  });
});
