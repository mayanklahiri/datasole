# Vanilla JS Demo

Pure browser JavaScript + Node.js HTTP server. Zero frameworks, zero build step.

## Quickstart

```bash
# from repo root — build datasole first
npm run build

# install & run dev (auto-restarts on server changes)
cd demos/vanilla
npm install
npm run dev
```

Open [http://localhost:4000](http://localhost:4000).

## Production

```bash
npm start
```

## Stack

| Layer  | Technology                                     |
| ------ | ---------------------------------------------- |
| Server | Node.js `http.createServer` + `DatasoleServer` |
| Client | Vanilla DOM + datasole IIFE bundle             |
| Fonts  | Inter + JetBrains Mono (Google Fonts CDN)      |

## Port

Default `4000`. Override with `PORT` env var:

```bash
PORT=8080 npm start
```

## Notes

- No build step — `public/` files are served directly
- Client uses `useWorker: false` (IIFE bundle, no Web Worker)
- `npm run dev` uses `node --watch` for auto-restart on server file changes
