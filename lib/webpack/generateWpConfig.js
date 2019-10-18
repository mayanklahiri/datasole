const { merge, filter } = require("lodash");
const webpack = require("webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const FriendlyErrorsWebpackPlugin = require("friendly-errors-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const ProgressBarPlugin = require("progress-bar-webpack-plugin");
const VueLoaderPlugin = require("vue-loader/lib/plugin");

const {
  libRoot,
  appClientEntryPointPath,
  appClientDistPath,
  appNodeModules,
  appClientSrcPath,
  appClientTemplatePath,
  appClientAssetsPath,
  nodeModulesPath
} = require("../util/path-util");
const { dirExists } = require("../util/fs-util");
const getPugDefines = require("./pugDefines");

function generateWpConfig(config, options) {
  const urlRootPath = config.getCheckedKey("urlRootPath");
  const appPath = config.getCheckedKey("app");
  const isProduction = config.isProduction();
  options = options || {};

  // Merge with default options.
  options = merge(
    {
      bail: false,
      clean: isProduction ? true : false,
      interactive: true
    },
    options
  );

  // Compile-time constants injected into Javascript.
  const defines = getPugDefines(config.getConfig());

  // Resolve paths that will be searched for use from within the client JS project.
  const clientLibPath = appClientSrcPath(appPath);
  const clientNodeModulesPath = appNodeModules(appPath);
  const ownNodeModulesPath = nodeModulesPath();
  const ownLibPath = libRoot("runtime");
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
    bail: options.bail,
    mode: config.getMode(),
    performance: {
      hints: false
    },
    entry: filter([
      appClientEntryPointPath(appPath),
      isProduction ? null : "webpack-hot-middleware/client"
    ]),
    output: {
      path: appClientDistPath(appPath),
      filename: "bundle.[hash:6].js",
      publicPath: urlRootPath
    },
    optimization: {
      usedExports: isProduction ? true : false,
      minimize: isProduction ? true : false,
      minimizer: filter([
        isProduction
          ? new TerserPlugin({
              cache: true,
              terserOptions: {
                mangle: false
              }
            })
          : null
      ]),
      splitChunks: isProduction
        ? {
            chunks: "all"
          }
        : false
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          include: [appClientSrcPath(appPath)],
          loader: "babel-loader",
          exclude: /node_modules/,
          options: {
            presets: [
              [
                require("@babel/preset-env"),
                {
                  targets: { browsers: "defaults" },
                  useBuiltIns: "usage",
                  corejs: 3
                }
              ]
            ],
            plugins: [[require("@babel/plugin-transform-regenerator")]]
          }
        },
        {
          test: /\.pug$/,
          include: [appClientSrcPath(appPath), appClientTemplatePath(appPath)],
          oneOf: [
            // this applies to `<template lang="pug">` in Vue components
            {
              resourceQuery: /^\?vue/,
              use: [{ loader: "pug-plain-loader", options: { data: defines } }]
            },
            // this applies to pug imports inside JavaScript
            {
              use: [
                "raw-loader",
                { loader: "pug-plain-loader", options: { data: defines } }
              ]
            }
          ]
        },
        {
          test: /\.html?$/,
          include: [appClientSrcPath(appPath), appClientTemplatePath(appPath)],
          use: ["html-loader"],
          exclude: /node_modules/
        },
        {
          test: /\.(s?css)$/,
          use: filter([
            isProduction ? MiniCssExtractPlugin.loader : "style-loader",
            "css-loader",
            "sass-loader"
          ])
        },
        {
          test: /\.less$/,
          use: filter([
            isProduction ? MiniCssExtractPlugin.loader : "style-loader",
            "css-loader",
            "less-loader"
          ])
        },
        {
          test: /\.(gif|png|jpe?g|svg)$/i,
          include: [
            appClientSrcPath(appPath),
            appClientTemplatePath(appPath),
            appClientAssetsPath(appPath)
          ],
          use: [
            isProduction
              ? {
                  loader: "url-loader",
                  options: {
                    limit: 8192 // 8kb max inline data-url size
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
            hotReload: isProduction ? false : true
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
        assets: appClientAssetsPath(appPath),
        vue$: "vue/dist/vue.esm.js"
      }
    },
    resolveLoader: {
      modules: loaderResolvePaths,
      extensions: [".js", ".json"],
      mainFields: ["loader", "main"]
    },
    plugins: filter([
      options.interactive ? new ProgressBarPlugin() : null,
      options.clean
        ? new CleanWebpackPlugin({
            cleanStaleWebpackAssets: true,
            verbose: false
          })
        : null,
      isProduction
        ? new MiniCssExtractPlugin({
            filename: "[name].min.css",
            chunkFilename: "chunk.[id].css"
          })
        : null,
      new webpack.DefinePlugin(defines),
      isProduction ? null : new webpack.HotModuleReplacementPlugin(),
      new webpack.NoEmitOnErrorsPlugin(),
      new HtmlWebpackPlugin({
        template: appClientTemplatePath(appPath, "index.pug"),
        hash: true,
        cache: true,
        templateParameters: defines
      }),
      new VueLoaderPlugin(),
      new FriendlyErrorsWebpackPlugin({
        clearConsole: false
      })
    ])
  };

  if (!isProduction) {
    wpConfig.devtool = "eval";
  } else {
    wpConfig.devtool = "cheap-source-map";
  }

  return wpConfig;
}

module.exports = { generateWpConfig };
