module.exports = {
  title: "datasole-run",
  description: "Run a production webserver.",
  options: [
    ...require("./server-options"),
    ["--rebuild", "Rebuild SPA before serving in production mode.", false]
  ]
};
