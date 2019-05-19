module.exports = [
  [
    "-a, --app <name>",
    `Path to Datasole project directory (default: working directory)`
  ],
  [
    "-p, --port <n>",
    "Port for webserver to listen on (default: 8000, use 0 for random port)",
    8000
  ],
  [
    "--open",
    "Attempt to open a local browser window after starting webserver (default: false).",
    false
  ],
  ["--no-backend", "Do not run the application backend (default: false)"],
  ["--no-frontend", "Do not serve the application frontend (default: false)"],
  [
    "--url_prefix <path>",
    "Relative path prefix to serve application client at (useful when behind reverse proxy) (default: '/')",
    "/"
  ],
  [
    "--websocket_path <suffix>",
    "Path suffix for WebSocket connections (default: '__ws__').",
    "__ws__"
  ],
  [
    "--metrics_interval_ms <interval>",
    "Interval to broadcast server-side metrics at, in milliseconds (0 to disable)",
    10000
  ]
];
