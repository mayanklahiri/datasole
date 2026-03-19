import type { StatePatch } from '../types/state';

export function diff(_oldState: unknown, _newState: unknown): StatePatch[] {
  // TODO: implement RFC 6902 JSON Patch diff
  throw new Error('Not implemented');
}
