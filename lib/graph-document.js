var waterfall = require('async-collection/waterfall')
var mapLimit = require('async-collection/map-limit')
var explain = require('explain-error')
var concat = require('concat-stream')
var resolve = require('resolve')
var crypto = require('crypto')
var pump = require('pump')
var path = require('path')

var critical = require('inline-critical-css')
var documentify = require('documentify')
var hyperstream = require('hstream')

var ttyError = require('./tty-error')
var utils = require('./utils')

var WRITE_CONCURRENCY = 3

module.exports = node

function node (state, createEdge) {
  var entry = utils.basefile(state.metadata.entry)
  var ssr = state.metadata.ssr
  var self = this

  if (ssr.error && ssr.error.isSsr) {
    self.emit('ssr', { success: false, error: ssr.error })
  } else if (ssr.error) {
    ssr.error = ttyError('documents', entry, ssr.error)
    return self.emit('error', 'documents', entry, ssr.error)
  }

  // TODO: don't pass a callback here - super hard to reason about. Find a
  // different way instead. Perhaps a prototype with methods on it instead?
  self.emit('ssr', { success: true, renderRoute: documentifyRoute })

  var fonts = extractFonts(state.assets)
  var list = ssr.routes

  mapLimit(list, WRITE_CONCURRENCY, documentifyRoute, function (err) {
    if (err) return self.emit(err)
    createEdge('list', Buffer.from(list.join(',')))
  })

  function documentifyRoute (route, done) {
    waterfall([
      renderApp,
      documentifyApp,
      pushEdge
    ], done)

    function renderApp (done) {
      ssr.render(route, function (err, content) {
        if (err) {
          self.emit('ssr', { success: false, error: err })
          return done(err)
        }
        done(null, content)
      })
    }

    function pushEdge (buf, done) {
      var name = route
      if (name === '/') name = 'index'
      name = name + '.html'
      createEdge(name, buf, {
        mime: 'text/html'
      })
      done(null, buf)
    }
  }

  function getTemplate (content, done) {
    // TODO maybe change this depending on the `content.route`, so you can have different templates for different routes?
    var name = 'index'

    var dir = path.join(path.dirname(entry), name)
    resolve('.', { basedir: dir, extensions: ['.html'] }, function (err, filename) {
      if (err) {
        done(dir, head(content.language))
      } else {
        // Only return the filename, documentify will stream it in.
        done(filename, null)
      }
    })
  }

  function documentifyApp (content, done) {
    var base = state.metadata.opts.base
    var route = content.route
    var title = content.title
    var body = content.body
    var selector = content.selector

    var hasDynamicScripts = state.scripts.bundle.dynamicBundles.length > 0

    getTemplate(content, ontemplate)

    function ontemplate (filename, html) {
      var d = documentify(filename, html)
      var header = [
        viewportTag(),
        content.state && initialState(content.state),
        scriptTag({ hash: state.scripts.bundle.hash, base: base }),
        hasDynamicScripts && dynamicScriptsTag({
          bundleNames: state.scripts.bundle.dynamicBundles,
          scripts: state.scripts,
          base: base
        }),
        preloadTag(),
        loadFontsTag({ fonts: fonts, base: base }),
        faviconsTag({ favicon: state.favicon.bundle.buffer }),
        manifestTag({ base: base }),
        descriptionTag({ description: state.manifest.bundle.description }),
        themeColorTag({ color: state.manifest.bundle.color }),
        titleTag({ title: title })
      ].filter(Boolean)
      // TODO: twitter
      // TODO: facebook
      // TODO: apple touch icons
      // TODO: favicons

      if (state.metadata.reload) {
        header.push(reloadTag({ bundle: state.reload.bundle.buffer }))
      }

      d.transform(addToHead, header.join(''))

      d.transform(insertApp, {
        selector: selector,
        body: body
      })

      if (state.styles.bundle.buffer.length) {
        d.transform(criticalTransform, { css: state.styles.bundle.buffer })
      }

      d.transform(addToHead, styleTag({ hash: state.styles.bundle.hash, base: base }))

      function complete (buf) { done(null, buf) }

      pump(d.bundle(), concat({ encoding: 'buffer' }, complete), function (err) {
        if (err) return done(explain(err, 'Error in documentify while operating on ' + route))
      })
    }
  }
}

function head (lang) {
  var dir = 'ltr'
  return `<!DOCTYPE html><html lang="${lang}" dir="${dir}"><head></head><body></body></html>`
}

// Make sure that rel=preload works in Safari.
function preloadTag () {
  var content = ';(function(a){"use strict";var b=function(b,c,d){function e(a){return h.body?a():void setTimeout(function(){e(a)})}function f(){i.addEventListener&&i.removeEventListener("load",f),i.media=d||"all"}var g,h=a.document,i=h.createElement("link");if(c)g=c;else{var j=(h.body||h.getElementsByTagName("head")[0]).childNodes;g=j[j.length-1]}var k=h.styleSheets;i.rel="stylesheet",i.href=b,i.media="only x",e(function(){g.parentNode.insertBefore(i,c?g:g.nextSibling)});var l=function(a){for(var b=i.href,c=k.length;c--;)if(k[c].href===b)return a();setTimeout(function(){l(a)})};return i.addEventListener&&i.addEventListener("load",f),i.onloadcssdefined=l,l(f),i};"undefined"!=typeof exports?exports.loadCSS=b:a.loadCSS=b})("undefined"!=typeof global?global:this);'
  content += ';(function(a){if(a.loadCSS){var b=loadCSS.relpreload={};if(b.support=function(){try{return a.document.createElement("link").relList.supports("preload")}catch(b){return!1}},b.poly=function(){for(var b=a.document.getElementsByTagName("link"),c=0;c<b.length;c++){var d=b[c];"preload"===d.rel&&"style"===d.getAttribute("as")&&(a.loadCSS(d.href,d,d.getAttribute("media")),d.rel=null)}},!b.support()){b.poly();var c=a.setInterval(b.poly,300);a.addEventListener&&a.addEventListener("load",function(){b.poly(),a.clearInterval(c)}),a.attachEvent&&a.attachEvent("onload",function(){a.clearInterval(c)})}}})(this);'
  return `<script>${content}</script>`
}

function initialState (state) {
  var json = JSON.stringify(state)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
  return `<script>window.initialState = ${json}</script>`
}

function scriptTag (opts) {
  var hex = opts.hash.toString('hex').slice(0, 16)
  var base64 = 'sha512-' + opts.hash.toString('base64')
  var link = `${opts.base || ''}/${hex}/bundle.js`
  return `<script src="${link}" defer integrity="${base64}"></script>`
}

function dynamicScriptsTag (opts) {
  return opts.bundleNames.map(function (name) {
    name = name.replace(/\.js$/, '')
    var hash = opts.scripts[name].hash
    var hex = hash.toString('hex').slice(0, 16)
    var base64 = 'sha512-' + hash.toString('base64')
    var link = `${opts.base || ''}/${hex}/${name}.js`
    return `<link rel="prefetch" href="${link}" integrity="${base64}">`
  }).join('')
}

// NOTE: in theory we should be able to add integrity checks to stylesheets too,
// but in practice it turns out that it conflicts with preloading. So it's best
// to disable it for now. See:
// https://twitter.com/yoshuawuyts/status/920794607314759681
function styleTag (opts) {
  var hex = opts.hash.toString('hex').slice(0, 16)
  var link = `${opts.base || ''}/${hex}/bundle.css`
  return `
    <link rel="preload" as="style" href="${link}" onload="this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="${link}"></noscript>
  `.replace(/\n +/g, '')
}

function loadFontsTag (opts) {
  return opts.fonts.reduce(function (html, font) {
    if (!path.isAbsolute(font)) font = (opts.base || '') + '/' + font
    return html + `<link rel="preload" as="font" crossorigin href="${font}">`
  }, '')
}

function manifestTag (opts) {
  return `
    <link rel="manifest" href="${opts.base || ''}/manifest.json">
  `.replace(/\n +/g, '')
}

function faviconsTag (opts) {
  var favicon = opts.favicon.toString()
  if (favicon.length > 0) {
    return `<link rel="icon" type="image/x-icon" href="${favicon}">`
  }
  return ``
}

function viewportTag () {
  return `
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  `.replace(/\n +/g, '')
}

function descriptionTag (opts) {
  return `
    <meta name="description" content="${opts.description}">
  `.replace(/\n +/g, '')
}

function themeColorTag (opts) {
  return `
    <meta name="theme-color" content="${opts.color}">
  `.replace(/\n +/g, '')
}

function titleTag (opts) {
  return `
    <title>${opts.title}</title>
  `.replace(/\n +/g, '')
}

function criticalTransform (opts) {
  return critical(String(opts.css))
}

function reloadTag (opts) {
  var bundle = opts.bundle
  var base64 = sha512(bundle)
  return `<script integrity="${base64}">${bundle}</script>`
}

function addToHead (str) {
  return hyperstream({
    head: {
      _appendHtml: str
    }
  })
}

function insertApp (opts) {
  return hyperstream({
    [opts.selector]: {
      _replaceHtml: opts.body
    }
  })
}

// Specific to the document node's layout
function extractFonts (state) {
  var list = String(state.list.buffer).split(',')

  var res = list.filter(function (font) {
    var extname = path.extname(font)

    return extname === '.woff' ||
      extname === '.woff2' ||
      extname === '.eot' ||
      extname === '.ttf'
  })

  return res
}

function sha512 (buf) {
  return 'sha512-' + crypto.createHash('sha512')
    .update(buf)
    .digest('base64')
}
