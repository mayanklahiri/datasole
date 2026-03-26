# datasole demos

Three independent demo apps showcasing datasole with different framework stacks. Each implements the same realtime application: live server metrics dashboard, global chat room, and RPC random number generator.

## Prerequisites

From the repo root, build datasole first:

```bash
npm run build
```

## Demos

| Demo                             | Client             | Server         | Dev Port | Prod Port |
| -------------------------------- | ------------------ | -------------- | -------- | --------- |
| [vanilla/](vanilla/)             | Vanilla JS (IIFE)  | Node.js `http` | 4000     | 4000      |
| [react-express/](react-express/) | React 19 + Vite 8  | Express 5      | 5173     | 4001      |
| [vue-nestjs/](vue-nestjs/)       | Vue 3 SFC + Vite 8 | NestJS 11      | 5174     | 4002      |

## Quick Start

```bash
# Vanilla
cd demos/vanilla && npm install && npm run dev

# React + Express
cd demos/react-express && npm install && npm run dev

# Vue 3 + NestJS
cd demos/vue-nestjs && npm install && npm run dev
```

## What Each Demo Shows

| Feature               | datasole API                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Server Metrics**    | `ds.primitives.fanout.broadcast('system-metrics', data)` → `client.on('system-metrics', handler)`                                       |
| **Chat Room**         | `client.emit('chat:send', msg)` → `ds.primitives.events.on(...)` → `ds.primitives.live.setState()` + `ds.primitives.fanout.broadcast()` |
| **RPC Random Number** | `ds.rpc.register('randomNumber', handler)` → `await client.rpc('randomNumber', params)`                                                 |

## Scripts (each demo)

| Script          | Description                             |
| --------------- | --------------------------------------- |
| `npm run dev`   | Start in development mode (auto-reload) |
| `npm run build` | Build for production                    |
| `npm start`     | Serve production build                  |
| `npm run clean` | Remove dist/ and node_modules/          |
