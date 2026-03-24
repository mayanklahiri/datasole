import { describe, it, expect, vi } from 'vitest';

import { ClientEventEmitter } from '../../../src/client/events/event-emitter';

describe('ClientEventEmitter', () => {
  it('on + emit fires handler with event envelope', () => {
    const em = new ClientEventEmitter();
    const h = vi.fn();
    em.on('e', h);
    em.emit('e', { v: 1 });
    expect(h).toHaveBeenCalledOnce();
    const payload = h.mock.calls[0]![0];
    expect(payload.event).toBe('e');
    expect(payload.data).toEqual({ v: 1 });
    expect(typeof payload.timestamp).toBe('number');
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

  it('multiple handlers on same event all fire', () => {
    const em = new ClientEventEmitter();
    const h1 = vi.fn();
    const h2 = vi.fn();
    em.on('e', h1);
    em.on('e', h2);
    em.emit('e', 'data');
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('events are isolated between different names', () => {
    const em = new ClientEventEmitter();
    const h1 = vi.fn();
    const h2 = vi.fn();
    em.on('a', h1);
    em.on('b', h2);
    em.emit('a', 1);
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).not.toHaveBeenCalled();
  });

  it('handler error does not prevent other handlers from running', () => {
    const em = new ClientEventEmitter();
    const throwing = vi.fn(() => {
      throw new Error('boom');
    });
    const safe = vi.fn();
    em.on('e', throwing);
    em.on('e', safe);
    em.emit('e', null);
    expect(throwing).toHaveBeenCalledOnce();
    expect(safe).toHaveBeenCalledOnce();
  });
});
