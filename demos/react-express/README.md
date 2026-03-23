# React + Express Demo

React 19 frontend with Vite, Express backend, connected via datasole WebSocket.

## Quickstart

```bash
# from repo root — build datasole first
npm run build

# install & run dev
cd demos/react-express
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) (Vite dev server proxies WebSocket to Express on 4001).

## Production

```bash
npm run build
npm start
```

Then open [http://localhost:4001](http://localhost:4001).

## Stack

| Layer   | Technology                   |
| ------- | ---------------------------- |
| Server  | Express 5 + `DatasoleServer` |
| Client  | React 19 + Vite              |
| Bundler | Vite 6                       |
| Types   | TypeScript 5 (strict)        |

## Port

- **Dev**: Vite on `5173`, Express on `4001` (proxied via Vite)
- **Prod**: Express on `4001` serves built client

Override backend port with `PORT` env var.

## Notes

- Vite proxies `/__ds` (WebSocket) to Express in dev mode
- `useDatasole` hook manages client lifecycle (connect/disconnect on mount/unmount)
- Production build: `vite build` outputs to `dist/client/`, Express serves it as static files
