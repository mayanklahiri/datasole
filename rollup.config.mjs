import clientConfig from './build/rollup.client.mjs';
import workerConfig from './build/rollup.worker.mjs';
import serverConfig from './build/rollup.server.mjs';

const configs = [
  ...(Array.isArray(clientConfig) ? clientConfig : [clientConfig]),
  workerConfig,
  serverConfig,
];

export default configs;
