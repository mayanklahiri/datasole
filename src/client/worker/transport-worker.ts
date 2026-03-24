/**
 * Web Worker entry point: opens WebSocket, sends/receives binary frames, dispatches to main thread.
 */

import { decompress, isCompressed } from '../../shared/codec';
import { decodeFrame, encodeFrame } from '../../shared/protocol';

import { WorkerSharedBuffer } from './shared-buffer';

const sharedBuffer = new WorkerSharedBuffer();
let ws: WebSocket | null = null;

self.onmessage = (event: MessageEvent) => {
  if (!event.data || typeof event.data !== 'object') return;
  const { type, payload } = event.data;
  switch (type) {
    case 'connect':
      if (payload?.url) connect(payload.url, payload.protocols);
      break;
    case 'send':
      if (payload?.data) ws?.send(payload.data);
      break;
    case 'disconnect':
      ws?.close();
      break;
    case 'init-sab':
      if (payload?.buffer) sharedBuffer.init(payload.buffer);
      break;
  }
};

function connect(url: string, protocols?: string[]) {
  ws = new WebSocket(url, protocols);
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    self.postMessage({ type: 'open' });
  };

  ws.onclose = (event) => {
    self.postMessage({ type: 'close', payload: { code: event.code, reason: event.reason } });
  };

  ws.onerror = () => {
    self.postMessage({ type: 'error' });
  };

  ws.onmessage = (event) => {
    try {
      const raw = new Uint8Array(event.data as ArrayBuffer);
      const data = isCompressed(raw) ? decompress(raw) : raw;
      const frame = decodeFrame(data);

      if (sharedBuffer.isAvailable()) {
        const fullFrame = encodeFrame(frame);
        if (sharedBuffer.write(fullFrame)) {
          self.postMessage({ type: 'sab-frame', payload: { length: fullFrame.length } });
          return;
        }
      }

      self.postMessage({ type: 'message', payload: frame }, [frame.payload.buffer]);
    } catch {
      // Malformed frame — drop silently to avoid crashing the worker.
    }
  };
}
