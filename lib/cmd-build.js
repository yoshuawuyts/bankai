var ansi = require('ansi-escape-sequences')
var pinoColada = require('pino-colada')
var async = require('async-collection')
var fsCompare = require('fs-compare')
var pumpify = require('pumpify')
var mkdirp = require('mkdirp')
var path = require('path')
var zlib = require('zlib')
var pump = require('pump')
var fs = require('fs')

var bankai = require('../')
var utils = require('./utils')

process.env.NODE_ENV = process.env.NODE_ENV || 'production'

module.exports = build

function build (entry, outdir, opts) {
  var bankaiOpts = {
    logStream: pumpify(pinoColada(), process.stdout),
    watch: false,
    base: opts.base
  }

  if (!outdir) {
    var dirname = path.extname(entry) === '' ? entry : utils.dirname(entry)
    outdir = path.join(dirname, 'dist')
  }

  mkdirp(outdir, function (err) {
    if (err) return console.error(err)

    var compiler = bankai(entry, bankaiOpts)
    var log = compiler.log

    log.info('Compiling & compressing files\n')
    created(compiler.dirname, outdir + '/')

    compiler.on('error', function (topic, sub, err) {
      if (err.pretty) log.error(err.pretty)
      else {
        log.error(`${topic}:${sub} ${err.message}\n${err.stack}`)
      }
    })

    compiler.on('ssr', function (result) {
      if (!result.success) log.warn('Server Side Rendering Skipped due to error: ' + result.error.message)
    })

    compiler.on('change', function (nodeName, edgeName, nodeState) {
      var stepName = nodeName + ':' + edgeName
      if (stepName === 'assets:list') writeAssets('assets')
      if (stepName === 'documents:list') writeDocuments('documents')
      if (stepName === 'favicon:bundle') writeFavicon()
      if (stepName === 'scripts:bundle') writeScripts('scripts')
      if (stepName === 'service-worker:bundle') {
        var filename = compiler.graph.metadata.serviceWorker
        compiler.serviceWorker(writeSimple(filename, 'service-worker'))
      }
    })

    compiler.manifest(writeSimple('manifest.json', 'manifest'))
    compiler.styles('bundle.css', writeSingle('bundle.css', 'styles'))
    compiler.scripts('bundle.js', writeSingle('bundle.js', 'scripts'))

    function writeAssets () {
      var assets = compiler.graph.metadata.assets
      var list = Object.keys(assets)
      async.mapLimit(list, 3, copyFile, function (err) {
        if (err) return log.error(err)
        completed('assets')
      })

      // TODO: It'd be sick if we could optimize our paths to assets,
      // add etags to our tags and put them in the right dir.
      function copyFile (src, done) {
        var dest = path.join(outdir, path.relative(compiler.dirname, src))
        var dirname = utils.dirname(dest)

        if (dirname === dest) {
          copy(src, dest, compiler.dirname, done)
        } else {
          mkdirp(dirname, function (err) {
            if (err) return done(err)
            copy(src, dest, compiler.dirname, done)
          })
        }
      }
    }

    function writeFavicon () {
      var favicon = compiler.graph.data.favicon.bundle.buffer.toString()
      if (favicon.length === 0) {
        return
      }
      var src = path.join(compiler.dirname, favicon)
      var dest = path.join(outdir, favicon)
      copy(src, dest, compiler.dirname, function (err) {
        if (err) return log.error(err)
        completed('favicon')
      })
    }

    function writeScripts (step) {
      var node = compiler.graph.data[step].bundle
      var list = node.dynamicBundles || []
      async.mapLimit(list, 3, iterator, function (err) {
        if (err) return log.error(err)
        completed(step)
      })

      function iterator (filename, done) {
        compiler[step](filename, writeSingle(filename, step))
      }
    }

    function writeDocuments (step) {
      var write = writeCompressed

      var node = compiler.graph.data[step].list
      var list = String(node.buffer).split(',')
      async.mapLimit(list, 3, iterator, function (err) {
        if (err) return log.error(err)
        completed(step)
      })

      function iterator (filename, done) {
        // if (filename === '/') filename = 'index.html'

        // skip over all partial files
        if (/[:*]/.test(filename)) return done()
        compiler[step](filename, function (err, node) {
          if (err) return done(err)
          filename = path.join(outdir, filename, 'index.html')
          var dirname = utils.dirname(filename)
          if (dirname === filename) {
            write(filename, node.buffer, done)
          } else {
            mkdirp(dirname, function (err) {
              if (err) return done(err)
              write(filename, node.buffer, done)
            })
          }
        })
      }
    }

    function writeSimple (filename, type) {
      return function (err, node) {
        if (err) return log.error(err)
        filename = path.join(outdir, filename)
        writeCompressed(filename, node.buffer, function (err) {
          if (err) return log.error(err)
          completed(type)
        })
      }
    }

    function writeSingle (filename, type) {
      return function (err, node) {
        if (err) return log.error(err)
        var dirname = path.join(outdir, node.hash.toString('hex').slice(0, 16))
        mkdirp(dirname, function (err) {
          if (err) return log.error(err)
          var sourcemapNode = type === 'scripts' && compiler.graph.data[type][`${filename}.map`]
          var sourcemap = path.join(dirname, `${filename}.map`)
          filename = path.join(dirname, filename)
          writeCompressed(filename, node.buffer, function (err) {
            if (err) return log.error(err)
            if (!sourcemapNode) {
              return completed(type)
            }
            writeCompressed(sourcemap, sourcemapNode.buffer, function (err) {
              if (err) return log.error(err)
              completed(type)
            })
          })
        })
      }
    }

    // Node <= 8.x does not have fs.copyFile(). This API is cool because
    // on some OSes it is zero-copy all the way; e.g. never leaves the
    // kernel! :D
    function copy (src, dest, dirname, done) {
      fsCompare.mtime(src, dest, function (err, diff) {
        if (err) return done(err)
        if (diff === 1) {
          if (fs.copyFile) fs.copyFile(src, dest, fin)
          else pump(fs.createReadStream(src), fs.createWriteStream(dest), fin)
        }
      })
      function fin (err) {
        if (err) return done(err)
        created(dirname, dest)
        done()
      }
    }

    function created (basedir, filename) {
      var relative = path.relative(process.cwd(), filename)
      log.info(`${clr('created', 'magenta')}: ${relative}`)
    }

    function completed (step) {
      log.debug(`${clr('completed', 'green')}: ${step}`)
    }

    function writeCompressed (filename, buffer, done) {
      async.series([
        function raw (done) {
          fs.writeFile(filename, buffer, function (err) {
            if (err) return done(err)
            created(compiler.dirname, filename)
            done()
          })
        },
        function gzip (done) {
          zlib.gzip(buffer, function (err, compressed) {
            if (err) return done(err)
            var outfile = filename + '.gz'
            fs.writeFile(outfile, compressed, function (err) {
              if (err) return done(err)
              created(compiler.dirname, outfile)
              done()
            })
          })
        },
        function deflate (done) {
          zlib.deflate(buffer, function (err, compressed) {
            if (err) return done(err)
            var outfile = filename + '.deflate'
            fs.writeFile(outfile, compressed, function (err) {
              if (err) return done(err)
              created(compiler.dirname, outfile)
              done()
            })
          })
        },
        function compressBrotli (done) {
          utils.brotli(buffer).then(function (compressed) {
            var outfile = filename + '.br'
            fs.writeFile(outfile, compressed, function (err) {
              if (err) return done(err)
              created(compiler.dirname, outfile)
              done()
            })
          }).catch(done)
        }
      ], done)
    }
  })
}

function clr (text, color) {
  return process.stdout.isTTY ? ansi.format(text, color) : text
}
