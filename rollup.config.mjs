import clientConfig from './build/rollup.client.mjs';
import workerConfig from './build/rollup.worker.mjs';
import serverConfig from './build/rollup.server.mjs';
import sharedConfig from './build/rollup.shared.mjs';

const configs = [clientConfig, workerConfig, serverConfig, sharedConfig].flat();

export default configs;
