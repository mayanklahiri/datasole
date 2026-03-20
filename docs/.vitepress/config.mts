import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(
  defineConfig({
    title: 'datasole',
    description:
      'Full-stack realtime TypeScript framework — binary WebSocket transport, state sync, CRDTs, typed RPC. Self-hosted, Apache-2.0, free.',
    base: '/datasole/',
    outDir: '../docs-site/dist',
    head: [
      ['link', { rel: 'icon', href: '/datasole/favicon.svg' }],
      [
        'link',
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
      ],
      [
        'link',
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
      ],
      [
        'link',
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;600&display=swap',
        },
      ],
    ],
    cleanUrls: true,
    themeConfig: {
      siteTitle: 'datasole',
      logo: '/datasole-logo.png',
      nav: [
        { text: 'Guide', link: '/tutorials' },
        { text: 'API', link: '/client' },
        { text: 'About', link: '/about' },
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
            { text: 'Wire Protocol', link: '/protocol' },
            { text: 'Composability', link: '/composability' },
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
            { text: 'About', link: '/about' },
            { text: 'Performance', link: '/performance' },
            { text: 'Quality Dashboard', link: '/quality' },
            { text: 'AI & LLM Guide', link: '/ai-guide' },
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
    mermaid: {
      theme: 'base',
      themeVariables: {
        primaryColor: '#e8842c',
        primaryTextColor: '#1a1a1e',
        primaryBorderColor: '#c06820',
        lineColor: '#e8842c',
        secondaryColor: '#fdf0e0',
        tertiaryColor: '#f5f5f0',
      },
    },
  }),
);
