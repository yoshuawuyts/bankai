var debug = require('debug')('bankai.node-script')
var concat = require('concat-stream')
var exorcist = require('exorcist')
var tfilter = require('tfilter')
var assert = require('assert')

var babelPresetEnv = require('babel-preset-env')
var splitRequire = require('split-require')
var browserslist = require('browserslist')
var cssExtract = require('css-extract')
var browserify = require('browserify')
var babelify = require('babelify')
var watchify = require('watchify')
var sheetify = require('sheetify')
var nanohtml = require('nanohtml')
var tinyify = require('tinyify')
var glslify = require('glslify')
var envify = require('envify/custom')
var brfs = require('brfs')

var ttyError = require('./tty-error')
var exorcise = require('./exorcise')

var defaultBrowsers = [
  'last 2 Chrome versions',
  'last 2 Firefox versions',
  'last 2 Safari versions',
  'last 2 Edge versions',
  '> 1%' // Cover all other browsers that are widely used.
]

module.exports = node

function node (state, createEdge) {
  assert.strictEqual(typeof state.metadata.entry, 'string', 'state.metadata.entries should be type string')

  this.emit('progress', 'scripts', 0)

  var self = this
  var entry = state.metadata.entry
  var fullPaths = Boolean(state.metadata.fullPaths)
  var b = browserify(browserifyOpts([entry], fullPaths))
  var shouldMinify = !state.metadata.watch

  // Lookup browsers to support in Babel.
  var browsers = browserslist(null, { path: entry })
  if (!browsers.length) browsers = defaultBrowsers

  if (state.metadata.watch) {
    b = watchify(b)
    debug('watching ' + entry)
    this.on('close', function () {
      debug('closing file watcher')
      b.close()
    })
  }

  if (state.metadata.babelifyDeps) {
    // Dependencies should be transformed, but their .babelrc should be ignored.
    b.transform(tfilter(babelify, { include: /node_modules/ }), {
      global: true,
      babelrc: false,
      presets: [
        [babelPresetEnv, {
          // browserify resolves the commonjs version of modules anyway,
          // and the modules transform in babel-preset-env rewrites top level `this`
          // to `undefined` which breaks some modules (underscore, cuid, ...)
          modules: false,
          targets: { browsers: browsers }
        }]
      ]
    })
  }
  // In our own code, .babelrc files should be used.
  b.transform(tfilter(babelify, { exclude: /node_modules/ }), {
    global: true,
    babelrc: true,
    presets: [
      [babelPresetEnv, {
        targets: { browsers: browsers }
      }]
    ]
  })

  b.ignore('sheetify/insert')
  b.transform(sheetify, { global: true })
  b.transform(glslify, { global: true })
  b.transform(brfs, { global: true })
  b.transform(nanohtml, { global: true })

  if (!fullPaths) b.plugin(cssExtract, { out: bundleStyles })

  // split-require does not support `fullPaths: true` at the moment.
  // the next best thing is to bundle everything, because the byte counts
  // shown for individiual modules in discify will still be correct.
  if (!fullPaths) {
    b.plugin(splitRequire, {
      filename: function (record) {
        return 'bundle-' + record.index + '.js'
      },
      output: bundleDynamicBundle,
      sri: 'sha512'
    })
    // Run exorcist as part of the split-require pipeline, so that
    // it can generate correct hashes for dynamic bundles.
    b.on('split.pipeline', function (pipeline, entry, name) {
      pipeline.get('wrap').push(exorciseDynamicBundle(name))
    })
  }

  if (shouldMinify) {
    b.plugin(tinyify)
    b.on('split.pipeline', function (pipeline) {
      tinyify.applyToPipeline(pipeline, b._options)
    })
  } else {
    var env = Object.assign({
      NODE_ENV: 'development'
    }, process.env)
    b.transform(envify(env), { global: true })
  }

  bundleScripts()
  b.on('update', bundleScripts)

  var dynamicBundles
  function bundleScripts (files) {
    if (files) debug('triggering update because of changes in', files)
    self.emit('progress', 'scripts', 30)

    dynamicBundles = []
    b.bundle(function (err, bundle) {
      if (err) {
        delete err.stream
        err = ttyError('scripts', 'browserify.bundle', err)
        return self.emit('error', 'scripts', 'browserify.bundle', err)
      }
      var mapName = 'bundle.js.map'
      exorcise(bundle, mapName, function (err, bundle, map) {
        if (err) return self.emit('error', 'scripts', 'exorcise', err)
        createEdge(mapName, Buffer.from(map), {
          mime: 'application/json'
        })
        createEdge('bundle', bundle, {
          mime: 'application/javascript',
          dynamicBundles: dynamicBundles
        })
        self.emit('progress', 'scripts', 100)
      })
    })
  }

  function exorciseDynamicBundle (bundleName) {
    var mapName = bundleName + '.map'
    return exorcist(concat({ encoding: 'buffer' }, function (map) {
      createEdge(mapName, map, {
        mime: 'application/json'
      })
    }), mapName)
  }

  function bundleDynamicBundle (bundleName) {
    var edgeName = bundleName.replace(/\.js$/, '')
    var stream = concat({ encoding: 'buffer' }, function (bundle) {
      dynamicBundles.push(bundleName)
      createEdge(edgeName, bundle, {
        mime: 'application/javascript'
      })

      // Inform the main bundle about this file's full name.
      stream.emit('name', state.scripts[edgeName].hash.toString('hex').slice(0, 16) + '/' + bundleName)
    })
    return stream
  }

  function bundleStyles () {
    return concat({ encoding: 'buffer' }, function (buf) {
      createEdge('style', buf, {
        mime: 'text/css'
      })
    })
  }
}

function browserifyOpts (entries, fullPaths) {
  assert.ok(Array.isArray(entries), 'browserifyOpts: entries should be an array')
  return {
    debug: true,
    fullPaths: fullPaths,
    entries: entries,
    packageCache: {},
    cache: {}
  }
}
