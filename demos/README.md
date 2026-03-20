# datasole demos

Self-contained demos that showcase datasole features using vanilla Node.js and browser JavaScript.

## Prerequisites

From the repo root, build the library first:

```bash
npm run build
```

## Kitchen Sink

**`demos/kitchen_sink/`** — A single-page app demonstrating multiple datasole features simultaneously:

| Feature                | How it's used                                                        |
| ---------------------- | -------------------------------------------------------------------- |
| **Server events**      | System metrics (uptime, connections, CPU, memory) broadcast every 2s |
| **Live state**         | Synchronized list of items — server mutates, all clients see diffs   |
| **RPC**                | `echo`, `getMetrics`, `getItems`, `addItem`, `removeItem`            |
| **Client events**      | "Send Ping" fires a client→server event                              |
| **CRDTs**              | Shared PN counter (likes) — conflict-free across all clients         |
| **Randomized updates** | Server randomly mutates item values/statuses every 3s                |

### Run

```bash
# from repo root
node demos/kitchen_sink/server.mjs
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Open multiple tabs to see state sync and CRDT convergence across clients.

### Stack

- **Server**: `http.createServer()` + `DatasoleServer` (zero dependencies beyond datasole)
- **Client**: jQuery 3.7 from CDN + datasole IIFE bundle served by the demo server
- **Fonts**: Inter + JetBrains Mono from Google Fonts
