/**
 * Modified NodeStuffPlugin to replace __filename and __dirname with absolute path
 * @see webpack/webpack:lib/NodeStuffPlugin.js@ca8b693
 */
function NodePathReplacePlugin() {}
module.exports = NodePathReplacePlugin
NodePathReplacePlugin.prototype.apply = function(compiler) {
  function setModuleConstant(expressionName, fn) {
    compiler.parser.plugin('expression ' + expressionName, function() {
      this.state.current.addVariable(
        expressionName,
        JSON.stringify(fn(this.state.module)),
      )
      return true
    })
  }

  setModuleConstant('__filename', function(module) {
    return module.resource
  })

  setModuleConstant('__dirname', function(module) {
    return module.context
  })
}
