const fs = require("fs");
const stripAnsi = require("strip-ansi");
const { forEach } = require("lodash");
const BaseDriver = require("./base-driver");
const ConsoleDriver = require("./console");

class FileDriver extends BaseDriver {
  constructor(config) {
    super(config);
    this._fsStream = fs.createWriteStream(
      config.getCheckedKey("logOutputPath"),
      {
        flags: "a"
      }
    );
    this._jsonOutput = config.getKey("logFormat") === "json";
    this._fsStream.on("error", this.emit.bind(this, "error"));
  }

  async writeBatch(logLineBatch) {
    const { _fsStream: fsStream, _jsonOutput: jsonOutput } = this;
    forEach(logLineBatch, logLine => {
      if (jsonOutput) {
        logLine.message = stripAnsi(logLine.message);
        fsStream.write(JSON.stringify(logLine) + "\n");
      } else {
        fsStream.write(stripAnsi(ConsoleDriver.consoleFormat(logLine)));
      }
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      if (!this._fsStream) return resolve();
      const { _fsStream: fsStream } = this;
      delete this._fsStream;

      fsStream.once("finish", resolve);
      fsStream.once("error", reject);
      fsStream.end();
    });
  }
}

module.exports = FileDriver;
