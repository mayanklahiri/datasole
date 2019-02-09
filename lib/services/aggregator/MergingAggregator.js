const BaseService = require("../base/BaseService");

class AggregatorService extends BaseService {}

module.exports = CONSTANTS => new AggregatorService(CONSTANTS);
