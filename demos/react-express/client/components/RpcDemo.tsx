import { useMemo, useState, useCallback } from 'react';
import { useDatasoleClient } from '../hooks/useDatasole';
import { RpcMethod } from '../../shared/contract';

interface RpcResult {
  value: number;
  min: number;
  max: number;
  ms: string;
}

export function RpcDemo() {
  const ds = useDatasoleClient();
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(100);
  const [result, setResult] = useState<RpcResult | null>(null);
  const [history, setHistory] = useState<RpcResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pop, setPop] = useState(false);

  const avgLatency = useMemo(() => {
    if (history.length === 0) return null;
    const sum = history.reduce((a, r) => a + parseFloat(r.ms), 0);
    return (sum / history.length).toFixed(1);
  }, [history]);

  const generate = useCallback(async () => {
    if (!ds) return;
    setLoading(true);
    setError(null);
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const start = performance.now();
    try {
      const data = await ds.rpc(RpcMethod.RandomNumber, { min: lo, max: hi });
      const elapsed = (performance.now() - start).toFixed(1);
      const entry: RpcResult = { value: data.value, min: lo, max: hi, ms: elapsed };
      setResult(entry);
      setHistory((prev) => [entry, ...prev].slice(0, 10));
      setPop(true);
      setTimeout(() => setPop(false), 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  }, [ds, min, max]);

  return (
    <div className="panel">
      <div className="panel-header">RPC &mdash; Random Number</div>
      <div className="panel-body">
        <div className="panel-help">
          <code>
            await ds.rpc(RpcMethod.RandomNumber, {'{'} min, max {'}'})
          </code>{' '}
          — typed request/response over the WebSocket. Latency is the full round trip. No REST
          endpoint needed.
        </div>
        <div className="rpc-section">
          <div className="rpc-controls">
            <div className="rpc-row">
              <label>Min</label>
              <input type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} />
              <label>Max</label>
              <input type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} />
            </div>
            <button className="btn" onClick={generate} disabled={loading || !ds}>
              {loading ? 'Generating…' : 'Generate'}
            </button>
          </div>

          <div className="rpc-result">
            {error ? (
              <div className="rpc-result-empty" style={{ color: 'var(--red)' }}>
                Error: {error}
              </div>
            ) : result ? (
              <>
                <div className={`rpc-result-value${pop ? ' pop' : ''}`}>{result.value}</div>
                <div className="rpc-result-meta">
                  Range [{result.min}, {result.max}] &middot; {result.ms}&thinsp;ms
                </div>
              </>
            ) : (
              <div className="rpc-result-empty">Press Generate to get a random number</div>
            )}
          </div>

          {history.length > 0 && (
            <div className="rpc-history">
              <div className="rpc-history-title">
                History{' '}
                {avgLatency && <span className="avg-badge">avg {avgLatency}&thinsp;ms</span>}
              </div>
              {history.map((h, i) => (
                <div key={`${h.value}-${h.ms}-${i}`} className="rpc-history-item hist-slide-in">
                  <span className="val">{h.value}</span>
                  <span className="meta">
                    [{h.min}–{h.max}] {h.ms}&thinsp;ms
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
