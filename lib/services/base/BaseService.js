const EventEmitter = require("events");

const Logger = require("../../logging/Logger");
const Statuses = require("./Statuses");

class BaseService extends EventEmitter {
  constructor(config) {
    super();
    this.config = Object.assign({}, config);
    this.log = new Logger(`${this.constructor.name}:`);
    this.STATUS = Object.assign({}, Statuses);
  }
}

module.exports = BaseService;
