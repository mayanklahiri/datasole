import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'fs';
import { join, resolve, basename } from 'path';

const BASE_PATH = process.env.DOCS_BASE_PATH ?? '/datasole';

const ROOT = resolve(__dirname, '../..');
const DOCS = join(ROOT, 'docs');
const TEMPLATES = join(__dirname, '..', 'templates');
const STATIC = join(__dirname, '..', 'static');
const DIST = join(__dirname, '..', 'dist');
const REPORTS = join(ROOT, 'reports');

interface DocPage {
  slug: string;
  title: string;
  order: number;
  description: string;
  content: string;
}

function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) meta[key.trim()] = rest.join(':').trim();
  }
  return { meta, body: match[2] };
}

function markdownToHtml(md: string): string {
  // Minimal markdown to HTML (headers, paragraphs, code blocks, tables, lists)
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/```(\w*)\n([\s\S]*?)```/gm, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^\|(.+)\|$/gm, (_, row) => {
      const cells = row.split('|').map((c: string) => c.trim());
      return '<tr>' + cells.map((c: string) => `<td>${c}</td>`).join('') + '</tr>';
    });
  return `<p>${html}</p>`;
}

function generateToc(md: string): string {
  const headings = md.match(/^## .+$/gm) || [];
  if (headings.length === 0) return '';
  const items = headings.map((h) => {
    const text = h.replace(/^## /, '');
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `<li><a href="#${id}">${text}</a></li>`;
  });
  return `<nav class="toc"><ul>${items.join('')}</ul></nav>`;
}

/** Rewrite root-absolute asset and nav URLs for GitHub Pages (or override via DOCS_BASE_PATH). */
function applyBasePathToLayout(html: string): string {
  return html
    .replaceAll('href="/static/', `href="${BASE_PATH}/static/`)
    .replaceAll('src="/static/', `src="${BASE_PATH}/static/`)
    .replaceAll('href="/dashboard/', `href="${BASE_PATH}/dashboard/`)
    .replace('<a href="/" class="logo">', `<a href="${BASE_PATH}/" class="logo">`);
}

function main() {
  // Read templates
  let layout: string, pageTemplate: string, metricsTemplate: string;
  try {
    layout = readFileSync(join(TEMPLATES, 'layout.html'), 'utf8');
    pageTemplate = readFileSync(join(TEMPLATES, 'page.html'), 'utf8');
    metricsTemplate = readFileSync(join(TEMPLATES, 'metrics.html'), 'utf8');
  } catch {
    console.error('Templates not found. Run from project root.');
    process.exit(1);
  }

  layout = applyBasePathToLayout(layout);

  // Parse docs
  const pages: DocPage[] = [];
  try {
    for (const file of readdirSync(DOCS).filter((f) => f.endsWith('.md'))) {
      const raw = readFileSync(join(DOCS, file), 'utf8');
      const { meta, body } = parseFrontMatter(raw);
      pages.push({
        slug: basename(file, '.md'),
        title: meta.title || basename(file, '.md'),
        order: parseInt(meta.order || '99', 10),
        description: meta.description || '',
        content: body,
      });
    }
  } catch {
    console.warn('No docs found');
  }
  pages.sort((a, b) => a.order - b.order);

  // Generate nav
  const nav = pages.map((p) => `<a href="${BASE_PATH}/${p.slug}/">${p.title}</a>`).join('\n');

  // Clean and create dist
  mkdirSync(DIST, { recursive: true });
  mkdirSync(join(DIST, 'static'), { recursive: true });

  // Copy static
  try {
    cpSync(STATIC, join(DIST, 'static'), { recursive: true });
  } catch {
    // static dir may not exist fully
  }

  // Generate pages
  for (const page of pages) {
    const dir = join(DIST, page.slug);
    mkdirSync(dir, { recursive: true });
    const html = markdownToHtml(page.content);
    const toc = generateToc(page.content);
    const pageHtml = pageTemplate
      .replace('{{title}}', page.title)
      .replace('{{toc}}', toc)
      .replace('{{content}}', html);
    const full = layout
      .replace('{{title}}', `${page.title} — datasole`)
      .replace('{{nav}}', nav)
      .replace('{{body}}', pageHtml);
    writeFileSync(join(dir, 'index.html'), full);
  }

  // Generate dashboard
  const dashDir = join(DIST, 'dashboard');
  mkdirSync(dashDir, { recursive: true });
  let metricsHtml = '<p>No build metrics available. Run <code>npm run dist</code> first.</p>';
  try {
    const metrics = JSON.parse(readFileSync(join(REPORTS, 'build-metrics.json'), 'utf8'));
    const rows = (metrics.bundles || [])
      .map(
        (b: { file: string; sizeRaw: number; sizeGzip: number }) =>
          `<tr><td><code>${b.file}</code></td><td>${b.sizeRaw}</td><td>${b.sizeGzip}</td></tr>`,
      )
      .join('');
    metricsHtml = `<table><thead><tr><th>Artifact</th><th>Raw (bytes)</th><th>Gzip (bytes)</th></tr></thead><tbody>${rows}</tbody></table>`;
  } catch {
    // no metrics yet
  }
  const dashHtml = metricsTemplate.replace('{{metrics}}', metricsHtml);
  const dashFull = layout
    .replace('{{title}}', 'Dashboard — datasole')
    .replace('{{nav}}', nav)
    .replace('{{body}}', dashHtml);
  writeFileSync(join(dashDir, 'index.html'), dashFull);

  // Generate index
  const indexBody = `
    <div class="hero">
      <h1>datasole</h1>
      <p class="tagline">The full-stack realtime primitive for TypeScript.</p>
      <p class="hero-sub">One <code>npm install</code> — you own the server, the data, and the deployment.</p>
      <nav class="hero-actions">
        <a href="${BASE_PATH}/tutorials/" class="btn-primary">Start the tutorial</a>
        <a href="${BASE_PATH}/examples/" class="btn-secondary">See examples</a>
        <a href="https://github.com/mayanklahiri/datasole" class="btn-secondary">GitHub</a>
      </nav>
    </div>

    <div class="landing-grid">
      <section class="landing-card">
        <h2>Performance</h2>
        <ul>
          <li>WebSocket runs in a <strong>Web Worker</strong> — network I/O never touches the UI thread</li>
          <li><strong>Binary frames</strong> with pako compression (60–80% smaller than raw JSON)</li>
          <li><strong>SharedArrayBuffer</strong> zero-copy transfer between worker and main thread</li>
          <li>Server concurrency: async, thread-per-connection, <strong>thread pool</strong>, process isolation</li>
          <li>Client IIFE: <strong>20.9 KB</strong> gzip. Worker: <strong>14.7 KB</strong> gzip. Both include all deps.</li>
        </ul>
      </section>

      <section class="landing-card">
        <h2>Correctness</h2>
        <ul>
          <li><strong>122 unit tests</strong> (Vitest) + <strong>13 e2e tests</strong> (Playwright, headless Chromium, production bundle)</li>
          <li>Coverage thresholds enforced on every push (lines, branches, functions, statements)</li>
          <li><strong>Strict TypeScript</strong> with <code>.d.ts</code> declarations on every export</li>
          <li>Shared types between client and server — no code generation, no drift</li>
          <li>State sync via <strong>RFC 6902 JSON Patch</strong>; bidirectional sync via <strong>CRDTs</strong> (LWW registers, PN counters, LWW maps)</li>
        </ul>
      </section>

      <section class="landing-card">
        <h2>Developer experience</h2>
        <ul>
          <li><strong>Single npm package</strong> for client, server, shared types, and Web Worker</li>
          <li>Works with React, Vue 3, Svelte, React Native, vanilla JS, Express, NestJS, Fastify</li>
          <li><a href="${BASE_PATH}/tutorials/">Progressive tutorial</a> — 10 steps from hello world to production deployment</li>
          <li><a href="${BASE_PATH}/examples/">Copy-paste examples</a> for every data flow pattern</li>
          <li><a href="https://github.com/mayanklahiri/datasole/blob/develop/AGENTS.md">AGENTS.md</a> with quality gate, coding conventions, and ADR workflow for AI coding assistants</li>
        </ul>
      </section>
    </div>

    <section class="landing-patterns">
      <h2>Data flow patterns</h2>
      <table>
        <thead><tr><th>Pattern</th><th>Direction</th><th>Mechanism</th></tr></thead>
        <tbody>
          <tr><td>RPC</td><td>client → server → client</td><td>Typed request/response with correlation IDs</td></tr>
          <tr><td>Server events</td><td>server → clients</td><td>Broadcast (stock ticker, notifications)</td></tr>
          <tr><td>Client events</td><td>client → server</td><td>Fire-and-forget (chat, analytics)</td></tr>
          <tr><td>Live state</td><td>server → clients</td><td>JSON Patch auto-sync (dashboards, leaderboards)</td></tr>
          <tr><td>CRDT sync</td><td>client ↔ server</td><td>Conflict-free merge (collaborative editing)</td></tr>
        </tbody>
      </table>
    </section>

    <section class="landing-links">
      <h2>Documentation</h2>
      <nav class="page-links">
        ${pages.map((p) => `<a href="${BASE_PATH}/${p.slug}/">${p.title}</a>`).join(' · ')}
        · <a href="${BASE_PATH}/dashboard/">Build Dashboard</a>
      </nav>
    </section>
  `;

  const indexHtml = layout
    .replace('{{title}}', 'datasole')
    .replace('{{nav}}', nav)
    .replace('{{body}}', indexBody);
  writeFileSync(join(DIST, 'index.html'), indexHtml);

  writeFileSync(join(DIST, '.nojekyll'), '');

  console.log(`Docs site generated: ${pages.length} pages + dashboard → ${DIST}`);
}

main();
