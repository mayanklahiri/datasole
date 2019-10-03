const _harness = require("./_harness");
const Config = _harness.requireLib("config/Config");
const DatasoleServer = _harness.requireLib("server/DatasoleServer");

test("Dev mode configuration generates the right components", async () => {
  const config = new Config({
    mode: "development"
  });
  const datasole = new DatasoleServer(config);
  const components = datasole.createComponents();
  expect(Object.keys(components).sort()).toEqual([
    "AppServer",
    "HttpServer",
    "LiveModelServer",
    "MetricsServer",
    "WebDevServer",
    "WebSocketServer"
  ]);
});

test("Prod mode configuration generates the right components", async () => {
  const config = new Config({
    mode: "production"
  });
  const datasole = new DatasoleServer(config);
  const components = datasole.createComponents();
  expect(Object.keys(components).sort()).toEqual([
    "AppServer",
    "HttpServer",
    "LiveModelServer",
    "MetricsServer",
    "WebServer",
    "WebSocketServer"
  ]);
});
