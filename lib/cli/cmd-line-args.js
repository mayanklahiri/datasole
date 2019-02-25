const CMDLINE_ARGS = [
  [
    ["-a", "--app"],
    {
      help:
        "Built-in app name or path to app. (default: 'defaultApp', built-in demo app)",
      defaultValue: "defaultApp"
    }
  ],
  [
    ["-p", "--port"],
    {
      help:
        "Port for webserver to listen on (default: 8080, use 0 for random port)",
      defaultValue: 8080
    }
  ],
  [
    ["-m", "--mode"],
    {
      help: "'development' or 'production' (default: development)",
      defaultValue: "development"
    }
  ],
  [
    ["-b", "--build"],
    {
      help: "Run a Webpack build in the current mode (default: false)",
      defaultValue: false,
      type: Boolean,
      nargs: 0,
      action: "store"
    }
  ],
  [
    ["-s", "--serve"],
    {
      help: "Run webserver (default: true)",
      defaultValue: true,
      type: Boolean,
      nargs: 0,
      action: "store"
    }
  ],
  [
    ["--open"],
    {
      help: "Open a local browser window after starting webserver.",
      defaultValue: true,
      type: Boolean,
      nargs: 0,
      action: "store"
    }
  ],
  [
    ["--verbose"],
    {
      help: "Verbose logging (default: false)",
      defaultValue: false,
      type: Boolean,
      nargs: 0,
      action: "store"
    }
  ],
  [
    ["--backend"],
    {
      help: "Run the application backend if present (default: true)",
      defaultValue: true,
      type: Boolean,
      nargs: 0,
      action: "store"
    }
  ],
  [
    ["--url_prefix"],
    {
      help: "Relative path to root all servers at (default: '/')",
      defaultValue: "/"
    }
  ],
  [
    ["--websocket_path"],
    {
      help: "Relative path for WebSocket connections (default: '__ws__')",
      defaultValue: "__ws__"
    }
  ]
];
