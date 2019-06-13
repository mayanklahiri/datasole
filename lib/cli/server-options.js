module.exports = [
  ["-a, --app <name>", `Path to Datasole project directory`, process.cwd()],
  [
    "-p, --port <n>",
    "Port for webserver to listen on (default: 8000, use 0 for random port)",
    8000
  ],
  [
    "--url_root_path <path>",
    "Root path prefix to serve application client at (useful when behind reverse proxy)",
    "/"
  ],
  [
    "--websocket_path <suffix>",
    "Path suffix for WebSocket connections.",
    "__ws__"
  ],
  [
    "--metrics_interval_ms <interval>",
    "Interval to broadcast server-side metrics at, in milliseconds (0 to disable)",
    5000
  ],
  ["--disable_frontend", "Disable serving client.", false],
  ["--disable_backend", "Disable serving application.", false]
];
