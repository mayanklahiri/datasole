const { merge, filter } = require("lodash");
const webpack = require("webpack");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const ProgressBarPlugin = require("progress-bar-webpack-plugin");

const {
  libRoot,
  clientAppRoot,
  clientAppEntryPointPath,
  clientAppOutputPath,
  clientAppNodeModules,
  clientAppSrcPath,
  clientAppTemplatePath,
  clientAppAssetsPath,
  nodeModulesPath
} = require("../pathutil");
const { json } = require("../util");
const { dirExists } = require("../fs-util");

function generateWpConfig(config, options) {
  const {
    server: { urlRootPath },
    paths: { appPath }
  } = config;
  options = merge(
    {
      clean: false
    },
    options
  );

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

  // Create Webpack config.
  const wpConfig = {
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
          include: [clientAppSrcPath(appPath)],
          loader: "babel-loader",
          exclude: /node_modules/,
          options: {
            presets: [require("@babel/preset-env")]
          }
        },
        {
          test: /.pug$/,
          include: [clientAppSrcPath(appPath), clientAppTemplatePath(appPath)],
          use: ["pug-loader"],
          exclude: /node_modules/
        },
        {
          test: /.html?$/,
          include: [clientAppSrcPath(appPath), clientAppTemplatePath(appPath)],
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
            clientAppSrcPath(appPath),
            clientAppTemplatePath(appPath),
            clientAppAssetsPath(appPath)
          ],
          use: [
            "file-loader",
            {
              loader: "image-webpack-loader"
            }
          ]
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
        ".html"
      ],
      alias: {
        Assets: clientAppAssetsPath(appPath)
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
        ? new CleanWebpackPlugin([clientAppOutputPath(appPath)], {
            root: clientAppRoot(appPath),
            verbose: false
          })
        : null,
      new webpack.DefinePlugin(defines),
      new webpack.HotModuleReplacementPlugin(),
      new webpack.NoEmitOnErrorsPlugin(),
      new HtmlWebpackPlugin({
        template: clientAppTemplatePath(appPath, "index.pug"),
        hash: true,
        cache: true,
        templateParameters: defines
      })
    ])
  };

  if (!IS_PROD) {
    wpConfig.devtool = "eval";
  }

  return wpConfig;
}

module.exports = { generateWpConfig };
