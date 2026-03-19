import { describe, it, expect, vi } from 'vitest';

import { EventBus } from '../../../src/server/events/event-bus';

describe('EventBus', () => {
  it('on + emit invokes handler with event, data, timestamp', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('evt', handler);
    bus.emit('evt', { n: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
    const arg = handler.mock.calls[0]![0];
    expect(arg.event).toBe('evt');
    expect(arg.data).toEqual({ n: 1 });
    expect(typeof arg.timestamp).toBe('number');
  });

  it('off removes handler', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('evt', handler);
    bus.off('evt', handler);
    bus.emit('evt', 1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('multiple handlers all run', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('x', a);
    bus.on('x', b);
    bus.emit('x', 'payload');
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('emit with no handlers does not throw', () => {
    const bus = new EventBus();
    expect(() => bus.emit('missing', null)).not.toThrow();
  });
});
