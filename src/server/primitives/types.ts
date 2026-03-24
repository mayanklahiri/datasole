/**
 * Shared lifecycle interface for all application-layer primitives.
 */
export interface RealtimePrimitive {
  destroy(): Promise<void>;
}
