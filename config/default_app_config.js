const pathHelper = require('path');

module.exports = {
  modules: {
    adapter: pathHelper.join(__dirname, '../build/rocket-adapter.js'),
  }
};