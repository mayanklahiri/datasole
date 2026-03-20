import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { gzipSync } from 'zlib';

const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');
const REPORTS = join(ROOT, 'reports');

interface BundleMetric {
  file: string;
  sizeRaw: number;
  sizeGzip: number;
}

interface DocsMetric {
  pages: number;
  totalSizeBytes: number;
}

interface BuildMetrics {
  timestamp: string;
  bundles: BundleMetric[];
  coverage: Record<string, unknown> | null;
  e2eResults: Record<string, unknown> | null;
  docs: DocsMetric | null;
}

function collectBundleSizes(): BundleMetric[] {
  const metrics: BundleMetric[] = [];
  function walk(dir: string) {
    try {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (
          (entry.endsWith('.js') || entry.endsWith('.mjs') || entry.endsWith('.cjs')) &&
          !entry.endsWith('.map')
        ) {
          const raw = readFileSync(full);
          metrics.push({
            file: full.replace(ROOT + '/', ''),
            sizeRaw: raw.length,
            sizeGzip: gzipSync(raw).length,
          });
        }
      }
    } catch {
      // dist may not exist
    }
  }
  walk(DIST);
  return metrics;
}

function readJsonSafe(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function collectDocsMetrics(): DocsMetric | null {
  const docsDir = join(ROOT, 'docs-site', 'dist');
  try {
    let pages = 0;
    let totalSize = 0;
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) walk(full);
        else {
          totalSize += stat.size;
          if (entry.endsWith('.html')) pages++;
        }
      }
    }
    walk(docsDir);
    return { pages, totalSizeBytes: totalSize };
  } catch {
    return null;
  }
}

function generateMarkdown(metrics: BuildMetrics): string {
  const lines: string[] = [
    '# Build Metrics',
    '',
    `Generated: ${metrics.timestamp}`,
    '',
    '## Bundle Sizes',
    '',
    '| Artifact | Raw | Gzip |',
    '|---|---|---|',
  ];

  for (const b of metrics.bundles) {
    lines.push(`| \`${b.file}\` | ${formatBytes(b.sizeRaw)} | ${formatBytes(b.sizeGzip)} |`);
  }

  if (metrics.coverage) {
    lines.push('', '## Coverage', '', '```json', JSON.stringify(metrics.coverage, null, 2), '```');
  }

  if (metrics.e2eResults) {
    lines.push('', '## E2E Results', '', '```json', JSON.stringify(metrics.e2eResults, null, 2), '```');
  }

  if (metrics.docs) {
    lines.push(
      '',
      '## Documentation Site',
      '',
      `| Metric | Value |`,
      `|---|---|`,
      `| Pages | ${metrics.docs.pages} |`,
      `| Total size | ${formatBytes(metrics.docs.totalSizeBytes)} |`,
    );
  }

  return lines.join('\n');
}

function main() {
  mkdirSync(REPORTS, { recursive: true });

  const metrics: BuildMetrics = {
    timestamp: new Date().toISOString(),
    bundles: collectBundleSizes(),
    coverage: readJsonSafe(join(ROOT, 'coverage', 'coverage-summary.json')),
    e2eResults: readJsonSafe(join(ROOT, 'test', 'e2e', 'reports', 'playwright-results.json')),
    docs: collectDocsMetrics(),
  };

  writeFileSync(join(REPORTS, 'build-metrics.json'), JSON.stringify(metrics, null, 2));
  writeFileSync(join(REPORTS, 'build-metrics.md'), generateMarkdown(metrics));

  console.log('Build metrics written to reports/');
  console.log(`  Bundles: ${metrics.bundles.length}`);
  console.log(`  Coverage: ${metrics.coverage ? 'yes' : 'no'}`);
  console.log(`  E2E: ${metrics.e2eResults ? 'yes' : 'no'}`);
  console.log(`  Docs: ${metrics.docs ? `${metrics.docs.pages} pages` : 'no'}`);
}

main();
