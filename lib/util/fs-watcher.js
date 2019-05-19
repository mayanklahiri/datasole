const path = require("path");
const EventEmitter = require("events");

const { debounce } = require("lodash");
const chokidar = require("chokidar");

const DEBOUNCE_INTERVAL_MS = 2000;

class FSWatcher extends EventEmitter {
  constructor(rootPathSpec, options) {
    super();
    const watcher = (this.watcher = chokidar.watch(rootPathSpec, options));
    const debounced = debounce(
      this.onDirUpdate.bind(this),
      DEBOUNCE_INTERVAL_MS
    );
    watcher.on("add", debounced);
    watcher.on("change", debounced);
    watcher.on("unlink", debounced);
    watcher.on("unlinkDir", debounced);
    watcher.on("addDir", debounced);
  }

  onDirUpdate() {
    this.emit("update");
  }
}

function createRecursiveWatcher(rootPathSpec) {
  // chokidar options for a recursive Javascript watcher.
  const chokidarOpt = {
    persistent: true,
    followSymlinks: true,
    ignorePermissionErrors: true,
    ignoreInitial: true,
    usePolling: true
  };
  return new FSWatcher(path.join(rootPathSpec, "**", "*.js"), chokidarOpt);
}

module.exports = {
  createRecursiveWatcher
};
