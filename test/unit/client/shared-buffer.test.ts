import { describe, expect, it } from 'vitest';

import { MainThreadSharedBuffer } from '../../../src/client/transport/shared-buffer';
import { WorkerSharedBuffer } from '../../../src/client/worker/shared-buffer';

describe('SharedArrayBuffer ring buffer', () => {
  it('isAvailable returns true when SAB is supported', () => {
    const main = new MainThreadSharedBuffer();
    expect(main.isAvailable()).toBe(true);
  });

  it('create initializes buffer with correct size', () => {
    const main = new MainThreadSharedBuffer();
    const sab = main.create(1024);
    expect(sab).toBeInstanceOf(SharedArrayBuffer);
    expect(sab.byteLength).toBe(1024 + 16);
  });

  it('write and read single message', () => {
    const main = new MainThreadSharedBuffer();
    const sab = main.create(1024);

    const worker = new WorkerSharedBuffer();
    worker.init(sab);

    const msg = new Uint8Array([1, 2, 3, 4, 5]);
    const written = worker.write(msg);
    expect(written).toBe(true);

    const read = main.read();
    expect(read).not.toBeNull();
    expect(Array.from(read!)).toEqual([1, 2, 3, 4, 5]);
  });

  it('write and read multiple messages', () => {
    const main = new MainThreadSharedBuffer();
    const sab = main.create(1024);

    const worker = new WorkerSharedBuffer();
    worker.init(sab);

    worker.write(new Uint8Array([10, 20]));
    worker.write(new Uint8Array([30, 40, 50]));

    const msg1 = main.read();
    expect(Array.from(msg1!)).toEqual([10, 20]);

    const msg2 = main.read();
    expect(Array.from(msg2!)).toEqual([30, 40, 50]);
  });

  it('read returns null when buffer is empty', () => {
    const main = new MainThreadSharedBuffer();
    main.create(1024);
    expect(main.read()).toBeNull();
  });

  it('write returns false when buffer is full', () => {
    const main = new MainThreadSharedBuffer();
    const sab = main.create(32);

    const worker = new WorkerSharedBuffer();
    worker.init(sab);

    const large = new Uint8Array(30);
    expect(worker.write(large)).toBe(false);
  });

  it('wrap-around works correctly', () => {
    const main = new MainThreadSharedBuffer();
    const sab = main.create(64);

    const worker = new WorkerSharedBuffer();
    worker.init(sab);

    worker.write(new Uint8Array(20));
    main.read();
    worker.write(new Uint8Array(20));
    main.read();

    worker.write(new Uint8Array([99, 98, 97]));
    const msg = main.read();
    expect(Array.from(msg!)).toEqual([99, 98, 97]);
  });

  it('read returns null before create is called', () => {
    const main = new MainThreadSharedBuffer();
    expect(main.read()).toBeNull();
  });

  it('getBuffer returns null before create', () => {
    const main = new MainThreadSharedBuffer();
    expect(main.getBuffer()).toBeNull();
  });

  it('getBuffer returns the SAB after create', () => {
    const main = new MainThreadSharedBuffer();
    const sab = main.create(256);
    expect(main.getBuffer()).toBe(sab);
  });

  it('worker write returns false when not initialized', () => {
    const worker = new WorkerSharedBuffer();
    expect(worker.write(new Uint8Array([1]))).toBe(false);
  });

  it('worker isAvailable returns false before init', () => {
    const worker = new WorkerSharedBuffer();
    expect(worker.isAvailable()).toBe(false);
  });

  it('worker isAvailable returns true after init', () => {
    const main = new MainThreadSharedBuffer();
    const sab = main.create(64);
    const worker = new WorkerSharedBuffer();
    worker.init(sab);
    expect(worker.isAvailable()).toBe(true);
  });
});
