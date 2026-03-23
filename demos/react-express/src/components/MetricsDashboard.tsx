import { useEffect, useState } from 'react';
import type { DatasoleClient } from 'datasole/client';

interface Metrics {
  uptime: number;
  connections: number;
  cpuUsage: number;
  memoryMB: number;
  messagesIn: number;
  messagesOut: number;
  timestamp: number;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (h > 0 ? `${h}h ` : '') + `${m}m ${sec}s`;
}

export function MetricsDashboard({ ds }: { ds: DatasoleClient | null }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    if (!ds) return;
    const handler = (ev: { data: Metrics }) => setMetrics(ev.data);
    ds.on('system-metrics', handler);
    return () => { ds.off('system-metrics', handler); };
  }, [ds]);

  return (
    <div className="panel">
      <div className="panel-header">Server Metrics</div>
      <div className="panel-body">
        {!metrics ? (
          <div className="metrics-waiting">Waiting for metrics&hellip;</div>
        ) : (
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Uptime</div>
              <div className="metric-value accent">{formatUptime(metrics.uptime)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Connections</div>
              <div className="metric-value">{metrics.connections}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">CPU</div>
              <div className="metric-value">
                {metrics.cpuUsage}<span className="metric-unit">ms</span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Memory</div>
              <div className="metric-value">
                {metrics.memoryMB}<span className="metric-unit">MB</span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Messages In</div>
              <div className="metric-value">{metrics.messagesIn}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Messages Out</div>
              <div className="metric-value">{metrics.messagesOut}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
