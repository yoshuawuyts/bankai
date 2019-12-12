var assertHtml = require('assert-html')
var dedent = require('dedent')
var mkdirp = require('mkdirp')
var path = require('path')
var tape = require('tape')
var tmp = require('tmp')
var fs = require('fs')

var bankai = require('../')

tape('renders some HTML', function (assert) {
  var expected = `
    <!DOCTYPE html>
    <html lang="en-US" dir="ltr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="/__SCRIPTS_HASH__/bundle.js" integrity="sha512-__SCRIPTS_INTEGRITY__" defer></script>
        <script>;(function(a){"use strict";var b=function(b,c,d){function e(a){return h.body?a():void setTimeout(function(){e(a)})}function f(){i.addEventListener&&i.removeEventListener("load",f),i.media=d||"all"}var g,h=a.document,i=h.createElement("link");if(c)g=c;else{var j=(h.body||h.getElementsByTagName("head")[0]).childNodes;g=j[j.length-1]}var k=h.styleSheets;i.rel="stylesheet",i.href=b,i.media="only x",e(function(){g.parentNode.insertBefore(i,c?g:g.nextSibling)});var l=function(a){for(var b=i.href,c=k.length;c--;)if(k[c].href===b)return a();setTimeout(function(){l(a)})};return i.addEventListener&&i.addEventListener("load",f),i.onloadcssdefined=l,l(f),i};"undefined"!=typeof exports?exports.loadCSS=b:a.loadCSS=b})("undefined"!=typeof global?global:this);;(function(a){if(a.loadCSS){var b=loadCSS.relpreload={};if(b.support=function(){try{return a.document.createElement("link").relList.supports("preload")}catch(b){return!1}},b.poly=function(){for(var b=a.document.getElementsByTagName("link"),c=0;c<b.length;c++){var d=b[c];"preload"===d.rel&&"style"===d.getAttribute("as")&&(a.loadCSS(d.href,d,d.getAttribute("media")),d.rel=null)}},!b.support()){b.poly();var c=a.setInterval(b.poly,300);a.addEventListener&&a.addEventListener("load",function(){b.poly(),a.clearInterval(c)}),a.attachEvent&&a.attachEvent("onload",function(){a.clearInterval(c)})}}})(this);</script>
        <link rel="manifest" href="/manifest.json">
        <meta name="description" content=>
        <meta name="theme-color" content=#fff>
        <title></title>
        <link rel="preload" as="style" href="/__STYLE_HASH__/bundle.css" onload="this.rel='stylesheet'">
        <noscript><link rel="stylesheet" href="/__STYLE_HASH__/bundle.css"></noscript>
      </head>
      <body></body>
    </html>
  `.replace(/\n +/g, '')

  var script = dedent`
    1 + 1
  `

  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)
  var tmpScriptname = path.join(tmpDir.name, 'index.js')

  mkdirp.sync(tmpDir.name)
  fs.writeFileSync(tmpScriptname, script)

  var compiler = bankai(tmpScriptname, { watch: false })
  compiler.documents('/', function (err, res) {
    assert.error(err, 'no error writing document')
    assertHtml(assert, String(res.buffer), expected)
  })

  compiler.on('change', function (nodeName, second) {
    if (nodeName !== 'documents' || second !== 'list') return
    assert.end()
  })

  compiler.on('error', function () {
    // assert.error(err, 'no error')
  })

  compiler.scripts('bundle.js', function (err, res) {
    assert.ifError(err, 'no err bundling scripts')
    expected = expected.replace('__SCRIPTS_HASH__', res.hash.toString('hex').slice(0, 16))
    expected = expected.replace('__SCRIPTS_INTEGRITY__', res.hash.toString('base64'))

    compiler.styles('bundle.css', function (err, res) {
      assert.ifError(err, 'no err bundling style')
      expected = expected.replace(/__STYLE_HASH__/g, res.hash.toString('hex').slice(0, 16))
      expected = expected.replace('__STYLE_INTEGRITY__', res.hash.toString('base64'))
    })
  })
})

tape('server render choo apps', function (assert) {
  var expected = `
    <!DOCTYPE html>
    <html lang="en-US" dir="ltr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script>window.initialState = {}</script>
        <script src="/__SCRIPTS_HASH__/bundle.js" integrity="sha512-__SCRIPTS_INTEGRITY__" defer></script>
        <script>;(function(a){"use strict";var b=function(b,c,d){function e(a){return h.body?a():void setTimeout(function(){e(a)})}function f(){i.addEventListener&&i.removeEventListener("load",f),i.media=d||"all"}var g,h=a.document,i=h.createElement("link");if(c)g=c;else{var j=(h.body||h.getElementsByTagName("head")[0]).childNodes;g=j[j.length-1]}var k=h.styleSheets;i.rel="stylesheet",i.href=b,i.media="only x",e(function(){g.parentNode.insertBefore(i,c?g:g.nextSibling)});var l=function(a){for(var b=i.href,c=k.length;c--;)if(k[c].href===b)return a();setTimeout(function(){l(a)})};return i.addEventListener&&i.addEventListener("load",f),i.onloadcssdefined=l,l(f),i};"undefined"!=typeof exports?exports.loadCSS=b:a.loadCSS=b})("undefined"!=typeof global?global:this);;(function(a){if(a.loadCSS){var b=loadCSS.relpreload={};if(b.support=function(){try{return a.document.createElement("link").relList.supports("preload")}catch(b){return!1}},b.poly=function(){for(var b=a.document.getElementsByTagName("link"),c=0;c<b.length;c++){var d=b[c];"preload"===d.rel&&"style"===d.getAttribute("as")&&(a.loadCSS(d.href,d,d.getAttribute("media")),d.rel=null)}},!b.support()){b.poly();var c=a.setInterval(b.poly,300);a.addEventListener&&a.addEventListener("load",function(){b.poly(),a.clearInterval(c)}),a.attachEvent&&a.attachEvent("onload",function(){a.clearInterval(c)})}}})(this);</script>
        <link rel="preload" as="font" crossorigin href="/assets/font.woff">
        <link rel="manifest" href="/manifest.json">
        <meta name="description" content=>
        <meta name="theme-color" content=#fff>
        <title></title>
        <link rel="preload" as="style" href="/__STYLE_HASH__/bundle.css" onload="this.rel='stylesheet'">
        <noscript><link rel="stylesheet" href="/__STYLE_HASH__/bundle.css"></noscript>
      </head>
      <body>
        meow
      </body>
    </html>
  `.replace(/\n +/g, '')

  var script = dedent`
    var html = require('choo/html')
    var choo = require('choo')

    var app = choo()
    app.route('/', function () {
      return html\`<body>meow</body>\`
    })
    if (module.parent) module.exports = app
    else app.mount('body')
  `

  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)
  var tmpScriptname = path.join(tmpDir.name, 'index.js')
  var assetDirname = path.join(tmpDir.name, 'assets')
  var fontFilename = path.join(assetDirname, 'font.woff')

  mkdirp.sync(assetDirname)

  fs.writeFileSync(tmpScriptname, script)
  fs.writeFileSync(fontFilename, 'binary font data')

  var compiler = bankai(tmpScriptname, { watch: false })
  compiler.documents('/', function (err, res) {
    assert.error(err, 'no error writing document')
    assertHtml(assert, String(res.buffer), expected)
  })

  compiler.on('change', function (nodeName, second) {
    if (nodeName !== 'documents' || second !== 'list') return
    assert.end()
  })

  compiler.on('error', function () {
    // assert.error(err, 'no error')
  })

  compiler.scripts('bundle.js', function (err, res) {
    assert.ifError(err, 'no err bundling scripts')
    expected = expected.replace('__SCRIPTS_HASH__', res.hash.toString('hex').slice(0, 16))
    expected = expected.replace('__SCRIPTS_INTEGRITY__', res.hash.toString('base64'))
    compiler.styles('bundle.css', function (err, res) {
      assert.ifError(err, 'no err bundling style')
      assert.ifError(err)
      expected = expected.replace(/__STYLE_HASH__/g, res.hash.toString('hex').slice(0, 16))
      expected = expected.replace('__STYLE_INTEGRITY__', res.hash.toString('base64'))
    })
  })
})

tape('server render choo apps with root set', function (assert) {
  var expected = `
    <!DOCTYPE html>
    <html lang="en-US" dir="ltr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script>window.initialState = {}</script>
        <script src="some-custom-root/__SCRIPTS_HASH__/bundle.js" integrity="sha512-__SCRIPTS_INTEGRITY__" defer></script>
        <script>;(function(a){"use strict";var b=function(b,c,d){function e(a){return h.body?a():void setTimeout(function(){e(a)})}function f(){i.addEventListener&&i.removeEventListener("load",f),i.media=d||"all"}var g,h=a.document,i=h.createElement("link");if(c)g=c;else{var j=(h.body||h.getElementsByTagName("head")[0]).childNodes;g=j[j.length-1]}var k=h.styleSheets;i.rel="stylesheet",i.href=b,i.media="only x",e(function(){g.parentNode.insertBefore(i,c?g:g.nextSibling)});var l=function(a){for(var b=i.href,c=k.length;c--;)if(k[c].href===b)return a();setTimeout(function(){l(a)})};return i.addEventListener&&i.addEventListener("load",f),i.onloadcssdefined=l,l(f),i};"undefined"!=typeof exports?exports.loadCSS=b:a.loadCSS=b})("undefined"!=typeof global?global:this);;(function(a){if(a.loadCSS){var b=loadCSS.relpreload={};if(b.support=function(){try{return a.document.createElement("link").relList.supports("preload")}catch(b){return!1}},b.poly=function(){for(var b=a.document.getElementsByTagName("link"),c=0;c<b.length;c++){var d=b[c];"preload"===d.rel&&"style"===d.getAttribute("as")&&(a.loadCSS(d.href,d,d.getAttribute("media")),d.rel=null)}},!b.support()){b.poly();var c=a.setInterval(b.poly,300);a.addEventListener&&a.addEventListener("load",function(){b.poly(),a.clearInterval(c)}),a.attachEvent&&a.attachEvent("onload",function(){a.clearInterval(c)})}}})(this);</script>
        <link rel="preload" as="font" crossorigin href="some-custom-root/assets/font.woff">
        <link rel="manifest" href="some-custom-root/manifest.json">
        <meta name="description" content=>
        <meta name="theme-color" content=#fff>
        <title></title>
        <link rel="preload" as="style" href="some-custom-root/__STYLE_HASH__/bundle.css" onload="this.rel='stylesheet'">
        <noscript><link rel="stylesheet" href="some-custom-root/__STYLE_HASH__/bundle.css"></noscript>
      </head>
      <body>
        meow
      </body>
    </html>
  `.replace(/\n +/g, '')

  var script = dedent`
    var html = require('choo/html')
    var choo = require('choo')

    var app = choo()
    app.route('/', function () {
      return html\`<body>meow</body>\`
    })
    if (module.parent) module.exports = app
    else app.mount('body')
  `

  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)
  var tmpScriptname = path.join(tmpDir.name, 'index.js')
  var assetDirname = path.join(tmpDir.name, 'assets')
  var fontFilename = path.join(assetDirname, 'font.woff')

  mkdirp.sync(assetDirname)

  fs.writeFileSync(tmpScriptname, script)
  fs.writeFileSync(fontFilename, 'binary font data')

  var compiler = bankai(tmpScriptname, { watch: false, base: 'some-custom-root' })
  compiler.documents('/', function (err, res) {
    assert.error(err, 'no error writing document')
    assertHtml(assert, String(res.buffer), expected)
  })

  compiler.on('change', function (nodeName, second) {
    if (nodeName !== 'documents' || second !== 'list') return
    assert.end()
  })

  compiler.on('error', function () {
    // assert.error(err, 'no error')
  })

  compiler.scripts('bundle.js', function (err, res) {
    assert.ifError(err, 'no err bundling scripts')
    expected = expected.replace('__SCRIPTS_HASH__', res.hash.toString('hex').slice(0, 16))
    expected = expected.replace('__SCRIPTS_INTEGRITY__', res.hash.toString('base64'))
    compiler.styles('bundle.css', function (err, res) {
      assert.ifError(err, 'no err bundling style')
      assert.ifError(err)
      expected = expected.replace(/__STYLE_HASH__/g, res.hash.toString('hex').slice(0, 16))
      expected = expected.replace('__STYLE_INTEGRITY__', res.hash.toString('base64'))
    })
  })
})

tape('custom index.html template', function (assert) {
  assert.plan(3)

  var template = `
    <html>
    <head>
      <meta name="test" content="ok">
    </head>
    <body>
    </body>
    </html>
  `
  var file = `
    var html = require('choo/html')
    var choo = require('choo')

    var app = choo()
    app.route('/', function () {
      return html\`<body>meow</body>\`
    })
    module.exports = app.mount('body')
  `

  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)
  fs.writeFileSync(path.join(tmpDir.name, 'index.js'), file)
  fs.writeFileSync(path.join(tmpDir.name, 'index.html'), template)

  var compiler = bankai(tmpDir.name, { watch: false })
  compiler.documents('/', function (err, res) {
    assert.error(err, 'no error writing document')
    var body = res.buffer.toString('utf8')
    assert.notEqual(body.indexOf('<meta name="test" content="ok">'), -1, 'used the custom index.html')
    assert.notEqual(body.indexOf('meow'), -1, 'inserted the rendered app')
  })
})

tape('mount choo app into given selector', function (assert) {
  assert.plan(3)

  var template = `
    <html>
    <head></head>
    <body>
      <h1>Some Title!</h1>
      <div id="app"></div>
    </body>
    </html>
  `
  var file = `
    var html = require('choo/html')
    var choo = require('choo')

    var app = choo()
    app.route('/', function () {
      return html\`<div>meow</div>\`
    })
    module.exports = app.mount('#app')
  `

  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)
  fs.writeFileSync(path.join(tmpDir.name, 'index.js'), file)
  fs.writeFileSync(path.join(tmpDir.name, 'index.html'), template)

  var compiler = bankai(tmpDir.name, { watch: false })
  compiler.documents('/', function (err, res) {
    assert.error(err, 'no error writing document')
    var body = res.buffer.toString('utf8')
    assert.notEqual(body.indexOf('<h1>Some Title!</h1>'), -1, 'preserved body contents outside #app selector')
    assert.notEqual(body.indexOf('meow'), -1, 'inserted the rendered app')
  })
})

tape('inlines critical css', function (assert) {
  assert.plan(3)

  var file = `
    var css = require('sheetify')
    var html = require('choo/html')
    var choo = require('choo')

    css\`
      .classA { color: red }
      .classB { color: blue }
    \`

    var app = choo()
    app.route('/', function () {
      return html\`<body class="classA"></body>\`
    })

    // classB

    module.exports = app.mount('body')
  `

  var tmpDir = tmp.dirSync({ dir: path.join(__dirname, '../tmp'), unsafeCleanup: true })
  assert.on('end', tmpDir.removeCallback)
  fs.writeFileSync(path.join(tmpDir.name, 'index.js'), file)

  var compiler = bankai(tmpDir.name, { watch: false })
  compiler.documents('/', function (err, res) {
    assert.error(err, 'no error writing document')
    var body = res.buffer.toString('utf8')
    assert.notEqual(body.indexOf('.classA{color:red;}'), -1, 'inlined the .classA selector')
    assert.equal(body.indexOf('.classB{color:blue;}'), -1, 'did not inline the .classB selector')
  })
})
