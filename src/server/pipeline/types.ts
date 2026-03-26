/**
 * Interceptor-chain types for the inbound frame pipeline.
 */
export interface FrameInterceptorContext {
  connectionId: string;
  raw: Uint8Array;
}

export type FrameInterceptor = (
  ctx: FrameInterceptorContext,
  next: () => Promise<void>,
) => Promise<void>;
