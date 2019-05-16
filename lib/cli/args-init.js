module.exports = [
  ["-n, --name <name>", "Project package name"],
  [
    "-p, --path <path>",
    "Project root directory (defaults to working directory)"
  ],
  ["--title <title>", "Change process title for logs"],
  ["--force", "Force initialization even if directory is not empty"],
  ["--server", "Generate only the server stub.", false],
  ["--client", "Generate only the client stub.", false]
];
