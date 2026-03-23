import { useDatasoleEvent } from '../hooks/useDatasole';

interface Metrics {
  uptime: number;
  connections: number;
  cpuUsage: number;
  memoryMB: number;
  cpuCount: number;
  totalMemoryGB: number;
  serverTime: string;
  timezone: string;
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

export function MetricsDashboard() {
  const metrics = useDatasoleEvent<Metrics>('system-metrics');

  return (
    <div className="panel">
      <div className="panel-header">Server Metrics</div>
      <div className="panel-body">
        <div className="panel-help">
          <code>useDatasoleEvent('system-metrics')</code> &mdash; one line, no Redux, no{' '}
          <code>useEffect</code>. Data arrives reactively from the Web Worker.
        </div>
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
              <div className="metric-label">CPUs</div>
              <div className="metric-value">{metrics.cpuCount}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total RAM</div>
              <div className="metric-value">
                {metrics.totalMemoryGB}<span className="metric-unit">GB</span>
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
            <div className="metric-card span-2">
              <div className="metric-label">Server Time</div>
              <div className="metric-value">
                {metrics.serverTime}<span className="metric-unit">{metrics.timezone}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
