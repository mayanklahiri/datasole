/**
 * Metrics snapshot shape and exporter interface for serializing server telemetry.
 */
export interface MetricsSnapshot {
  connections: number;
  messagesIn: number;
  messagesOut: number;
  bytesIn: number;
  bytesOut: number;
  rpcCalls: number;
  rpcErrors: number;
  statePatches: number;
  uptime: number;
}

export interface MetricsExporter {
  export(snapshot: MetricsSnapshot): Promise<string>;
}
