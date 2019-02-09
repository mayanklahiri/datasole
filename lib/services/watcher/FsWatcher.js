const BaseService = require("../base/BaseService");

class FsWatcher extends BaseService {
  start() {
    const { log } = this;
    log.info("Starting FSWatcher ");
  }
}

module.exports = CONSTANTS => new FsWatcher(CONSTANTS);
