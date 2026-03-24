/**
 * Applies JSON Patch operations to state objects.
 */
import { applyPatch as fjpApply, deepClone, type Operation } from 'fast-json-patch';

import type { StatePatch } from '../types/state';

const FORBIDDEN_PATH_SEGMENTS = ['__proto__', 'constructor', 'prototype'];
const ALLOWED_OPS = new Set(['add', 'replace', 'remove', 'move', 'copy', 'test']);

/**
 * When there is no prior document, fast-json-patch needs the correct empty root.
 * Starting from `{}`, an `add` at `/0` becomes `{ "0": value }` instead of `[value]`.
 */
function inferEmptyBaseDocument(patches: StatePatch[]): Record<string, unknown> | unknown[] {
  const p0 = patches[0];
  if (!p0) return {};
  const path = typeof p0.path === 'string' ? p0.path : '';
  if (p0.op === 'replace' && path === '' && 'value' in p0) {
    const v = (p0 as { value?: unknown }).value;
    return Array.isArray(v) ? [] : {};
  }
  if (/^\/\d+(?:\/|$)/.test(path)) {
    return [];
  }
  return {};
}

function validatePatches(patches: StatePatch[]): void {
  for (const patch of patches) {
    if (!ALLOWED_OPS.has(patch.op)) {
      throw new Error(`Disallowed JSON Patch op: ${patch.op}`);
    }
    const segments = (patch.path ?? '').split('/');
    for (const seg of segments) {
      if (FORBIDDEN_PATH_SEGMENTS.includes(seg)) {
        throw new Error(`Forbidden path segment in JSON Patch: ${seg}`);
      }
    }
    if ('from' in patch && typeof patch.from === 'string') {
      const fromSegments = patch.from.split('/');
      for (const seg of fromSegments) {
        if (FORBIDDEN_PATH_SEGMENTS.includes(seg)) {
          throw new Error(`Forbidden path segment in JSON Patch 'from': ${seg}`);
        }
      }
    }
  }
}

export function applyPatch<T>(state: T, patches: StatePatch[]): T {
  if (!patches || patches.length === 0) return state;
  validatePatches(patches);
  const base = state === undefined || state === null ? inferEmptyBaseDocument(patches) : state;
  const cloned = deepClone(base);
  const result = fjpApply(cloned, patches as Operation[]);
  return result.newDocument as T;
}
