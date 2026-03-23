# Datasole Documentation Site

Static site generated from `docs/*.md` by VitePress, with live quality metrics and interactive diagrams.

## Build

```bash
npm run docs:build
```

Output goes to `docs-site/dist/`.

## Preview

```bash
npm run docs:preview
```

## Design

VitePress with custom theme. Mermaid diagrams via `vitepress-plugin-mermaid`. Live quality metrics charts powered by Chart.js (loaded on demand).
