/**
 * Prints the quality gate summary table and exits non-zero when the gate fails.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { gzipSync } from 'zlib';

const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');
const REPORTS = join(ROOT, 'reports');
const DOCS_DIST = join(ROOT, 'docs-site', 'dist');
const COVERAGE = join(ROOT, 'coverage');
const E2E_REPORTS = join(ROOT, 'test', 'e2e', 'reports');
const PLAYWRIGHT_RESULTS = join(E2E_REPORTS, 'playwright-results.json');

/** Must match vitest.config.ts coverage.thresholds */
const COVERAGE_THRESHOLDS = {
  lines: 45,
  functions: 35,
  branches: 40,
  statements: 45,
} as const;

interface GateResult {
  pass: boolean;
  bundles: { file: string; raw: number; gzip: number }[];
  tests: { total: number; passed: number; failed: number; todo: number } | null;
  coverage: { lines: number; branches: number; functions: number; statements: number } | null;
  coverageThresholdOk: boolean | null;
  docs: { pages: number; totalSize: number } | null;
  e2e: { total: number; passed: number; failed: number } | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function collectBundles(): GateResult['bundles'] {
  const result: GateResult['bundles'] = [];
  function walk(dir: string) {
    try {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (
          (entry.endsWith('.js') || entry.endsWith('.mjs') || entry.endsWith('.cjs')) &&
          !entry.endsWith('.map')
        ) {
          const raw = readFileSync(full);
          result.push({
            file: full.replace(ROOT + '/', ''),
            raw: raw.length,
            gzip: gzipSync(raw).length,
          });
        }
      }
    } catch {
      /* dir may not exist */
    }
  }
  walk(DIST);
  return result;
}

function collectCoverage(): GateResult['coverage'] {
  try {
    const summary = JSON.parse(readFileSync(join(COVERAGE, 'coverage-summary.json'), 'utf8'));
    const t = summary.total;
    return {
      lines: t.lines?.pct ?? 0,
      branches: t.branches?.pct ?? 0,
      functions: t.functions?.pct ?? 0,
      statements: t.statements?.pct ?? 0,
    };
  } catch {
    return null;
  }
}

function checkCoverageMeetsThresholds(c: GateResult['coverage']): boolean | null {
  if (!c) return null;
  return (
    c.lines >= COVERAGE_THRESHOLDS.lines &&
    c.functions >= COVERAGE_THRESHOLDS.functions &&
    c.branches >= COVERAGE_THRESHOLDS.branches &&
    c.statements >= COVERAGE_THRESHOLDS.statements
  );
}

function collectDocs(): GateResult['docs'] {
  if (!existsSync(DOCS_DIST)) return null;
  let pages = 0;
  let totalSize = 0;
  function walk(dir: string) {
    try {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) walk(full);
        else {
          totalSize += stat.size;
          if (entry.endsWith('.html')) pages++;
        }
      }
    } catch {
      /* unreadable */
    }
  }
  walk(DOCS_DIST);
  return { pages, totalSize };
}

function collectE2e(): GateResult['e2e'] {
  if (!existsSync(PLAYWRIGHT_RESULTS)) return null;
  try {
    const results = JSON.parse(readFileSync(PLAYWRIGHT_RESULTS, 'utf8')) as {
      stats?: {
        expected?: number;
        unexpected?: number;
        skipped?: number;
        flaky?: number;
      };
    };
    const s = results.stats ?? {};
    const expected = s.expected ?? 0;
    const unexpected = s.unexpected ?? 0;
    const skipped = s.skipped ?? 0;
    const flaky = s.flaky ?? 0;
    const total = expected + unexpected + skipped + flaky;
    const passed = expected + flaky;
    return { total, passed, failed: unexpected };
  } catch {
    return null;
  }
}

function printE2eServerLogsIfPresent(): void {
  if (!existsSync(E2E_REPORTS)) return;
  let logFiles: string[] = [];
  try {
    logFiles = readdirSync(E2E_REPORTS).filter((f) => f.endsWith('.log'));
  } catch {
    return;
  }
  if (logFiles.length === 0) return;
  console.log('');
  console.log('  E2E report logs (test/e2e/reports):');
  for (const name of logFiles.sort()) {
    const path = join(E2E_REPORTS, name);
    try {
      const text = readFileSync(path, 'utf8').trimEnd();
      if (!text) continue;
      console.log(`  ── ${name} ──`);
      console.log(text.split('\n').map((l) => `  ${l}`).join('\n'));
    } catch {
      /* ignore per-file errors */
    }
  }
}

function collectTests(): GateResult['tests'] {
  try {
    const metrics = JSON.parse(readFileSync(join(REPORTS, 'build-metrics.json'), 'utf8'));
    if (metrics.testResults) return metrics.testResults;
  } catch {
    /* ignore */
  }
  return null;
}

function main() {
  const coverage = collectCoverage();
  const coverageThresholdOk = checkCoverageMeetsThresholds(coverage);

  const gate: GateResult = {
    pass: true,
    bundles: collectBundles(),
    tests: collectTests(),
    coverage,
    coverageThresholdOk,
    docs: collectDocs(),
    e2e: collectE2e(),
  };

  if (coverage !== null && coverageThresholdOk === false) {
    gate.pass = false;
  }

  const W = 60;
  const line = '═'.repeat(W);
  const thinLine = '─'.repeat(W);

  console.log('');
  console.log(`╔${line}╗`);
  console.log(`║${'  DATASOLE QUALITY GATE'.padEnd(W)}║`);
  console.log(`╠${line}╣`);

  // Bundles
  console.log(`║${'  📦 Bundles'.padEnd(W)}║`);
  console.log(`║${'  ' + thinLine.slice(2)}║`);
  for (const b of gate.bundles) {
    const name = b.file.replace('dist/', '');
    const sizes = `${formatBytes(b.raw)} / ${formatBytes(b.gzip)} gz`;
    console.log(`║  ${name.padEnd(38)} ${sizes.padStart(W - 42)}  ║`);
  }
  console.log(`╟${thinLine}╢`);

  // Coverage
  if (gate.coverage) {
    console.log(`║${'  📊 Coverage'.padEnd(W)}║`);
    console.log(`║${'  ' + thinLine.slice(2)}║`);
    console.log(
      `║  Lines: ${(gate.coverage.lines + '%').padEnd(10)} Branches: ${(gate.coverage.branches + '%').padEnd(10)} Funcs: ${(gate.coverage.functions + '%').padEnd(W - 47)}║`,
    );
    console.log(`║  Statements: ${(gate.coverage.statements + '%').padEnd(44)}║`);
    if (gate.coverageThresholdOk === false) {
      const warn = `  ⚠ Below vitest coverage thresholds`;
      console.log(`║${warn.padEnd(W)}║`);
    }
    console.log(`╟${thinLine}╢`);
  } else if (existsSync(COVERAGE)) {
    console.log(`║${'  📊 Coverage (summary missing)'.padEnd(W)}║`);
    console.log(`╟${thinLine}╢`);
  }

  // E2E
  if (gate.e2e) {
    console.log(`║${'  🌐 E2E Tests'.padEnd(W)}║`);
    console.log(`║${'  ' + thinLine.slice(2)}║`);
    console.log(
      `║  Passed: ${gate.e2e.passed}  Failed: ${gate.e2e.failed}  Total: ${String(gate.e2e.total).padEnd(W - 44)}║`,
    );
    if (gate.e2e.failed > 0) gate.pass = false;
    console.log(`╟${thinLine}╢`);
  } else if (existsSync(E2E_REPORTS)) {
    console.log(`║${'  🌐 E2E (no playwright-results.json)'.padEnd(W)}║`);
    console.log(`╟${thinLine}╢`);
  }

  // Docs
  if (gate.docs) {
    console.log(`║${'  📖 Documentation Site'.padEnd(W)}║`);
    console.log(`║${'  ' + thinLine.slice(2)}║`);
    console.log(
      `║  Pages: ${gate.docs.pages}  Total size: ${formatBytes(gate.docs.totalSize).padEnd(W - 35)}║`,
    );
    console.log(`╟${thinLine}╢`);
  }

  // Result
  const status = gate.pass ? '✅ GATE PASSED' : '❌ GATE FAILED';
  console.log(`║${'  ' + status}${' '.repeat(W - status.length - 2)}║`);
  console.log(`╚${line}╝`);
  console.log('');

  if (!gate.pass) {
    if (gate.e2e && gate.e2e.failed > 0) {
      printE2eServerLogsIfPresent();
      console.log('');
    }
    process.exit(1);
  }
}

main();
