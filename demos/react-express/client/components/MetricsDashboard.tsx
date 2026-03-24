import { useMemo } from 'react';
import type { EventData } from 'datasole';
import { useDatasoleEvent } from '../hooks/useDatasole';
import type { AppContract } from '../../shared/contract';
import { Event } from '../../shared/contract';

type Metrics = EventData<AppContract, Event.SystemMetrics>;

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (h > 0 ? `${h}h ` : '') + `${m}m ${sec}s`;
}

export function MetricsDashboard() {
  // One line. This re-renders only when the server broadcasts new data.
  const metrics = useDatasoleEvent<Metrics>(Event.SystemMetrics);

  // Derived values — just useMemo, no store selectors, no reducers.
  const uptimeDisplay = useMemo(
    () => (metrics ? formatUptime(metrics.uptime) : ''),
    [metrics?.uptime],
  );
  const memoryPct = useMemo(
    () => (metrics ? Math.round((metrics.memoryMB / (metrics.totalMemoryGB * 1024)) * 100) : 0),
    [metrics?.memoryMB, metrics?.totalMemoryGB],
  );
  const totalMessages = useMemo(
    () => (metrics ? metrics.messagesIn + metrics.messagesOut : 0),
    [metrics?.messagesIn, metrics?.messagesOut],
  );

  return (
    <div className="panel">
      <div className="panel-header">Server Metrics</div>
      <div className="panel-body">
        <div className="panel-help">
          <code>useDatasoleEvent(Event.SystemMetrics)</code> — one line, no Redux, no Zustand, no{' '}
          <code>useEffect</code>. Data arrives reactively from the Web Worker. Derive with{' '}
          <code>useMemo</code>.
        </div>
        {!metrics ? (
          <div className="metrics-waiting">Waiting for metrics&hellip;</div>
        ) : (
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Uptime</div>
              <div className="metric-value accent">{uptimeDisplay}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Connections</div>
              <div className="metric-value">{metrics.connections}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">CPU</div>
              <div className="metric-value">
                {metrics.cpuUsage}
                <span className="metric-unit">ms</span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Heap / RAM</div>
              <div className="metric-value">
                {metrics.memoryMB}
                <span className="metric-unit">MB ({memoryPct}%)</span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">CPUs</div>
              <div className="metric-value">{metrics.cpuCount}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total RAM</div>
              <div className="metric-value">
                {metrics.totalMemoryGB}
                <span className="metric-unit">GB</span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Messages</div>
              <div className="metric-value">
                {totalMessages}
                <span className="metric-unit">
                  ({metrics.messagesIn}↓ {metrics.messagesOut}↑)
                </span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Server Time</div>
              <div className="metric-value time-value">
                {metrics.serverTime}
                <span className="metric-unit">{metrics.timezone}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
