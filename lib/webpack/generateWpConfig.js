const path = require("path");

const { filter } = require("lodash");
const webpack = require("webpack");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const {
  libRoot,
  clientAppEntryPointPath,
  clientAppOutputPath,
  clientAppNodeModules,
  clientAppSrcPath,
  clientAppTemplatePath,
  nodeModulesPath
} = require("../pathutil");
const { json } = require("../util");
const { dirExists } = require("../fs-util");

function generateWpConfig(config) {
  const {
    server: { urlRootPath },
    paths: { appPath }
  } = config;

  const IS_PROD = config.mode === "production";

  // Compile-time constants injected into Javascript.
  const defines = {
    CONFIG: json(config),
    MODE: config.mode,
    BASE_URL: config.server.urlRootPath
  };

  // Resolve paths that will be searched for use from within the client JS project.
  const clientLibPath = clientAppSrcPath(appPath);
  const clientNodeModulesPath = clientAppNodeModules(appPath);
  const ownNodeModulesPath = nodeModulesPath();
  const ownLibPath = libRoot();
  const srcResolvePaths = filter([
    clientLibPath,
    dirExists(clientNodeModulesPath),
    ownLibPath,
    ownNodeModulesPath
  ]);

  // Resolve paths that will be searched for Webpack loaders.
  const loaderResolvePaths = [ownNodeModulesPath];

  return {
    mode: config.mode,
    entry: filter([
      clientAppEntryPointPath(appPath),
      IS_PROD ? null : "webpack-hot-middleware/client"
    ]),
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
            presets: [require("@babel/preset-env")]
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
      modules: srcResolvePaths,
      extensions: [".js", ".json", ".css", ".scss", ".pug", ".less", ".html"]
    },
    resolveLoader: {
      modules: loaderResolvePaths,
      extensions: [".js", ".json"],
      mainFields: ["loader", "main"]
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
