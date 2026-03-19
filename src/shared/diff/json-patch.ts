import type { StatePatch } from '../types/state';

export function applyPatch<T>(state: T, _patches: StatePatch[]): T {
  // TODO: implement RFC 6902 JSON Patch apply
  return state;
}
