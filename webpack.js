const path = require('path');
const root = process.cwd();
const dist = path.resolve(root, 'dist');
const src = path.resolve(root);
const webpack = require('webpack');

module.exports = {
    context: src,
    mode: 'production',
    target: 'node',  
    devtool: 'inline-source-map',
    entry: 'index.ts',
    output: {
      chunkFilename: '[name].bundle.js',
      library: '@tsed/swagger',
      filename: 'bundle.js',
      libraryTarget: 'umd',
      umdNamedDefine: true,
      path: dist
    },
    node:{
      process: true,
      crypto: 'empty',
      module: false,
      clearImmediate: false,
      setImmediate: false
    },
    externals: [
        "@tsed/common",
        "@tsed/core",
        "@types/express",
        "@types/swagger-schema-official",
        "express"
    ],
    resolve: {
      extensions: [ '.tsx', '.ts', '.js' ],
      modules: ["node_modules",src]
    },
    plugins: [
      new webpack.NoEmitOnErrorsPlugin()
    ],
    module: {
      rules: [
        {
          test: /\.ejs$/,
          loader: 'ejs-compiled-loader'
        },
        {
          test: /\.(tsx|ts)?$/,
          exclude: [
            /node_modules/
          ],
          use: [
            {
              loader: 'babel-loader',
              options: {
                  presets: [
                    ["env", 
                      {
                        "targets": {
                          "node": "10"
                        },
                        "ignore": [
                          "node_modules"
                        ]
                       }
                    ]
                  ],
                  plugins:[
                  "transform-runtime",
                  "transform-async-to-generator",
                  "transform-class-properties",
                  "transform-object-rest-spread"
                  ]
              }
            },
            {
              loader: "awesome-typescript-loader",
              options:{
                useCache:false,
                reportFiles:["src/**/*.{ts,tsx}"],
                configFileName:'./tsconfig.json',
                forceIsolatedModules: true
              }
            }
          ]
        },
        {
          test: /\.js$/,
          enforce: 'pre',
          exclude: [
            /node_modules/
          ],
          loader: 'babel-loader',
          options: {
              presets: [
                ["env", 
                  {
                    "targets": {
                      "node": "10"
                    },
                    "ignore": [
                      "node_modules"
                    ]
                  }
                ]
              ],
              plugins:[
                "transform-runtime",
                "transform-async-to-generator",
                "transform-class-properties",
                "transform-object-rest-spread"
              ]
          }
        }
      ]
    }
};