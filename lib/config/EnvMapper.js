const { cloneDeep, fromPairs, filter, map, isUndefined } = require("lodash");
const { snakeToCamel } = require("../util");
const { ENV_VAR_PREFIX, RE_INTEGER } = require("../util/constants");

/**
 * Maps environment variables to Datasole options.
 */
class EnvMapper {
  constructor(env, defaults, overrides) {
    this.fullEnv = cloneDeep(env);
    this.env = fromPairs(
      filter(
        map(env, (val, key) => {
          const keyPrefix = key.toLowerCase().substr(0, ENV_VAR_PREFIX.length);
          const keyCamel = snakeToCamel(key.substr(ENV_VAR_PREFIX.length));
          if (keyPrefix === ENV_VAR_PREFIX && !isUndefined(val)) {
            if (val === "true") return [keyCamel, true];
            if (val === "false") return [keyCamel, false];
            if (val === "null") return [keyCamel, null];
            if (RE_INTEGER.test(val)) return [keyCamel, parseInt(val, 10)];
            return [keyCamel, val];
          }
        })
      )
    );
    if (defaults) {
      this.env = Object.assign({}, defaults, this.env);
    }
    if (overrides) {
      this.env = Object.assign({}, this.env, overrides);
    }
  }

  areAnsiColorsDisabled() {
    const { DISABLE_COLORS, NO_COLOR, NO_COLORS } = this.fullEnv;
    return !!(DISABLE_COLORS || NO_COLOR || NO_COLORS);
  }

  getConfig() {
    return cloneDeep(this.env);
  }
}

module.exports = EnvMapper;
