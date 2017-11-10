const pathHelper = require('path')

module.exports = {
  context: pathHelper.join(__dirname, '..'),
  entry: {
    index: './src/index.ts',
    'rocket-adapter': './src/modules/rocket-adapter/index.ts',
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
  devtool: '#sourcemap',
}
