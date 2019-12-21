#! /usr/bin/env node

process.title = 'bankai'

require('v8-compile-cache')

var ansi = require('ansi-escape-sequences')
var minimist = require('minimist')
var path = require('path')

var USAGE = `
  $ ${clr('bankai', 'bold')} ${clr('<command> [entry]', 'green')} [options]

  Commands:

    build       compile all files to ${clr('dist/', 'green')}
    inspect     inspect the bundle dependencies
    start       start a development server

  Options:

    -d, --debug       start node debugger
    -h, --help        print usage
    -q, --quiet       don't output any logs
    -v, --version     print version

  Examples:

    Start a development server
    ${clr('$ bankai start index.js', 'cyan')}

    Visualize all dependencies in your project
    ${clr('$ bankai inspect index.js', 'cyan')}

    Compile all files in the project to disk
    ${clr('$ bankai build index.js', 'cyan')}

  For configuration usage, type 'bankai --help config'

  Running into trouble? Feel free to file an issue:
  ${clr('https://github.com/choojs/bankai/issues/new', 'cyan')}

  Do you enjoy using this software? Become a backer:
  ${clr('https://opencollective.com/choo', 'cyan')}
`.replace(/\n$/, '').replace(/^\n/, '')

var NOCOMMAND = `
  Please specify a bankai command:
    ${clr('$ bankai', 'cyan')} ${clr('<command>', 'green')}

  For example:
    ${clr('$ bankai start', 'cyan')} ${clr('index.js', 'green')}

  Run ${clr('bankai --help', 'cyan')} to see all options.
`.replace(/\n$/, '').replace(/^\n/, '')

var CONFIG_USAGE = `

  ${clr('Configuration', 'bold')}


  Bankai is built on top of compilers for scripts, styles and documents.
  Each of them can be configured by adding a field to your project's
  package.json file.

  These three fields are, respectively: ${clr('"browserify"', 'cyan')}, ${clr('"sheetify"', 'cyan')} and
  ${clr('"documentify"', 'cyan')}. Each one should have a configuration object as it's value.

  There is currently one possible configuration field: "transform".

  It can be one of either:

  1. An array of transform names.
       ie:  ${clr('[ "vueify" ]', 'cyan')}
  2. An array of tuples transform name + configuration object.
       ie: ${clr('[[ "vueify", { "sass": { "includePaths": [ "src/assets/css" ] } } ]]', 'cyan')}


  Full example:

  ${clr(`{
    "browserify": {
      "transform": [
        [ "vueify", { "sass": { "includePaths": [ "src/assets/css" ] } } ]
      ]
    },
    "sheetify": {
      "transform": [
        "sheetify-cssnext"
      ]
    },
    "documentify": {
      "transform": [
        [ "posthtmlify", { "use": [ "posthtml-custom-elements" ] } ]
      ]
    }
  }`, 'cyan')}
`.replace(/\n$/, '').replace(/^\n/, '')

var argv = minimist(process.argv.slice(2), {
  alias: {
    help: 'h',
    quiet: 'q',
    version: 'v',
    base: 'b',
    debug: 'd'
  },
  boolean: [
    'help',
    'quiet',
    'version'
  ]
})

;(function main (argv) {
  var cmd = argv._[0]
  var entry = argv._[1]

  if (entry) {
    if (!path.isAbsolute(entry)) entry = path.join(process.cwd(), entry)
  } else {
    entry = process.cwd()
  }

  if (argv.debug) {
    if (typeof argv.debug === 'number') process.debugPort = argv.debug
    process.kill(process.pid, 'SIGUSR1')
  }

  if (argv.help) {
    if (cmd === 'config') return console.log(CONFIG_USAGE)
    console.log(USAGE)
  } else if (argv.version) {
    console.log(require('./package.json').version)
  } else if (cmd === 'build') {
    var outdir = argv._[2]
    require('./lib/cmd-build')(path.join(entry), outdir, argv)
  } else if (cmd === 'inspect') {
    require('./lib/cmd-inspect')(path.join(entry), argv)
  } else if (cmd === 'start') {
    require('./lib/cmd-start')(path.join(entry), argv)
  } else {
    console.log(NOCOMMAND)
    process.exit(1)
  }
})(argv)

function clr (text, color) {
  return process.stdout.isTTY ? ansi.format(text, color) : text
}
