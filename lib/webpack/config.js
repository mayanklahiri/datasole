const webpack = require("webpack");

const { appEntryPointPath, appOutputPath } = require("../pathutil");
const { json } = require("../util");

function generateWpConfig(config) {
  const appPath = config.paths.appPath;
  const appPublicPath = config.paths.publicPath || "/js/";

  // Compile-time constants injected into Javascript.
  const defines = {
    CONFIG: json(config)
  };

  return {
    mode: config.mode,
    entry: [appEntryPointPath(appPath), "webpack-hot-middleware/client"],
    output: {
      path: appOutputPath(appPath, appPublicPath),
      filename: "bundle.js",
      publicPath: appPublicPath
    },
    module: {
      rules: [
        {
          test: /.jsx?$/,
          include: [appPath],
          loader: "babel-loader",
          exclude: /node_modules/,
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
      modules: ["node_modules", appPath],
      extensions: [".js", ".json", ".jsx", ".css"]
    },
    plugins: [
      new webpack.DefinePlugin(defines),
      new webpack.HotModuleReplacementPlugin(),
      new webpack.NoEmitOnErrorsPlugin()
    ]
  };
}

module.exports = { generateWpConfig };
