const path = require("path");
const LiveModel = require("../../../lib/live-model/model");

exports.createHarness = function(jest, appPath) {
  const context = {
    log: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn()
    },
    liveModel: new LiveModel()
  };
  const svcDeps = {
    websocket: {
      on: jest.fn(),
      broadcast: jest.fn(),
      sendOne: jest.fn()
    }
  };
  const config = {
    isProduction: () => true,
    getCheckedKey: keyPath => {
      switch (keyPath) {
        case "app": {
          return path.join(__dirname, appPath);
        }
        default: {
          throw new Error(`Unmocked key path "${keyPath}"`);
        }
      }
    }
  };
  return { context, config, svcDeps };
};
