const pathHelper = require('path')
const NodePathReplacePlugin = require('./NodePathReplacePlugin')

module.exports = {
  context: pathHelper.join(__dirname, '..'),
  entry: {
    'rocket-adapter': './src/services/rocket-adapter/index.ts',
    repl: './src/services/repl/index.ts',
    logger: './src/services/logger/index.ts',
  },
  output: {
    path: pathHelper.join(__dirname, '../build'),
    filename: '[name].js',
    devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    devtoolFallbackModuleFilenameTemplate: '[absolute-resource-path]?[hash]',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [{ test: /\.tsx?$/, loader: 'ts-loader' }],
  },
  target: 'node',
  devtool: 'inline-source-map',
  plugins: [new NodePathReplacePlugin()],
}
