import { useState } from 'react';
import { useDatasoleClient } from '../hooks/useDatasole';

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

  const generate = async () => {
    if (!ds) return;
    setLoading(true);
    setError(null);
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const start = performance.now();
    try {
      const data = (await ds.rpc('randomNumber', { min: lo, max: hi })) as {
        value: number;
        generatedAt: number;
      };
      const elapsed = (performance.now() - start).toFixed(1);
      const entry: RpcResult = { value: data.value, min: lo, max: hi, ms: elapsed };
      setResult(entry);
      setHistory((prev) => [entry, ...prev].slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  };

  return (
    <div className="panel">
      <div className="panel-header">RPC &mdash; Random Number</div>
      <div className="panel-body">
        <div className="panel-help">
          <code>useDatasoleClient()</code> for imperative calls. <code>ds.rpc()</code> returns a
          typed response; latency includes the full round trip.
        </div>
        <div className="rpc-section">
          <div className="rpc-controls">
            <div className="rpc-row">
              <label>Min</label>
              <input
                type="number"
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
              />
              <label>Max</label>
              <input
                type="number"
                value={max}
                onChange={(e) => setMax(Number(e.target.value))}
              />
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
                <div className="rpc-result-value">{result.value}</div>
                <div className="rpc-result-meta">
                  Range [{result.min}, {result.max}] &middot; {result.ms} ms
                </div>
              </>
            ) : (
              <div className="rpc-result-empty">Press Generate to get a random number</div>
            )}
          </div>

          {history.length > 0 && (
            <div className="rpc-history">
              <div className="rpc-history-title">History</div>
              {history.map((h, i) => (
                <div key={i} className="rpc-history-item">
                  <span className="val">{h.value}</span>
                  <span className="meta">
                    [{h.min}–{h.max}] {h.ms} ms
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
