const path = require("path");

const CLIENT_ROOT = path.resolve(__dirname, "client");
const APP_ROOT = path.join(CLIENT_ROOT, "app");
const DIST_ROOT = path.join(CLIENT_ROOT, "dist");

module.exports = {
  mode: process.env.MODE === "production" ? "production" : "development",
  entry: path.join(APP_ROOT, "main.js"),
  output: {
    path: path.join(DIST_ROOT, "assets"),
    filename: "bundle.js",
    publicPath: "/assets/"
  },
  module: {
    rules: [
      {
        test: /.jsx?$/,
        include: [CLIENT_ROOT],
        loader: "babel-loader",
        options: {
          presets: ["@babel/preset-env"]
        }
      },
      {
        test: /\.(s?css)$/,
        use: ["style-loader", "css-loader", "postcss-loader", "sass-loader"]
      }
    ]
  },
  resolve: {
    modules: ["node_modules", APP_ROOT],
    extensions: [".js", ".json", ".jsx", ".css"]
  }
};
