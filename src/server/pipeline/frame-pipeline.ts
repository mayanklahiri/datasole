/**
 * Ordered interceptor chain for inbound WebSocket frames.
 * Each interceptor may short-circuit (e.g. rate-limit rejection) or delegate via {@link next}.
 */
import type { FrameInterceptor, FrameInterceptorContext } from './types';

export class FramePipeline {
  private readonly interceptors: FrameInterceptor[] = [];

  use(interceptor: FrameInterceptor): void {
    this.interceptors.push(interceptor);
  }

  async execute(ctx: FrameInterceptorContext): Promise<void> {
    let index = 0;
    const next = async (): Promise<void> => {
      if (index < this.interceptors.length) {
        const interceptor = this.interceptors[index++]!;
        await interceptor(ctx, next);
      }
    };
    await next();
  }
}
