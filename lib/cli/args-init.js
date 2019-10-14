module.exports = {
  title: "datasole-init",
  description: "Initialize a new project in a directory.",
  options: [
    ["--app <path>", "Project root directory", process.cwd()],
    [
      "--type <type>",
      "Project template type (e.g., 'minimal' or 'vue')",
      "minimal"
    ],
    ["--force", "Force initialization even if directory is not empty"],
    ["--install", "Run 'npm install' after project is created"]
  ]
};
