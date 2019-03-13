const { merge, filter } = require("lodash");
const webpack = require("webpack");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const ProgressBarPlugin = require("progress-bar-webpack-plugin");
const VueLoaderPlugin = require("vue-loader/lib/plugin");

const {
  libRoot,
  appClientRoot,
  appClientEntryPointPath,
  appClientDistPath,
  appNodeModules,
  appClientSrcPath,
  appClientTemplatePath,
  appClientAssetsPath,
  nodeModulesPath
} = require("../util/path-util");
const { json } = require("../util");
const { dirExists } = require("../util/fs-util");

function generateWpConfig(config, options) {
  const {
    server: { urlRootPath },
    paths: { appPath }
  } = config;

  const IS_PROD =
    config.mode === "production" || process.env.NODE_ENV === "production";

  // Merge with default options.
  options = merge(
    {
      clean: IS_PROD ? true : false
    },
    options
  );

  // Compile-time constants injected into Javascript.
  const defines = {
    CONFIG: json(config),
    MODE: config.mode,
    BASE_URL: config.server.urlRootPath,
    NODE_ENV: IS_PROD ? "production" : "development"
  };

  // Resolve paths that will be searched for use from within the client JS project.
  const clientLibPath = appClientSrcPath(appPath);
  const clientNodeModulesPath = appNodeModules(appPath);
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

  // Create Webpack config.
  const wpConfig = {
    mode: config.mode,
    entry: filter([
      appClientEntryPointPath(appPath),
      IS_PROD ? null : "webpack-hot-middleware/client"
    ]),
    output: {
      path: appClientDistPath(appPath),
      filename: "bundle.[hash:6].js",
      publicPath: urlRootPath
    },
    optimization: {
      minimize: IS_PROD ? true : false,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            mangle: false
          }
        })
      ]
    },
    module: {
      rules: [
        {
          test: /.jsx?$/,
          include: [appClientSrcPath(appPath)],
          loader: "babel-loader",
          exclude: /node_modules/,
          options: {
            presets: [require("@babel/preset-env")]
          }
        },
        {
          test: /.pug$/,
          include: [appClientSrcPath(appPath), appClientTemplatePath(appPath)],
          oneOf: [
            // this applies to `<template lang="pug">` in Vue components
            {
              resourceQuery: /^\?vue/,
              use: ["pug-plain-loader"]
            },
            // this applies to pug imports inside JavaScript
            {
              use: ["raw-loader", "pug-plain-loader"]
            }
          ],
          exclude: /node_modules/
        },
        {
          test: /.html?$/,
          include: [appClientSrcPath(appPath), appClientTemplatePath(appPath)],
          use: ["html-loader"],
          exclude: /node_modules/
        },
        {
          test: /\.(s?css)$/,
          use: ["style-loader", "css-loader", "sass-loader"]
        },
        {
          test: /\.less$/,
          use: ["style-loader", "css-loader", "less-loader"]
        },
        {
          test: /\.(gif|png|jpe?g|svg)$/i,
          include: [
            appClientSrcPath(appPath),
            appClientTemplatePath(appPath),
            appClientAssetsPath(appPath)
          ],
          use: [
            IS_PROD
              ? {
                  loader: "url-loader",
                  options: {
                    limit: 32768 // 32 kb max inline data-url size
                  }
                }
              : "file-loader",
            {
              loader: "image-webpack-loader"
            }
          ]
        },
        {
          test: /\.vue$/,
          include: [appClientSrcPath(appPath), appClientTemplatePath(appPath)],
          exclude: /node_modules/,
          loader: "vue-loader",
          options: {
            hotReload: true
          }
        }
      ]
    },
    resolve: {
      modules: srcResolvePaths,
      extensions: [
        ".js",
        ".json",
        ".css",
        ".scss",
        ".pug",
        ".less",
        ".html",
        ".jsx",
        ".gif",
        ".png",
        ".jpg",
        ".svg",
        ".html",
        ".vue"
      ],
      alias: {
        Assets: appClientAssetsPath(appPath),
        vue$: "vue/dist/vue.esm.js"
      }
    },
    resolveLoader: {
      modules: loaderResolvePaths,
      extensions: [".js", ".json"],
      mainFields: ["loader", "main"]
    },
    plugins: filter([
      new ProgressBarPlugin(),
      options.clean
        ? new CleanWebpackPlugin([appClientDistPath(appPath)], {
            root: appClientRoot(appPath),
            verbose: false
          })
        : null,
      new webpack.DefinePlugin(defines),
      new webpack.HotModuleReplacementPlugin(),
      new webpack.NoEmitOnErrorsPlugin(),
      new HtmlWebpackPlugin({
        template: appClientTemplatePath(appPath, "index.pug"),
        hash: true,
        cache: true,
        templateParameters: defines
      }),
      new VueLoaderPlugin()
    ])
  };

  if (!IS_PROD) {
    wpConfig.devtool = "eval";
  }

  return wpConfig;
}

module.exports = { generateWpConfig };
