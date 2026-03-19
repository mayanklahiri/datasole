import { applyPatch as fjpApply, deepClone, type Operation } from 'fast-json-patch';

import type { StatePatch } from '../types/state';

export function applyPatch<T>(state: T, patches: StatePatch[]): T {
  if (!patches || patches.length === 0) return state;
  const base = state === undefined || state === null ? {} : state;
  const cloned = deepClone(base);
  const result = fjpApply(cloned, patches as Operation[]);
  return result.newDocument as T;
}
