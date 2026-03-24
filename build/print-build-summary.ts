/**
 * Prints a colored, categorized summary of all build artifacts after `npm run build`.
 * Includes demo artifacts if their build outputs exist.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { gzipSync } from 'zlib';

const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');
const DEMOS = join(ROOT, 'demos');

// ── ANSI helpers ────────────────────────────────────────────────────

const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[39m`;

const ANSI_RE = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');

/** Strip all ANSI escape codes and return the visible character count. */
function visibleLen(s: string): number {
  return s.replace(ANSI_RE, '').length;
}

/** Pad an ANSI-colored string on the right so its visible width reaches `width`. */
function padVisible(s: string, width: number): string {
  const gap = width - visibleLen(s);
  return gap > 0 ? s + ' '.repeat(gap) : s;
}

// ── Data types ──────────────────────────────────────────────────────

interface ArtifactEntry {
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

// ── Scanning ────────────────────────────────────────────────────────

function walkDir(dir: string, relBase: string, filter: (name: string) => boolean): ArtifactEntry[] {
  const results: ArtifactEntry[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkDir(full, relBase, filter));
    } else if (filter(entry)) {
      const raw = readFileSync(full);
      results.push({
        file: full.replace(relBase + '/', ''),
        raw: raw.length,
        gzip: gzipSync(raw).length,
      });
    }
  }
  return results;
}

function walkDist(): {
  bundles: ArtifactEntry[];
  sourcemaps: ExtraFiles;
  declarations: ExtraFiles;
} {
  const sourcemaps: ExtraFiles = { count: 0, totalSize: 0 };
  const declarations: ExtraFiles = { count: 0, totalSize: 0 };

  const isBundle = (name: string) =>
    name.endsWith('.js') || name.endsWith('.mjs') || name.endsWith('.cjs');

  const all: ArtifactEntry[] = [];

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
      } else if (isBundle(entry)) {
        const raw = readFileSync(full);
        all.push({
          file: full.replace(ROOT + '/', ''),
          raw: raw.length,
          gzip: gzipSync(raw).length,
        });
      }
    }
  }

  walk(DIST);
  return { bundles: all, sourcemaps, declarations };
}

// ── Demo scanning ───────────────────────────────────────────────────

interface DemoArtifacts {
  name: string;
  sourceDir: string;
  entries: ArtifactEntry[];
}

function scanDemos(): DemoArtifacts[] {
  const isWebAsset = (name: string) =>
    name.endsWith('.js') ||
    name.endsWith('.mjs') ||
    name.endsWith('.css') ||
    name.endsWith('.html');

  const demos: DemoArtifacts[] = [];

  // Vanilla — source files in client/ (no build step)
  const vanillaDir = join(DEMOS, 'vanilla', 'client');
  if (existsSync(vanillaDir)) {
    const entries = walkDir(vanillaDir, join(DEMOS, 'vanilla'), isWebAsset);
    if (entries.length > 0) {
      demos.push({ name: 'Vanilla', sourceDir: 'client/', entries });
    }
  }

  // React + Express — Vite build output
  const reactDir = join(DEMOS, 'react-express', 'dist', 'client');
  if (existsSync(reactDir)) {
    const entries = walkDir(reactDir, join(DEMOS, 'react-express', 'dist', 'client'), isWebAsset);
    if (entries.length > 0) {
      demos.push({ name: 'React + Express', sourceDir: 'dist/client/', entries });
    }
  }

  // Vue + NestJS — Vite build output
  const vueDir = join(DEMOS, 'vue-nestjs', 'dist', 'client');
  if (existsSync(vueDir)) {
    const entries = walkDir(vueDir, join(DEMOS, 'vue-nestjs', 'dist', 'client'), isWebAsset);
    if (entries.length > 0) {
      demos.push({ name: 'Vue 3 + NestJS', sourceDir: 'dist/client/', entries });
    }
  }

  return demos;
}

// ── Printing ────────────────────────────────────────────────────────

type Category = 'Client' | 'Server' | 'Shared';

function categorize(file: string): Category {
  if (file.includes('client/')) return 'Client';
  if (file.includes('server/')) return 'Server';
  return 'Shared';
}

/**
 * Print a table of artifacts. `labelCol` is the visible character width
 * allocated for the left column (indent + label), used for alignment.
 */
function printGroup(heading: string, entries: ArtifactEntry[], labelCol: number): void {
  console.log(`  ${heading}`);

  const sorted = [...entries].sort((a, b) => a.raw - b.raw);
  for (const e of sorted) {
    const prefix = `    ${dim(e.file)}`;
    const rawStr = formatBytes(e.raw).padStart(9);
    const gzStr = green(formatBytes(e.gzip).padStart(9) + ' gz');
    console.log(`${padVisible(prefix, labelCol)}${rawStr}  ${gzStr}`);
  }

  const rawTotal = entries.reduce((s, e) => s + e.raw, 0);
  const gzTotal = entries.reduce((s, e) => s + e.gzip, 0);
  const ruler = `    ${dim('───')}`;
  const rawStr = bold(formatBytes(rawTotal).padStart(9));
  const gzStr = bold(green(formatBytes(gzTotal).padStart(9) + ' gz'));
  console.log(`${padVisible(ruler, labelCol)}${rawStr}  ${gzStr}`);
}

function main() {
  const { bundles, sourcemaps, declarations } = walkDist();
  const demos = scanDemos();

  if (bundles.length === 0 && demos.length === 0) {
    console.log(dim('  No build artifacts found.'));
    return;
  }

  // Compute label column width: 4 (indent) + longest filename + 2 (gap)
  const allFiles = [
    ...bundles.map((b) => b.file),
    ...demos.flatMap((d) => d.entries.map((e) => e.file)),
  ];
  const labelCol = 4 + Math.max(...allFiles.map((f) => f.length)) + 2;

  console.log('');
  console.log(`  ${bold('Build Artifacts')}`);
  console.log('');

  // ── Core library ──────────────────────────────────────────────

  if (bundles.length > 0) {
    const groups = new Map<Category, ArtifactEntry[]>();
    for (const b of bundles) {
      const cat = categorize(b.file);
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(b);
    }

    const order: Category[] = ['Client', 'Server', 'Shared'];
    for (const cat of order) {
      const entries = groups.get(cat);
      if (!entries || entries.length === 0) continue;
      printGroup(bold(cyan(cat)), entries, labelCol);
      console.log('');
    }

    const totalRaw = bundles.reduce((s, e) => s + e.raw, 0);
    const totalGzip = bundles.reduce((s, e) => s + e.gzip, 0);
    const totalLabel = `  ${bold(yellow('Total'))}`;
    const rawStr = bold(formatBytes(totalRaw).padStart(9));
    const gzStr = bold(green(formatBytes(totalGzip).padStart(9) + ' gz'));
    console.log(`${padVisible(totalLabel, labelCol)}${rawStr}  ${gzStr}`);

    if (sourcemaps.count > 0) {
      const label = `  Sourcemaps  ${dim(`${sourcemaps.count} files`)}`;
      console.log(`${padVisible(label, labelCol)}${formatBytes(sourcemaps.totalSize).padStart(9)}`);
    }

    if (declarations.count > 0) {
      const label = `  Declarations  ${dim(`${declarations.count} files`)}`;
      console.log(
        `${padVisible(label, labelCol)}${formatBytes(declarations.totalSize).padStart(9)}`,
      );
    }
  }

  // ── Demos ─────────────────────────────────────────────────────

  if (demos.length > 0) {
    console.log('');
    console.log(`  ${bold('Demos')}`);
    console.log('');

    for (const demo of demos) {
      printGroup(`${bold(cyan(demo.name))}  ${dim(demo.sourceDir)}`, demo.entries, labelCol);
      console.log('');
    }
  }

  console.log('');
}

main();
