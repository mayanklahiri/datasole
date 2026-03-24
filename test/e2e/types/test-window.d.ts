/**
 * Type augmentation for the global test API injected by test/e2e/fixtures/client/index.html.
 * Eliminates all `(window as any)` casts in E2E test specs.
 */

interface TestConnectOptions {
  auth?: {
    token?: string;
    headers?: Record<string, string>;
  };
}

interface TestEventEntry {
  event: string;
  data: unknown;
  timestamp: number;
}

interface TestStateUpdate {
  key: string;
  state: Record<string, unknown>;
}

declare global {
  interface Window {
    __datasole_loaded: boolean;
    __logs: string[];
    __events: TestEventEntry[];
    __stateUpdates: TestStateUpdate[];
    __client: unknown;

    __connect(opts?: TestConnectOptions): Promise<string>;
    __disconnect(): Promise<void>;
    __getConnectionState(): string;

    __rpc(method: string, params?: unknown): Promise<unknown>;

    __subscribeEvent(eventName: string): void;
    __emitEvent(eventName: string, data: unknown): void;
    __subscribeState(key: string): void;

    __initCrdt(nodeId?: string): void;
    __crdtIncrement(): number;
    __crdtDecrement(): number;
    __crdtGetValue(): number;
    __crdtValues: { counter: number };

    __saveProgress(level: number, score: number): Promise<{ ok: boolean }>;
    __getProgress(): Promise<{ level: number; score: number }>;

    __boardState: unknown;
    __subscribeBoard(): void;
    __addTask(title: string): Promise<{ id: string }>;
    __moveTask(taskId: string, column: string): Promise<{ ok: boolean }>;
    __localBoard: {
      columns: string[];
      tasks: Array<{ id: string; title: string; column: string }>;
    };
  }
}

export {};
