const { removeUndefinedValues } = require("../util");

class EnvMapper {
  constructor(env) {
    this.env = env || {};
  }

  areColorsDisabled() {
    return !!(
      this.env.DISABLE_COLORS ||
      this.env.NO_COLOR ||
      this.env.NO_COLORS
    );
  }

  getLoggingConfig() {
    const env = this.env;
    return removeUndefinedValues({
      logLevelSys: env.DATASOLE_LOG_LEVEL_SYS,
      logLevelApp: env.DATASOLE_LOG_LEVEL_APP,
      logOutputPath: env.DATASOLE_LOG_OUTPUT_PATH,
      logFormat: env.DATASOLE_LOG_FORMAT,
      logPassthrough: env.DATASOLE_LOG_PASSTHROUGH
    });
  }
}

module.exports = EnvMapper;
