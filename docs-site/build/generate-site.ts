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
  const nav = pages
    .map((p) => `<a href="${BASE_PATH}/${p.slug}/">${p.title}</a>`)
    .join('\n');

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
      .map((b: { file: string; sizeRaw: number; sizeGzip: number }) =>
        `<tr><td><code>${b.file}</code></td><td>${b.sizeRaw}</td><td>${b.sizeGzip}</td></tr>`
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
  const indexHtml = layout
    .replace('{{title}}', 'datasole')
    .replace('{{nav}}', nav)
    .replace('{{body}}', `
      <div class="hero">
        <h1>datasole</h1>
        <p class="tagline">High-performance, binary-framed, realtime full-stack TypeScript framework.</p>
        <nav class="page-links">
          ${pages.map((p) => `<a href="${BASE_PATH}/${p.slug}/">${p.title}</a>`).join(' · ')}
          <a href="${BASE_PATH}/dashboard/">Dashboard</a>
        </nav>
      </div>
    `);
  writeFileSync(join(DIST, 'index.html'), indexHtml);

  console.log(`Docs site generated: ${pages.length} pages + dashboard → ${DIST}`);
}

main();
