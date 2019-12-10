var dedent = require('dedent')
var mkdirp = require('mkdirp')
var path = require('path')
var tape = require('tape')
var tmp = require('tmp')
var fs = require('fs')
var vm = require('vm')

var bankai = require('../')

tape('run a JS pipeline', function (assert) {
  assert.plan(4)
  var file = dedent`
    1 + 1
  `

  var tmpFile = tmp.fileSync({ dir: path.join(__dirname, '../tmp'), discardDescriptor: true, postfix: '.js' })
  assert.on('end', tmpFile.removeCallback)
  fs.writeFileSync(tmpFile.name, file)

  var compiler = bankai(tmpFile.name, { watch: false })
  compiler.scripts('bundle.js', function (err, res) {
    assert.error(err, 'no error writing script')
    assert.ok(res, 'output exists')
    assert.ok(res.buffer, 'output buffer exists')
    assert.ok(res.hash, 'output hash exists')
  })
})

tape('use a folder as an entry point', function (assert) {
  assert.plan(2)
  var file = dedent`
    console.log(1 + 1)
  `

  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)
  var tmpScriptname = path.join(tmpDir.name, 'index.js')
  fs.writeFileSync(tmpScriptname, file)

  var compiler = bankai(tmpDir.name, { watch: false })
  compiler.scripts('bundle.js', function (err, res) {
    assert.error(err, 'no error writing script')
    assert.notEqual(res.buffer.toString('utf8').indexOf('console.log'), -1, 'contains js')
  })
})

tape('return an error if an incorrect script is selected', function (assert) {
  assert.plan(1)
  var file = dedent`
    1 + 1
  `

  var tmpFile = tmp.fileSync({ dir: path.join(__dirname, '../tmp'), discardDescriptor: true, postfix: '.js' })
  assert.on('end', tmpFile.removeCallback)
  fs.writeFileSync(tmpFile.name, file)

  var compiler = bankai(tmpFile.name, { watch: false })
  compiler.scripts('bad-bad-not-good.js', function (err, res) {
    assert.ok(err, 'error writing script')
  })
})

tape('output multiple bundles if `split-require` is used', function (assert) {
  assert.plan(2)

  var file = `
    require('split-require')('./dynamic')
  `
  var dynamicFile = `
    console.log('loaded')
    module.exports = null
  `

  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)
  fs.writeFileSync(path.join(tmpDir.name, 'app.js'), file)
  fs.writeFileSync(path.join(tmpDir.name, 'dynamic.js'), dynamicFile)

  var compiler = bankai(path.join(tmpDir.name, 'app.js'), { watch: false })
  compiler.scripts('bundle.js', function (err, res) {
    assert.error(err, 'no error writing main bundle')
    var dynamicName = /bundle-\d+\.js/.exec(res.buffer.toString('utf-8'))
    compiler.scripts(dynamicName[0], function (err, res) {
      assert.error(err, 'no error writing dynamic bundle')
    })
  })
})

tape('use custom babel config for local files, but not for dependencies', function (assert) {
  assert.plan(2)

  var babelPlugin = `
    module.exports = function (b) {
      return {
        visitor: {
          Program: function (path) {
            path.unshiftContainer('body', b.types.stringLiteral('hello'))
          }
        }
      }
    }
  `
  var babelrc = JSON.stringify({
    plugins: ['./plugin']
  })
  var file = `
   require('a-module-with-babelrc')
  `

  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)
  fs.writeFileSync(path.join(tmpDir.name, 'plugin.js'), babelPlugin)
  fs.writeFileSync(path.join(tmpDir.name, '.babelrc'), babelrc)
  fs.writeFileSync(path.join(tmpDir.name, 'app.js'), file)

  var compiler = bankai(path.join(tmpDir.name, 'app.js'), { watch: false })
  compiler.on('error', assert.error)
  compiler.scripts('bundle.js', function (err, res) {
    assert.error(err, 'error building .babelrc dependency')
    assert.pass('should build')
  })
})

tape('skip babel for dependencies if babelifyDeps is false', function (assert) {
  assert.plan(4)
  var file = dedent`
    const depFunc = require('mydep').depFunc
    depFunc(1)
  `
  var depFile = dedent`
    const depFunc = (arg) => {
      console.log(arg)
    }
    module.exports = {
      depFunc
    }
`

  var filename = 'js-pipeline-' + (Math.random() * 1e4).toFixed() + '.js'
  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)

  var tmpFilename = path.join(tmpDir.name, filename)
  fs.writeFileSync(tmpFilename, file)
  mkdirp.sync(path.join(tmpDir.name, 'node_modules'))
  fs.writeFileSync(path.join(tmpDir.name, 'node_modules', 'mydep.js'), depFile)

  var compiler = bankai(tmpFilename, { watch: false, babelifyDeps: false })
  compiler.scripts('bundle.js', function (err, node) {
    assert.error(err, 'no error writing script')
    assert.ok(node, 'output exists')
    assert.ok(node.buffer, 'output buffer exists')

    const compiledJs = node.buffer.toString('utf8')
    assert.notOk(/['"]use strict['"]/.test(compiledJs))
  })
})

tape('use custom browserslist config', function (assert) {
  assert.plan(5)

  var browserslist = `
    last 1 Chrome versions
  `
  var file = `
    for (const value of generator()) {}
    function * generator () {
      yield 'foo'
    }
  `

  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)
  fs.writeFileSync(path.join(tmpDir.name, '.browserslistrc'), browserslist)
  fs.writeFileSync(path.join(tmpDir.name, 'app.js'), file)

  var compiler = bankai(path.join(tmpDir.name, 'app.js'), { watch: false })
  compiler.on('error', assert.error)
  compiler.scripts('bundle.js', function (err, res) {
    assert.error(err, 'no error writing script')
    var content = res.buffer.toString('utf8')
    assert.ok(/for\s*\(\w+ \w+ of /.test(content), 'did not transpile for...of')
    assert.ok(/const/.test(content), 'did not transpile const keyword')
    assert.ok(/function\s*\*/.test(content), 'did not transpile generator function')
    assert.ok(/yield/.test(content), 'did not transpile yield keyword')
  })
})

tape('does not transform top level `this` in dependencies', function (assert) {
  assert.plan(4)
  var file = `
    T.equal(require('a')(), 10)
  `
  var dependency = `
    module.exports = this.number || (() => 10)
  `

  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)

  mkdirp.sync(path.join(tmpDir.name, 'node_modules'))
  fs.writeFileSync(path.join(tmpDir.name, 'app.js'), file)
  fs.writeFileSync(path.join(tmpDir.name, 'node_modules', 'a.js'), dependency)

  var compiler = bankai(path.join(tmpDir.name, 'app.js'), { watch: false })
  compiler.on('error', assert.error)
  compiler.scripts('bundle.js', function (err, res) {
    assert.error(err, 'no error writing script')
    var content = res.buffer.toString('utf8')

    assert.ok(/this\.number/.test(content), 'did not rewrite `this`')
    assert.ok(/return 10/.test(content), 'did rewrite arrow function')

    vm.runInNewContext(content, { T: assert })
  })
})

tape('envify in watch mode', function (assert) {
  assert.plan(5)

  var file = `
    console.log(process.env.BANKAI_TEST_VALUE)
  `
  var file2 = `
    var a = process.env.BANKAI_TEST_VALUE
    console.log({ a: a })
  `

  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)
  fs.writeFileSync(path.join(tmpDir.name, 'app.js'), file)

  process.env.BANKAI_TEST_VALUE = 'replacement'
  var compiler = bankai(path.join(tmpDir.name, 'app.js'), { watch: true, reload: false })
  compiler.on('error', assert.error)
  compiler.scripts('bundle.js', function (err, res) {
    assert.error(err, 'no error writing script')
    assert.notEqual(res.buffer.toString('utf8').indexOf('replacement'), -1, 'contains replacement value')

    compiler.graph.on('change', next)

    // Wait for a bit before changing the source file, because the watcher setup isn't instant.
    setTimeout(function () {
      fs.writeFileSync(path.join(tmpDir.name, 'app.js'), file2)
    }, 500)
  })

  function next (stepName, nodeName) {
    if (stepName !== 'scripts' || nodeName !== 'bundle') return
    compiler.scripts('bundle.js', function (err, res) {
      assert.error(err, 'no error writing script')
      assert.notEqual(res.buffer.toString('utf8').indexOf('replacement'), -1, 'contains replacement value')
      assert.notEqual(res.buffer.toString('utf8').indexOf('a: a'), -1, 'is the updated file')

      compiler.close()
    })
    compiler.graph.removeListener('change', next)
  }
})

tape('apply nanohtml transform to scripts transpiled from typescript with esmoduleinterop', function (assert) {
  assert.plan(3)

  var file = `
      "use strict";
      var __importDefault = (this && this.__importDefault) || function (mod) {
          return (mod && mod.__esModule) ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      const choo_1 = __importDefault(require("choo"));
      const html_1 = __importDefault(require("choo/html"));
      const app = new choo_1.default();
      app.route('/', function () {
          return html_1.default \`<body>meow</body>\`;
      });
      module.exports = app.mount('body');
    `

  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)
  fs.writeFileSync(path.join(tmpDir.name, 'index.js'), file)

  var compiler = bankai(tmpDir.name, { watch: false })
  compiler.scripts('bundle.js', function (err, res) {
    assert.ifError(err, 'no err bundling scripts')
    var body = res.buffer.toString('utf8')
    assert.equal(body.indexOf('html_1.default'), -1, 'choo/html is not used')
    assert.equal(body.indexOf('<body>meow</body>'), -1, 'HTML string is tranformed')
  })
})
