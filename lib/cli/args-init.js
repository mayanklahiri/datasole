module.exports = {
  title: "datasole-init",
  description: "Initialize a new project in a directory.",
  options: [
    ["-a, --app <path>", "Project root directory", process.cwd()],
    ["-n, --name <name>", "Project package name"],
    ["--force", "Force initialization even if directory is not empty", false],
    ["--server", "Generate only the server stub.", false],
    ["--client", "Generate only the client stub.", false]
  ]
};
