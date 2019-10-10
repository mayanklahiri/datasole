const assert = require("assert");
const { get, isUndefined, set } = require("lodash");

const EnvMapper = require("./EnvMapper");
const validators = require("./validators");

const DEFAULTS = require("./defaults");

class Config {
  /**
   * Generate a configuration from command-line arguments and environment variables.
   * @param {object} env Environment variables.
   * @param {object} args Command-line arguments parsed into a map.
   */
  constructor(env, args) {
    if (isUndefined(args)) {
      args = env;
      env = {};
    }
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

  getRequiredIntKey(key) {
    const val = this.getCheckedKey(key);
    try {
      return parseInt(val, 10);
    } catch (e) {
      throw new Error(
        `Key "${key}" must be parseable to an integer, got ${typeof val}`
      );
    }
  }

  getRequiredStringKey(key) {
    const val = this.getCheckedKey(key);
    assert(
      typeof val === "string",
      `Key "${key}" must be a string, got ${typeof val}.`
    );
    assert(val.length, `Key "${key}" cannot be empty.`);
    return val;
  }

  getOptionalStringKey(key) {
    const val = get(this.config, key);
    if (isUndefined(val)) return;
    assert(
      typeof val === "string",
      `Key "${key}" must be a string, got ${typeof val}.`
    );
    assert(val.length, `Key "${key}" cannot be empty.`);
    return val;
  }

  getEnvMapper() {
    return this.envMapper;
  }

  toJson() {
    return JSON.stringify(this.config);
  }
}

module.exports = Config;
