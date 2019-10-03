const LiveModel = require("../../live-model/model");
const BaseServer = require("./BaseServer");

class LiveModelServer extends BaseServer {
  async run() {
    this.model = new LiveModel();
    Object.assign(this, new LiveModel());
  }
}

module.exports = LiveModelServer;
