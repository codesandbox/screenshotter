const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const slsw = require("serverless-webpack");
const PermissionsOutputPlugin = require("webpack-permissions-plugin");
const execSync = require("child_process").execSync;

module.exports = {
  entry: slsw.lib.entries,
  target: "node",
  resolve: {
    // Add `.ts` and `.tsx` as a resolvable extension.
    extensions: [".ts", ".tsx", ".js"],
  },
  output: {
    libraryTarget: "commonjs",
    path: path.join(__dirname, ".webpack"),
    filename: "[name].js",
  },
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      { test: /\.tsx?$/, loader: "ts-loader" },
      {
        test: /\.js$/,
        exclude: [/extract\-zip/],
        use: [
          {
            loader: "babel-loader",
          },
        ],
      },
    ],
  },
  plugins: [
    function copy() {
      const compiler = this;

      compiler.plugin("done", function() {
        execSync(
          "mkdir ./.webpack/service/src/bin && cp ./src/bin/headless_shell.compiled ./.webpack/service/src/bin/headless_shell.compiled",
        );
      });
    },
  ],
};
