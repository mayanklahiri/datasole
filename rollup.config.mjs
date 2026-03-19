import clientConfig from './build/rollup.client.mjs';
import workerConfig from './build/rollup.worker.mjs';
import serverConfig from './build/rollup.server.mjs';
import sharedConfig from './build/rollup.shared.mjs';

const configs = [
  ...(Array.isArray(clientConfig) ? clientConfig : [clientConfig]),
  workerConfig,
  serverConfig,
  sharedConfig,
];

export default configs;
