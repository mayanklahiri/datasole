const assert = require("assert");
const { get, isUndefined, set } = require("lodash");

const EnvMapper = require("./env-mapper");
const validators = require("./validators");

const DEFAULTS = require("./defaults");

class Config {
  /**
   * Generate a configuration from command-line arguments and environment variables.
   * @param {object} env Environment variables.
   * @param {object} args Command-line arguments parsed into a map.
   */
  constructor(env, args) {
    const envMapper = new EnvMapper(env, DEFAULTS, args);
    const config = envMapper.getConfig();
    validators.forEach(valFn => valFn(config));
    this.config = config;
    this.envMapper = envMapper;
  }

  isProduction() {
    return this.getMode() === "production";
  }

  getMode() {
    return get(this.config, "mode");
  }

  getConfig() {
    return this.config;
  }

  setKey(key, value) {
    set(this.config, key, value);
  }

  getKey(key) {
    return get(this.config, key);
  }

  getCheckedKey(key) {
    const val = get(this.config, key);
    assert(!isUndefined(val), `Cannot get key "${key}", value is undefined.`);
    return val;
  }

  getEnvMapper() {
    return this.envMapper;
  }
}

module.exports = Config;
