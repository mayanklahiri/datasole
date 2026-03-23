/**
 * Prints a colored, categorized summary of all build artifacts after `npm run build`.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { gzipSync } from 'zlib';

const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');

const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[39m`;

interface BundleEntry {
  file: string;
  raw: number;
  gzip: number;
}

interface ExtraFiles {
  count: number;
  totalSize: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function walkDist(): {
  bundles: BundleEntry[];
  sourcemaps: ExtraFiles;
  declarations: ExtraFiles;
} {
  const bundles: BundleEntry[] = [];
  const sourcemaps: ExtraFiles = { count: 0, totalSize: 0 };
  const declarations: ExtraFiles = { count: 0, totalSize: 0 };

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }

      if (entry.endsWith('.d.ts') || entry.endsWith('.d.ts.map')) {
        declarations.count++;
        declarations.totalSize += stat.size;
      } else if (entry.endsWith('.map')) {
        sourcemaps.count++;
        sourcemaps.totalSize += stat.size;
      } else if (entry.endsWith('.js') || entry.endsWith('.mjs') || entry.endsWith('.cjs')) {
        const raw = readFileSync(full);
        bundles.push({
          file: full.replace(ROOT + '/', ''),
          raw: raw.length,
          gzip: gzipSync(raw).length,
        });
      }
    }
  }

  walk(DIST);
  return { bundles, sourcemaps, declarations };
}

type Category = 'Client' | 'Server' | 'Shared';

function categorize(file: string): Category {
  if (file.includes('client/')) return 'Client';
  if (file.includes('server/')) return 'Server';
  return 'Shared';
}

function printGroup(label: Category, entries: BundleEntry[], fileColWidth: number): void {
  console.log(`  ${bold(cyan(label))}`);

  const sorted = [...entries].sort((a, b) => a.raw - b.raw);
  for (const e of sorted) {
    const name = dim(e.file);
    const pad = ' '.repeat(Math.max(1, fileColWidth - e.file.length));
    const rawStr = formatBytes(e.raw).padStart(9);
    const gzStr = green(formatBytes(e.gzip).padStart(9) + ' gz');
    console.log(`    ${name}${pad}${rawStr}  ${gzStr}`);
  }

  const rawTotal = entries.reduce((s, e) => s + e.raw, 0);
  const gzTotal = entries.reduce((s, e) => s + e.gzip, 0);
  const ruler = '───';
  const padRuler = ' '.repeat(Math.max(1, fileColWidth - ruler.length + 4));
  console.log(
    `    ${dim(ruler)}${padRuler}${bold(formatBytes(rawTotal).padStart(9))}  ${bold(green(formatBytes(gzTotal).padStart(9) + ' gz'))}`,
  );
}

function main() {
  const { bundles, sourcemaps, declarations } = walkDist();

  if (bundles.length === 0) {
    console.log(dim('  No build artifacts found in dist/'));
    return;
  }

  const groups = new Map<Category, BundleEntry[]>();
  for (const b of bundles) {
    const cat = categorize(b.file);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(b);
  }

  const fileColWidth = Math.max(...bundles.map((b) => b.file.length)) + 2;

  console.log('');
  console.log(`  ${bold('Build Artifacts')}`);
  console.log('');

  const order: Category[] = ['Client', 'Server', 'Shared'];
  for (const cat of order) {
    const entries = groups.get(cat);
    if (!entries || entries.length === 0) continue;
    printGroup(cat, entries, fileColWidth);
    console.log('');
  }

  const totalRaw = bundles.reduce((s, e) => s + e.raw, 0);
  const totalGzip = bundles.reduce((s, e) => s + e.gzip, 0);
  const totalPad = ' '.repeat(Math.max(1, fileColWidth - 'Total'.length + 4));
  console.log(
    `  ${bold(yellow('Total'))}${totalPad}${bold(formatBytes(totalRaw).padStart(9))}  ${bold(green(formatBytes(totalGzip).padStart(9) + ' gz'))}`,
  );

  if (sourcemaps.count > 0) {
    const label = `Sourcemaps`;
    const filesStr = dim(`${sourcemaps.count} files`);
    const sizeStr = formatBytes(sourcemaps.totalSize).padStart(9);
    const pad = ' '.repeat(Math.max(1, fileColWidth - label.length - `${sourcemaps.count} files`.length + 2));
    console.log(`  ${label}  ${filesStr}${pad}${sizeStr}`);
  }

  if (declarations.count > 0) {
    const label = `Declarations`;
    const filesStr = dim(`${declarations.count} files`);
    const sizeStr = formatBytes(declarations.totalSize).padStart(9);
    const pad = ' '.repeat(Math.max(1, fileColWidth - label.length - `${declarations.count} files`.length + 2));
    console.log(`  ${label}  ${filesStr}${pad}${sizeStr}`);
  }

  console.log('');
}

main();
