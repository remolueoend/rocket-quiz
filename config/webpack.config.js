const pathHelper = require('path')
const fs = require('fs')
const NodePathReplacePlugin = require('./NodePathReplacePlugin')
nodeExternals = require('webpack-node-externals')

module.exports = {
  context: pathHelper.join(__dirname, '..'),
  entry: {
    index: './src/index.ts',
    'rocket-adapter': './src/services/rocket-adapter/index.ts',
    repl: './src/services/repl/index.ts',
    logger: './src/services/logger/index.ts',
    'cmd-interpreter': './src/services/cmd-interpreter/index.ts',
  },
  output: {
    path: pathHelper.join(__dirname, '../build'),
    filename: '[name].js',
    devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    devtoolFallbackModuleFilenameTemplate: '[absolute-resource-path]?[hash]',
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  module: {
    rules: [{ test: /\.tsx?$/, loader: 'ts-loader' }],
  },
  target: 'node',
  devtool: 'inline-source-map',
  plugins: [new NodePathReplacePlugin()],
  externals: [nodeExternals()],
}
