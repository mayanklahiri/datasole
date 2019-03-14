This module contains code that will execute in three different environments:

- client.js is bundled into the client app build via Webpack, requires ES6 module support.
- server.js is used by the Websocket server in a node environment, uses module.export for node.
- runtime.js is required by the server-side app process.
