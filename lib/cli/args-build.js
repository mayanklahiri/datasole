module.exports = {
  title: "datasole-build",
  description:
    "Build a production-ready distribution of the client application.",
  options: [
    [
      "-a, --app <name>",
      "Name of or path to Datasole application directory",
      process.cwd()
    ]
  ]
};
