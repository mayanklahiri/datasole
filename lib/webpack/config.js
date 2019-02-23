const path = require("path");

const webpack = require("webpack");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const {
  clientAppEntryPointPath,
  clientAppOutputPath,
  clientAppSrcPath,
  clientAppTemplatePath
} = require("../pathutil");
const { json } = require("../util");

function generateWpConfig(config) {
  const {
    server: { urlRootPath, urlWsRelPath },
    paths: { appPath }
  } = config;

  // Compile-time constants injected into Javascript.
  const defines = {
    CONFIG: json(config),
    MODE: config.mode,
    BASE_URL: config.server.urlRootPath
  };

  return {
    mode: config.mode,
    entry: [
      clientAppEntryPointPath(appPath),
      "webpack-hot-middleware/client",
      path.resolve(__dirname, "../live-model/entry.js")
    ],
    output: {
      path: clientAppOutputPath(appPath),
      filename: "bundle.[hash:6].js",
      publicPath: urlRootPath
    },
    module: {
      rules: [
        {
          test: /.jsx?$/,
          include: [clientAppSrcPath(appPath)],
          loader: "babel-loader",
          exclude: /node_modules/,
          options: {
            presets: ["@babel/preset-env"]
          }
        },
        {
          test: /.pug$/,
          include: [clientAppTemplatePath(appPath)],
          loader: "pug-loader",
          exclude: /node_modules/,
          options: {
            pretty: true
          }
        },
        {
          test: /\.(s?css)$/,
          use: ["style-loader", "css-loader", "sass-loader"]
        }
      ]
    },
    resolve: {
      modules: [
        appPath,
        path.resolve(path.dirname(require.resolve("webpack")), "../..")
      ],
      extensions: [".js", ".json", ".css"]
    },
    plugins: [
      new CleanWebpackPlugin(),
      new webpack.DefinePlugin(defines),
      new webpack.HotModuleReplacementPlugin(),
      new webpack.NoEmitOnErrorsPlugin(),
      new HtmlWebpackPlugin({
        template: clientAppTemplatePath(appPath, "index.pug"),
        hash: true,
        cache: true,
        templateParameters: defines
      })
    ]
  };
}

module.exports = { generateWpConfig };
