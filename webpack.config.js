/* eslint-disable no-undef */

const devCerts = require("office-addin-dev-certs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
const packageJson = require("./package.json");

const urlDev = "https://localhost:3000/";
const urlProd = "https://reconnaishawnce.github.io/snippetlib/"; // GitHub Pages deployment (plan §2)

async function getHttpsOptions() {
  const httpsOptions = await devCerts.getHttpsServerOptions();
  return { ca: httpsOptions.ca, key: httpsOptions.key, cert: httpsOptions.cert };
}

module.exports = async (env, options) => {
  const dev = options.mode === "development";
  const config = {
    devtool: "source-map",
    // Persist the compile cache to disk: the first `npm run dev` still pays
    // full price (~30-50s), but every later start reuses it (seconds).
    cache: { type: "filesystem" },
    entry: {
      polyfill: ["core-js/stable", "regenerator-runtime/runtime"],
      react: ["react", "react-dom"],
      taskpane: {
        import: ["./src/taskpane/index.tsx", "./src/taskpane/taskpane.html"],
        dependOn: "react",
      },
      builder: {
        import: ["./src/builder/index.tsx", "./src/builder/builder.html"],
        dependOn: "react",
      },
      commands: "./src/commands/commands.ts",
    },
    output: {
      clean: true,
      // Content-hashed bundles in production: Office's webview caches hard,
      // and fixed names can mix a cached old HTML with new JS (or vice versa)
      // right after a deploy. Hashed names make every release atomic. Dev
      // keeps plain names for HMR.
      filename: dev ? "[name].js" : "[name].[contenthash:12].js",
    },
    resolve: {
      extensions: [".ts", ".tsx", ".html", ".js"],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
          },
        },
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: ["ts-loader"],
        },
        {
          test: /\.html$/,
          exclude: /node_modules/,
          use: "html-loader",
        },
        {
          test: /\.(png|jpg|jpeg|ttf|woff|woff2|gif|ico)$/,
          type: "asset/resource",
          generator: {
            filename: "assets/[name][ext][query]",
          },
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        __APP_VERSION__: JSON.stringify(packageJson.version),
      }),
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["polyfill", "taskpane", "react"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "assets/*",
            to: "assets/[name][ext][query]",
          },
          {
            from: "manifest*.xml",
            to: "[name]" + "[ext]",
            transform(content) {
              if (dev) {
                return content;
              } else {
                return content.toString().replace(new RegExp(urlDev, "g"), urlProd);
              }
            },
          },
        ],
      }),
      new HtmlWebpackPlugin({
        filename: "builder.html",
        template: "./src/builder/builder.html",
        chunks: ["polyfill", "builder", "react"],
      }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/commands/commands.html",
        chunks: ["polyfill", "commands"],
      }),
      // NOTE: no ProvidePlugin Promise shim here. The template's es6-promise
      // injection shadows the Promise used by transpiled async/await, which
      // breaks Dexie's transaction zone (PrematureCommitError). core-js in the
      // polyfill entry already supplies a global Promise for old webviews.
    ],
    devServer: {
      hot: true,
      client: {
        overlay: {
          errors: true,
          warnings: false,
          // Benign browser noise triggered by Fluent UI popup positioning —
          // not an app error, so keep the dev overlay out of the way.
          runtimeErrors: (error) =>
            !/ResizeObserver loop/.test(error && error.message ? error.message : ""),
        },
      },
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      server: {
        type: "https",
        options:
          env.WEBPACK_BUILD || options.https !== undefined
            ? options.https
            : await getHttpsOptions(),
      },
      port: process.env.npm_package_config_dev_server_port || 3000,
    },
  };

  return config;
};
