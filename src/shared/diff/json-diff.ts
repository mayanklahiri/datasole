/**
 * Computes JSON diffs between two state objects, producing StatePatch arrays.
 */
import { compare } from 'fast-json-patch';

import type { StatePatch } from '../types/state';

export function diff(oldState: unknown, newState: unknown): StatePatch[] {
  const old = oldState === undefined || oldState === null ? {} : oldState;
  const next = newState === undefined || newState === null ? {} : newState;
  const ops = compare(old as Record<string, unknown>, next as Record<string, unknown>);
  return ops as StatePatch[];
}
