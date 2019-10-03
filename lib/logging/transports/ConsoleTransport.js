const colors = require("colors");
const BaseTransport = require("./BaseTransport");

class ConsoleTransport extends BaseTransport {
  pushLine(logLine) {
    const lines = logLine.msg.split(/\n/);
    const loggerNameCol =
      logLine.loggerName === "sys" ? colors.yellow : colors.cyan;
    const str = lines
      .map(s =>
        [
          loggerNameCol(logLine.loggerName),
          logLine.level,
          colors.gray(`[${logLine.caller}]`),
          s
        ].join(":")
      )
      .join("\n");
    console.log(str);
  }
}

module.exports = ConsoleTransport;
