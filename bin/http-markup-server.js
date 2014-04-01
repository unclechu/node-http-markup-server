#!/usr/bin/env node
/*!
 * HTTP server for markup
 *
 * Author: Viacheslav Lotsmanov
 * License: GNU/GPLv3 by Free Software Foundation
 * https://github.com/unclechu/node-http-markup-server/blob/master/LICENSE
 */

var express = require('express');
var ejs = require('ejs');

var path = require('path');
var spawn = require('child_process').spawn;
var fs = require('fs');
var url = require('url');

var config = JSON.parse( fs.readFileSync('http-markup-server.config.json') );

var port = config.port;
var host = config.host;
var openInBrowser = config.browse;

var app = express();

process.argv.slice(2).forEach(function (arg) {

    if (/^--port=/.test(arg)) {

        port = arg.substr('--port='.length);

    } else if (/^--host=/.test(arg)) {

        host = arg.substr('--host='.length);

    } else if (/^--browse=/.test(arg)) {

        openInBrowser = arg.substr('--browse='.length).toLowerCase();

        if (openInBrowser == 'yes' || openInBrowser == 'y' || openInBrowser == '1') {

            openInBrowser = true;

        } else if (openInBrowser == 'no' || openInBrowser == 'n' || openInBrowser == '0') {

            openInBrowser = false;

        }

    } else {

        throw new Error('Unknown argument "'+ arg +'"');

    }

});

app.configure(function () {

    config.static.forEach(function (val) {

        app.use('/' + val, express.static(val));

        if (config.favicon && config.favicon === 'string') {

            app.use(express.favicon( config.favicon ));

        } else if (config.favicon) {

            app.use(express.favicon('favicon.ico'));

        }

    });

});

app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.set('views', './');
app.set('view options', { layout: false });

app.get('*', function (req, res) {

    var fullUrl = url.resolve('http://' + req.headers.host, req.url);
    var location = url.parse(fullUrl);
    var pathname = location.pathname;

    var tpl;
    var dir = false;
    var indexFiles = Array.prototype.slice.call(config.index_files, 0);
    var curTplFilename;

    if (pathname.substr(-1) === '/') {

        curTplFilename = indexFiles.shift();
        tpl = path.join(pathname, curTplFilename);
        if (tpl.charAt(0) === '/') tpl = tpl.substr(1);
        dir = true;

    } else {

        if (path.extname(pathname) === '') {

            res.send('403 Forbidden', 403);
            if (config.security_log) console.warn('Hacking attempt!', req);
            return;

        } else {

            var found = false;

            config.allowable_extensions.forEach(function (ext) {

                if (path.extname(pathname) === ext) {

                    found = true;
                    curTplFilename = path.basename(pathname);
                    tpl = path.join(pathname);
                    if (tpl.charAt(0) === '/') tpl = tpl.substr(1);

                }

            });

            if (!found) {

                res.send('403 Forbidden', 403);
                if (config.security_log) console.warn('Hacking attempt!', req);
                return;

            }

        }

    }

    function tryRender() {

        app.render(tpl, {

            location: location,

            curNavPos: function curNavPos(withIndexPage) {

                if (withIndexPage === undefined) withIndexPage = true;
                withIndexPage = withIndexPage ? true : false;

                var filename = curTplFilename;
                var res = pathname;

                if (res.substr(-filename.length) === filename) {

                    res = res.slice(0, -filename.length);

                }

                return res;

            },

        }, function (err, html) {

            if (err) {
                if (err.toString().search(/failed to lookup view/i) !== -1) {

                    if (dir && indexFiles.length > 0) {

                        curTplFilename = indexFiles.shift();
                        tpl = path.join(pathname, curTplFilename);
                        if (tpl.charAt(0) === '/') tpl = tpl.substr(1);
                        process.nextTick( tryRender );
                        return;

                    } else {

                        res.send('404 Not Found', 404);
                        if (config.security_log) console.warn('404 status.', req);
                        return;

                    }

                } else {

                    res.send('500 Internal Server Error\n' + err.toString(), 500);
                    console.error(err);
                    return;

                }
            }

            res.send(html);

        });

    } tryRender();

});

app.listen(port, host, function () {

    var URL = 'http://';

    if (host) {

        console.log('Listening on %s:%d', host, port);
        URL += host;

    } else {

        console.log('Listening on *:%d', port);
        URL += '127.0.0.1';

    }

    if (port !== 80) URL += ':' + port;
    if (openInBrowser) {

        spawn('xdg-opens', [URL], { stdio: 'ignore' })
            .on('error', function (err) {
                console.log('Open link in browser error:', err.toString());
            });

    }

});

// vim: set ts=4 sw=4 et :
