module.exports = [
  [
    "-a, --app <name>",
    "Name of or path to Datasole application directory",
    process.cwd()
  ],
  [
    "--url_prefix <path>",
    "Relative path prefix to serve application client at (useful when behind reverse proxy)",
    "/"
  ],
  [
    "--websocket_path <suffix>",
    "Path suffix for WebSocket connections.",
    "__ws__"
  ]
];
