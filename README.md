# bankai
[![npm version][2]][3] [![build status][4]][5]
[![downloads][8]][9] [![js-standard-style][10]][11]

The easiest way to compile JavaScript, HTML and CSS.

We want people to have fun building things for the web. There should be no
hurdles between a great idea, and your first prototype. And once you're ready,
it should be easy to package it up and share it online. That's Bankai: a tool
that helps you build for the web. No configuration, and no hassle - that's our
promise.

If this is your first time building something for the web, take a look at
[choojs/create-choo-app](https://github.com/choojs/create-choo-app) to help get
a project setup from scratch :sparkles:.

## Usage
```txt
  $ bankai <command> [entry] [options]

  Commands:

    build       compile all files to dist/
    inspect     inspect the bundle dependencies
    start       start a development server

  Options:

    -b, --base        prepend a base URL to assets
    -d, --debug       output lots of logs
    -h, --help        print usage
    -q, --quiet       don't output any logs
    -v, --version     print version

  Examples:

    Start a development server
    $ bankai start index.js

    Visualize all dependencies in your project
    $ bankai inspect index.js

    Compile all files in the project to disk
    $ bankai build index.js

    Compile and change the default output directory to docs/
    $ bankai build index.js docs

  Running into trouble? Feel free to file an issue:
  https://github.com/choojs/bankai/issues/new

  Do you enjoy using this software? Become a backer:
  https://opencollective.com/choo
```

## ⚠️  HTTPS Instructions
When you first open up your application in a browser, you'll probably see a
warning page about HTTPS connections being untrusted. No worries, this is
entirely expected behavior. Follow the instructions below to solve this for
your browser.

<details>
  <summary>
    <b>How does this work?</b>
  </summary>
  For HTTPS to run on <code>localhost</code>, we must sign a TLS certificate
  locally. This is better known as a "self-signed certificate". Browsers
  actively check for certificates from uknown providers, and warn you (for good
  reason!) In our case, however, it's safe to ignore.

  HTTPS is needed for an increasing amount of APIs to work in the browser. For
  example if you want to test HTTP/2 connections or use parts of the storage
  API, you have no choice but to use an HTTPS connection on localhost. That's
  why we try and make this work as efficiently, and securely as possible.

  We generate a unique certificate for each Bankai installation. This means
  that you'll only need to trust an HTTPS certificate for Bankai once. This
  should be secure from remote attackers, because unless they have successfully
  acquired access to your machine's filesystem, they won't be able to replicate
  the certificate.
</details>

<details>
  <summary>
    <b>Firefox Instructions</b>
  </summary>
  <h3>Step 1</h3>

  A wild security screen appears!. Click on "advanced".
  <img src="/assets/firefox01.png" alt="firefox01">

  <h3>Step 2</h3>
  More details emerge! Click on "Add Exception".
  <img src="/assets/firefox02.png" alt="firefox02">

  <h3>Step 3</h3>
  In the dropdown click "Confirm Security Exception".
  <img src="/assets/firefox03.png" alt="firefox03">

  <h3>Step 4</h3>
  Success!
  <img src="/assets/firefox04.png" alt="firefox04">
</details>

<details>
  <summary>
    <b>Chrome Instructions</b>
  </summary>
  Click the "more details" dropdown, then click "proceed". Pull Request for
  screenshots welcome!
</details>

<details>
  <summary>
    <b>Safari Instructions</b>
  </summary>
  <h3>Step 1</h3>
  A wild security screen appears! Click "Show Certificate".
  <img src="/assets/safari01.png" alt="safari01">

  <h3>Step 2</h3>
  More details emerge! Check "Always trust 'localhost'…".
  <img src="/assets/safari02.png" alt="safari02">

  <h3>Step 3</h3>
  The box is checked! Click "Continue".
  <img src="/assets/safari03.png" alt="safari03">

  <h3>Step 4</h3>
  A box is asking you for your crendentials. Fill them in, and hit "Enter".

  <h3>Step 5</h3>
  Success!
  <img src="/assets/safari04.png" alt="safari04">
</details>

## Optimizations
Bankai applies lots of optimizations to projects. Generally you won't need to
care how we do this: it's lots of glue code, and not necessarily pretty. But it
can be useful to know which optimizations we apply. This is a list:

### JavaScript
- __[nanohtml][]:__ Optimize `choo` HTML code so it runs significantly faster in the
  browser.
- __[glslify][]:__ Adds a module system to GLSL shaders.
- __[brfs][]:__ Statically inline calls to `fs.readFile()`. Useful to ship assets
  in the browser.
- __[envify][]:__ Allow environment variables to be used in the bundle. Especially
  useful in combination with minification, which removes unused code paths.
- __[split-require][]:__ Lazy load parts of your application using the
  [`require('split-require')`][split-require] function.
- __[babelify][]:__ Bring the latest browser features to _all_ browsers. See
  [our babel section](#babel) for more details.

And bankai uses [tinyify][], which adds the following optimizations:

- __[browser-pack-flat][]:__ Remove function wrappers from the bundle, making
  the result faster to run and easier to minify.
- __[bundle-collapser][]:__ Remove all pathnames from inside the bundle, and
  replace them with IDs. This not only makes bundles smaller, it prevents
  details from your local dev setup leaking.
- __[common-shakeify][]:__ Remove unused JavaScript code from the bundle. Best
  known as _dead code elimination_ or _tree shaking_.
- __[unassertify][]:__ Remove all `require('assert')` statements from the code.
  Only applied for production builds.
- __[uglifyify][]:__ Minify the bundle.

### CSS
- __[sheetify][]:__ extract all inline CSS from JavaScript, and include it in
  `bundle.js`.
- __[purifyCSS][purify-css]:__ removes unused CSS from the project.
- __[cleanCSS][clean-css]:__ minify the bundle.

### HTML
- __[inline-critical-css][]:__ extract all crititical CSS for a page into the
  `<head>` of the document. This means that every page will be able to render
  after the first roundtrip, which makes for super snappy pages.
- __async load scripts:__ loads scripts in the background using the
  [`defer`](https://devdocs.io/html/attributes#defer-attribute) attribute.
- __async load styles:__ loads styles in the background using the
  [`preload`](https://devdocs.io/html/attributes#preload-attribute) attribute.
- __async load styles:__ preloads fonts in the background using the
  [`preload`](https://devdocs.io/html/attributes#preload-attribute) attribute.
- __server render:__ server renders Choo applications. We're welcome to
  supporting other frameworks too. PRs welcome!
- __manifest:__ includes a link to `manifest.json` so the application can be
  installed on mobile.
- __viewport:__ defines the right viewport dimensions to make applications
  accessible for everyone.
- __theme color:__ sets the theme color defined in `manifest.json` so the
  navigator bar on mobile is styled on brand.
- __title:__ sets the right title on a page. Either extracts it from the
  application (choo only, for now) or uses whatever the title is in
  `manifest.json`.
- __live reload:__ during development, we inject a live reload script.

## Configuration
The Bankai CLI doesn't take any flags, other than to manipulate how we log to
the console. Configuring Bankai is done by modifying `package.json`.

Bankai is built on three technologies: [`browserify`][browserify],
[`sheetify`][sheetify], and [`documentify`][documentify]. Because these can be
configured inside `package.json` it means that Bankai itself can be configured
from there too. Also if people ever decide to switch from the command line to
JavaScript, no extra configuration is needed.

```json
{
  "name": "my-app",
  "browserify": {
     "transform": [
       "some-browserify-transform"
     ]
   },
   "sheetify": {
     "transform": [
       "some-sheetify-transform"
     ]
   },
   "documentify": {
     "transform": [
       "some-documentify-transform"
     ]
   }
}
```


### Custom HTML
By default, Bankai starts with an empty HTML document, injecting the tags
mentioned [above](#html). You can also create a custom template as `index.html`,
and Bankai will inject tags into it instead.

If you export your Choo app instance after doing `.mount()`, Bankai respects the
mount location during server side rendering:

```js
// app.js
...
module.exports = app.mount('#app')
```

```html
<!-- index.html -->
...
<body>
  <div id="app"></div>
  <div id="footer">© 2018</div>
</body>
...
```

### Injecting headers - favicon.ico, CDNs, manifests etc...

You might be looking to use some of the fantastic third party libraries or tools out there. Take the [font-awesome](https://fontawesome.com/) library for example, but there are plenty of others. To do so, you typically need to include additional css or js libraries in your ```<head>```. And you can do this by setting up your documentify transform.

In this example, you will need to add a "documentify" transform which specifies a js file used, but you will also need a couple of extra npm libraries which you can install with:

```bash
npm i hstream dedent
```

Now in ```package.json```, add the following transform:

```json
"documentify": {
    "transform": [
      [
        "./lib/document.js",
        {
          "order": "end"
        }
      ]
    ]
  },
```

In this example, we are storing the transform in a folder called ```lib```, which you will need to create, and create a ```document.js``` file in it. Edit the file called ```document.js``` and put the following transform code in it:

```js
var dedent = require('dedent')
var hyperstream = require('hstream')

module.exports = document

function document () {
  return hyperstream({
    'meta[name="viewport"]': {
      content: 'width=device-width, initial-scale=1, viewport-fit=cover'
    },
    head: {
      _prependHtml: dedent`
      <link rel="manifest" href="manifest.json">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
      `,
      _appendHtml: dedent`
        <link rel="shortcut icon" href="/favicon.ico">
      `
    }
  })
}
```

This example now enables Bankai to generate an ```index.html``` file which has a link to the font-awesome css cdn, a ```manifest.json``` file, and a ```favicon.ico``` file ready for deployment.

### Service Workers
Bankai comes with support for service workers. You can place a service worker
entry point in a file called `sw.js` or `service-worker.js`. Bankai will output
a browserify bundle by the same name.

You can easily register service workers using
[choo-service-worker](https://github.com/choojs/choo-service-worker):
```js
app.use(require('choo-service-worker')())
```

choo-service-worker defaults to `/sw.js` for the service worker file name. If
you named your service worker `service-worker.js` instead, do:
```js
app.use(require('choo-service-worker')('/service-worker.js'))
```

Service workers have access to some environment variables:
 * __process.env.STYLE_LIST:__ An array of URLs to stylesheet files.
 * __process.env.SCRIPT_LIST:__ An array of URLs to script files.
 * __process.env.ASSET_LIST:__ An array of URLs to assets.
 * __process.env.DOCUMENT_LIST:__ An array of URLs to server-rendered routes.
 * __process.env.MANIFEST_LIST:__ An array containing the URL to the manifest
   file.
 * __process.env.FILE_LIST:__ An array of URLs to assets and routes. This can
   be used to add all your app's files to a service worker cache.

## HTTP
Bankai can be hooked up directly to an HTTP server, which is useful when
working on full stack code.
```js
var bankai = require('bankai/http')
var http = require('http')
var path = require('path')

var compiler = bankai(path.join(__dirname, 'client.js'))
var server = http.createServer(function (req, res) {
  compiler(req, res, function () {
    res.statusCode = 404
    res.end('not found')
  })
})

server.listen(8080, function () {
  console.log('listening on port 8080')
})
```

## Babel
Not all browsers support all of the Web Platform's features. So in order to use
newer features on older browsers, we have to find a solution. The best solution
out there at the moment is Babel.

[Babel](https://babeljs.io/) is a plugin-based JavaScript compiler. It takes
JavaScript in, and outputs JavaScript based for the platforms you've decided to
target. In Bankai we target the last 2 versions of FireFox, Chrome and Edge,
and every other browser that's used by more than 1% of people on earth. This
includes IE11. And if you have different opinions on which browsers to use,
Bankai respects `.babelrc` and [`.browserslistrc`](https://github.com/ai/browserslist) files.

Some newer JavaScript features require loading an extra library; `async/await`
being the clearest example. To enable such features, the `babel-polyfill`
library needs to be included in your application's root (e.g. `index.js`).

```js
require('babel-polyfill')
```

We don't include this file by default in Bankai, because it has a significant
size overhead. Once Babel includes only the language features you're using,
we'll work to include `babel-polyfill` by default.

## Events
### `compiler.on('error', callback(nodeName, edgeName, error))`
Whenever an internal error occurs.

### `compiler.on('change', callback(nodeName, edgeName, state))`
Whenever a change in the internal graph occurs.

## API
### `compiler = bankai(entry, [opts])`
Create a new bankai instance. Takes a path to a JavaScript file as the first
argument. The following options are available:

- __opts.quiet:__ Defaults to `false`. Don't output any data to `stdout`. Useful
  if you have your own logging system.
- __opts.watch:__ Defaults to `true`. Watch for changes in the source files and
  rebuild. Set to `false` to get optimized bundles.
- __babelifyDeps:__ Defaults to true. Transform dependencies with babelify.

### `compiler.documents(routename, [opts], done(err, { buffer, hash }))`
Output an HTML bundle for a route. Routes are determined based on the project's
router. Pass `'/'` to get the default route.

- __opts.state:__ Will be passed the render function for the route, and inlined
  in the `<head>` of the body as `window.initialState`.

### `compiler.scripts(filename, done(err, { buffer, hash }))`
Pass in a filename and output a JS bundle.

### `compiler.assets(assetName, done(err, { buffer, hash }))`
Output any other file besides JS, CSS or HTML.

### `compiler.styles(name, done(err, { buffer, hash }))`
Output a CSS bundle.

### `compiler.manifest(done(err, { buffer, hash }))`
Output a `manifest.json`.

### `compiler.serviceWorker(done(err, { buffer, hash }))`
Output a service worker.

### `compiler.close()`
Close all file watchers.

## License
Apache License 2.0

[babelify]: https://github.com/babel/babelify
[brfs]: https://github.com/browserify/brfs
[browser-pack-flat]: https://github.com/goto-bus-stop/browser-pack-flat
[browserify]: https://github.com/browserify/browserify
[bundle-collapser]: https://github.com/substack/bundle-collapser
[clean-css]: https://github.com/jakubpawlowicz/clean-css
[common-shakeify]: https://github.com/browserify/common-shakeify
[documentify]: https://github.com/stackhtml/documentify
[envify]: https://github.com/hughsk/envify
[glslify]: https://github.com/glslify/glslify
[inline-critical-css]: https://github.com/stackcss/inline-critical-css
[nanohtml]: https://github.com/choojs/nanohtml
[purify-css]: https://github.com/purifycss/purifycss
[sheetify]: https://github.com/stackcss/sheetify
[split-require]: https://github.com/goto-bus-stop/split-require
[tinyify]: https://github.com/browserify/tinyify
[uglifyify]: https://github.com/hughsk/uglifyify
[unassertify]: https://github.com/unassert-js/unassertify

[0]: https://img.shields.io/badge/stability-experimental-orange.svg?style=flat-square
[1]: https://nodejs.org/api/documentation.html#documentation_stability_index
[2]: https://img.shields.io/npm/v/bankai.svg?style=flat-square
[3]: https://npmjs.org/package/bankai
[4]: https://img.shields.io/travis/choojs/bankai/master.svg?style=flat-square
[5]: https://travis-ci.org/choojs/bankai
[6]: https://img.shields.io/codecov/c/github/choojs/bankai/master.svg?style=flat-square
[7]: https://codecov.io/github/choojs/bankai
[8]: http://img.shields.io/npm/dm/bankai.svg?style=flat-square
[9]: https://npmjs.org/package/bankai
[10]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[11]: https://github.com/feross/standard
