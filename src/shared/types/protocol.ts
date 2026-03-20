/**
 * Protocol-level types: envelope, version, and frame re-exports.
 */
import type { Frame } from '../protocol/frames';

export type { Frame };

export interface Envelope {
  version: ProtocolVersion;
  frame: Frame;
  compressed: boolean;
}

export type ProtocolVersion = number;
