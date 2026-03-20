import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(
  defineConfig({
    title: 'datasole',
    description:
      'Realtime TypeScript framework with binary WebSocket transport, JSON Patch state sync, typed RPC, and CRDTs.',
    base: '/datasole/',
    outDir: '../docs-site/dist',
    head: [['link', { rel: 'icon', href: '/datasole/favicon.svg' }]],
    cleanUrls: true,
    themeConfig: {
      siteTitle: 'datasole',
      nav: [
        { text: 'Guide', link: '/tutorials' },
        { text: 'API', link: '/client' },
        {
          text: 'GitHub',
          link: 'https://github.com/mayanklahiri/datasole',
        },
      ],
      sidebar: [
        {
          text: 'Getting Started',
          items: [
            { text: 'Tutorials', link: '/tutorials' },
            { text: 'Examples', link: '/examples' },
            { text: 'Integrations', link: '/integrations' },
          ],
        },
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture' },
            { text: 'Comparison', link: '/comparison' },
          ],
        },
        {
          text: 'API Reference',
          items: [
            { text: 'Client', link: '/client' },
            { text: 'Server', link: '/server' },
            { text: 'Shared', link: '/shared' },
          ],
        },
        {
          text: 'Advanced',
          items: [
            { text: 'State Backends', link: '/state-backends' },
            { text: 'Metrics', link: '/metrics' },
          ],
        },
        {
          text: 'Project',
          items: [
            { text: 'Decisions', link: '/decisions' },
            { text: 'Contributing', link: '/contributing' },
            { text: 'Build & Release', link: '/build-and-release' },
          ],
        },
      ],
      socialLinks: [{ icon: 'github', link: 'https://github.com/mayanklahiri/datasole' }],
      search: { provider: 'local' },
      outline: { level: [2, 3] },
    },
    markdown: {
      theme: { light: 'github-light', dark: 'github-dark' },
    },
  }),
);
