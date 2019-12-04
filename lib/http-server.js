var async = require('async-collection')
var mkdirp = require('mkdirp')
var http = require('http')
var path = require('path')
var pump = require('pump')
var net = require('net')
var fs = require('fs')
var os = require('os')

var selfsigned = require('selfsigned')
var getPort = require('get-port')

var CONFIG_DIR = path.join(os.homedir(), '.config/bankai')
var CERT_NAME = 'cert.pem'
var KEY_NAME = 'key.pem'
var CERT_LOCATION = path.join(CONFIG_DIR, CERT_NAME)
var KEY_LOCATION = path.join(CONFIG_DIR, KEY_NAME)

exports.createServer = createDevServer

function createDevServer (connectionHandler) {
  var httpPort, httpsPort
  var createSecureServer

  try {
    createSecureServer = require('http2').createSecureServer
  } catch (e) {
    createSecureServer = require('https').createServer
  }

  return {
    listen: listen
  }

  function listen (port, onlisten) {
    net.createServer(tcpConnection).listen(port, onNetListen)

    function onNetListen () {
      getPort({ port: 8080 }).then(function (port) {
        httpPort = port
        var httpServer = http.createServer(httpConnection)
          .listen(port, onHttpListen)

        httpServer.keepAliveTimeout = 0
        httpServer.timeout = 0
      })
        .catch(function (err) {
          throw err
        })
    }

    function onHttpListen () {
      createKeys(function (err, keys) {
        if (err) throw err
        var cert = keys.cert
        var key = keys.key

        getPort({ port: 4443 }).then(function (port) {
          httpsPort = port
          var serverOpts = { cert, key, allowHTTP1: true }
          var http2Server = createSecureServer(serverOpts, connectionHandler)
          http2Server.keepAliveTimeout = 0
          http2Server.timeout = 0
          http2Server.listen(httpsPort, function () {
            if (onlisten) onlisten()
          })
        })
          .catch(function (err) {
            throw err
          })
      })
    }
  }

  function tcpConnection (conn) {
    conn.once('data', function (buf) {
      // A TLS handshake record starts with byte 22.
      var address = buf[0] === 22 ? httpsPort : httpPort
      var proxy = net.createConnection(address, function () {
        proxy.write(buf)
        pump(conn, proxy, conn, function (err) {
          if (err) return false // TODO: log error to the logger part
        })
      })
    })
  }

  function httpConnection (req, res) {
    var host = req.headers['host']
    var location = 'https://' + host + req.url
    var agent = req.headers['user-agent']

    // We don't want to force an HTTPS connection if we are already
    // encrypted or we are being forwarded through a proxy that may be
    // taking care of it.
    var encrypted = req.headers['x-forwarded-proto'] || req.connection.encrypted

    // We want to force HTTPS connections, but using curl(1) or wget(1) from
    // the command line can be convenient to quickly check output.
    if (/^(curl|wget)/i.test(agent) || encrypted) {
      return connectionHandler(req, res)
    } else {
      res.writeHead(301, { location: location })
      res.end(`Redirecting to ${location}`)
    }
  }
}

// Read keys from ~/.config/bankai, or create new ones if they don't exist.
function createKeys (cb) {
  mkdirp(CONFIG_DIR, function (err) {
    if (err) return cb(err)

    fs.readdir(CONFIG_DIR, function (err, files) {
      if (err) return cb(err)
      var keys = {}

      // check if both files exist
      if (files.indexOf(KEY_NAME) !== -1 && files.indexOf(CERT_NAME) !== -1) {
        return async.parallel([
          function (done) {
            fs.readFile(CERT_LOCATION, function (err, buf) {
              if (err) return done(err)
              keys.cert = buf
              done()
            })
          },
          function (done) {
            fs.readFile(KEY_LOCATION, function (err, buf) {
              if (err) return done(err)
              keys.key = buf
              done()
            })
          }
        ], function (err) {
          if (err) return cb(err)
          cb(null, keys)
        })
      }

      var opts = {
        keySize: 2048,
        algorithm: 'sha256',
        extensions: [
          {
            name: 'subjectAltName',
            altNames: [
              {
                type: 2, // DNSName
                value: 'localhost'
              }
            ]
          }
        ]
      }

      selfsigned.generate([{ name: 'commonName', value: 'localhost' }], opts, function (err, keys) {
        if (err) return cb(err)

        keys = {
          key: keys.private,
          cert: keys.cert
        }

        async.parallel([
          function (done) {
            fs.writeFile(KEY_LOCATION, keys.key, done)
          },
          function (done) {
            fs.writeFile(CERT_LOCATION, keys.cert, done)
          }
        ], function (err) {
          if (err) return cb(err)
          cb(null, keys)
        })
      })
    })
  })
}
