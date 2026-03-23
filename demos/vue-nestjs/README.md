# Vue 3 + NestJS Demo

Vue 3 SFC frontend with Vite, NestJS backend, connected via datasole WebSocket.

## Quickstart

```bash
# from repo root — build datasole first
npm run build

# install & run dev
cd demos/vue-nestjs
npm install
npm run dev
```

Open [http://localhost:5174](http://localhost:5174) (Vite dev server proxies WebSocket to NestJS on 4002).

## Production

```bash
npm run build
npm start
```

Then open [http://localhost:4002](http://localhost:4002).

## Stack

| Layer   | Technology                   |
| ------- | ---------------------------- |
| Server  | NestJS 11 + `DatasoleServer` |
| Client  | Vue 3 SFC + Vite             |
| Bundler | Vite 6                       |
| Types   | TypeScript 5 (strict)        |

## Port

- **Dev**: Vite on `5174`, NestJS on `4002` (proxied via Vite)
- **Prod**: NestJS on `4002` serves built client via `@nestjs/serve-static`

Override backend port with `PORT` env var.

## Framework Quirks

- `reflect-metadata` must be imported before any NestJS code
- `tsconfig.server.json` enables `experimentalDecorators` and `emitDecoratorMetadata` (required by NestJS decorators)
- `@nestjs/serve-static` is used in production to serve the Vite-built client from `dist/client/`
- Datasole attaches directly to the raw `http.Server` via `app.getHttpServer()` — no NestJS WebSocket gateway needed
