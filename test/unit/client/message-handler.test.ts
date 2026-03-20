import { describe, it, expect, vi } from 'vitest';

import { dispatchFrame, type FrameRouter } from '../../../src/client/worker/message-handler';
import type { Frame } from '../../../src/shared/protocol';
import { Opcode } from '../../../src/shared/protocol';

function makeFrame(opcode: Opcode, correlationId: number, data: unknown): Frame {
  return {
    opcode,
    correlationId,
    payload: new TextEncoder().encode(JSON.stringify(data)),
  };
}

function makeRouter(): Required<FrameRouter> {
  return {
    onRpcResponse: vi.fn(),
    onEvent: vi.fn(),
    onStatePatch: vi.fn(),
    onStateSnapshot: vi.fn(),
    onPong: vi.fn(),
    onError: vi.fn(),
    onCrdtOp: vi.fn(),
    onCrdtState: vi.fn(),
  };
}

describe('dispatchFrame', () => {
  it('RPC_RES → calls router.onRpcResponse with correlationId and parsed payload', () => {
    const router = makeRouter();
    const payload = { result: 42 };
    dispatchFrame(makeFrame(Opcode.RPC_RES, 7, payload), router);

    expect(router.onRpcResponse).toHaveBeenCalledOnce();
    expect(router.onRpcResponse).toHaveBeenCalledWith(7, payload);
  });

  it('EVENT_S2C → calls router.onEvent with event, data, timestamp', () => {
    const router = makeRouter();
    const payload = { event: 'tick', data: { n: 1 }, timestamp: 1000 };
    dispatchFrame(makeFrame(Opcode.EVENT_S2C, 0, payload), router);

    expect(router.onEvent).toHaveBeenCalledOnce();
    expect(router.onEvent).toHaveBeenCalledWith('tick', { n: 1 }, 1000);
  });

  it('STATE_PATCH → calls router.onStatePatch with key and patches', () => {
    const router = makeRouter();
    const patches = [{ op: 'replace', path: '/x', value: 2 }];
    dispatchFrame(makeFrame(Opcode.STATE_PATCH, 0, { key: 'counter', patches }), router);

    expect(router.onStatePatch).toHaveBeenCalledOnce();
    expect(router.onStatePatch).toHaveBeenCalledWith('counter', patches);
  });

  it('STATE_SNAPSHOT → calls router.onStateSnapshot with key and data', () => {
    const router = makeRouter();
    const data = { users: ['alice'] };
    dispatchFrame(makeFrame(Opcode.STATE_SNAPSHOT, 0, { key: 'app', data }), router);

    expect(router.onStateSnapshot).toHaveBeenCalledOnce();
    expect(router.onStateSnapshot).toHaveBeenCalledWith('app', data);
  });

  it('PONG → calls router.onPong with correlationId', () => {
    const router = makeRouter();
    dispatchFrame(makeFrame(Opcode.PONG, 99, {}), router);

    expect(router.onPong).toHaveBeenCalledOnce();
    expect(router.onPong).toHaveBeenCalledWith(99);
  });

  it('ERROR → calls router.onError with message', () => {
    const router = makeRouter();
    dispatchFrame(makeFrame(Opcode.ERROR, 0, { message: 'bad request' }), router);

    expect(router.onError).toHaveBeenCalledOnce();
    expect(router.onError).toHaveBeenCalledWith('bad request');
  });

  it('CRDT_OP → calls router.onCrdtOp with key and op', () => {
    const router = makeRouter();
    const op = { type: 'increment', value: 3 };
    dispatchFrame(makeFrame(Opcode.CRDT_OP, 0, { key: 'votes', op }), router);

    expect(router.onCrdtOp).toHaveBeenCalledOnce();
    expect(router.onCrdtOp).toHaveBeenCalledWith('votes', op);
  });

  it('CRDT_STATE → calls router.onCrdtState with key and state', () => {
    const router = makeRouter();
    const state = { p: { n1: 5 }, n: {} };
    dispatchFrame(makeFrame(Opcode.CRDT_STATE, 0, { key: 'counter', state }), router);

    expect(router.onCrdtState).toHaveBeenCalledOnce();
    expect(router.onCrdtState).toHaveBeenCalledWith('counter', state);
  });

  it('invalid JSON payload → returns without calling any handler', () => {
    const router = makeRouter();
    const frame: Frame = {
      opcode: Opcode.RPC_RES,
      correlationId: 1,
      payload: new TextEncoder().encode('not valid json{{{'),
    };
    dispatchFrame(frame, router);

    for (const fn of Object.values(router)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('unknown opcode → no handler called', () => {
    const router = makeRouter();
    const frame = makeFrame(0xff as Opcode, 0, { foo: 'bar' });
    dispatchFrame(frame, router);

    for (const fn of Object.values(router)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('works when router callbacks are undefined (optional chaining)', () => {
    const emptyRouter: FrameRouter = {};
    expect(() => {
      dispatchFrame(makeFrame(Opcode.RPC_RES, 1, { r: 1 }), emptyRouter);
      dispatchFrame(
        makeFrame(Opcode.EVENT_S2C, 0, { event: 'e', data: null, timestamp: 0 }),
        emptyRouter,
      );
      dispatchFrame(makeFrame(Opcode.STATE_PATCH, 0, { key: 'k', patches: [] }), emptyRouter);
      dispatchFrame(makeFrame(Opcode.STATE_SNAPSHOT, 0, { key: 'k', data: null }), emptyRouter);
      dispatchFrame(makeFrame(Opcode.PONG, 0, {}), emptyRouter);
      dispatchFrame(makeFrame(Opcode.ERROR, 0, { message: 'err' }), emptyRouter);
      dispatchFrame(makeFrame(Opcode.CRDT_OP, 0, { key: 'k', op: {} }), emptyRouter);
      dispatchFrame(makeFrame(Opcode.CRDT_STATE, 0, { key: 'k', state: {} }), emptyRouter);
    }).not.toThrow();
  });
});
