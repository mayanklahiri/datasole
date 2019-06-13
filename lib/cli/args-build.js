module.exports = {
  title: "datasole-build",
  description:
    "Build a production-ready distribution of the client application.",
  options: [
    [
      "-a, --app <name>",
      "Name of or path to Datasole application directory",
      process.cwd()
    ],
    [
      "--url_prefix <path>",
      "Relative path prefix to root assets at (useful when behind reverse proxy)",
      "/"
    ],
    [
      "--websocket_path <suffix>",
      "Path prefix to use to connect to the WebSocket endpoint.",
      "__ws__"
    ]
  ]
};
