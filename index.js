var _ = require('underscore'),
    colors = require('colors'),
    crypto = require('crypto'),
    request = require('request'),
    querystring = require('querystring');


function AndBangMiddleware() {
    var self = this;

    this.showHelp = function (message) {
        var output = [
            "\n",
            message.red,
            "_____________________________________________________________",
            "",
            "var express = require('express'),",
            "    auth = require('andbang-express-auth'),",
            "    app = express();",
            "",
            "",
            "app.use(express.cookieParser());",
            "app.use(express.session({ secret: 'keyboard cat' }));",
            "app.use(auth.middleware({",
            "    app: app",
            "    clientId: 'YOUR CLIENT ID',",
            "    clientSecret: 'YOUR CLIENT SECRET',",
            "    defaultRedirect: '/app'",
            "});",
            "",
            "",
            "// a route that requires being logged in with andbang",
            "app.get('/my-secured-route', auth.secure(), function (req, res) {",
            "    // req.user is everything we know about the andbang user",
            "    // req.token is now the auth token",
            "    res.send(req.user)",
            "});",
            "_____________________________________________________________",
            "",
            ""
        ].join('\n');
        console.log(output);
    };

    this.middleware = function (config) {
        var self = this;
        if (!config.app || !config.clientId || !config.clientSecret || !config.defaultRedirect) {
            this.showHelp('You have to pass the app, clientId and clientSecret and a default redirect. For example:');
        }
        
        // store our configs as properties
        _.extend(this, {
            loggedOutRedirect: '/',
            loginPageUrl: '/login',
            loginFailedRedirect: '/login-failed'
        }, config);

        // set our account and API urls
        this.accountsUrl = config.local ? 'http://localhost:3001' : 'https://accounts.andbang.com';
        this.apiUrl = config.local ? 'http://localhost:3000' : 'https://api.andbang.com';

        // The login route. If we already have a token in the session we'll
        // just continue through.
        this.app.get('/auth', function (req, res) {
            if (req.cookies.accessToken || req.session.token) {
                return res.redirect(self.defaultRedirect);
            }

            delete req.session.token;
            res.clearCookie('accessToken');
            req.session.oauthState = crypto.createHash('sha1').update(crypto.randomBytes(4098)).digest('hex')
            var url = self.accountsUrl + '/oauth/authorize?' + querystring.stringify({
                    response_type: 'code',
                    client_id: self.clientId,
                    state: req.session.oauthState
                });
            res.redirect(url);
        });

        this.app.get('/auth/andbang/callback', function (req, response) {
            var result = querystring.parse(req.url.split('?')[1]);

            if (result.error) {
                response.redirect('/auth/andbang/failed');
            }

            if (result.state != req.session.oauthState) {
                response.redirect('/auth/andbang/failed');
            }

            request.post({
                url: self.accountsUrl + '/oauth/access_token', 
                strictSSL: true,
                form: {
                    code: result.code,
                    grant_type: 'authorization_code',
                    client_id: self.clientId,
                    client_secret: self.clientSecret
                }
            }, function (err, res, body) {
                if (res && res.statusCode === 200) {
                    token = JSON.parse(body);
                    req.session.token = token;
                    req.session.token.grant_date = Date.now();
                    var nextUrl = req.session.nextUrl || self.defaultRedirect || '/';
                    delete req.session.nextUrl;
                    req.session.save(function () {
                        response.cookie('accessToken', token.access_token, {
                            maxAge: 86400000,
                            secure: req.secure || req.host != 'localhost'
                        });
                        return self.userRequired(req, response, function () {
                            response.redirect(nextUrl);
                        });
                    });
                } else {
                    response.redirect('/auth/andbang/failed');
                }
            });
        });

        this.app.get('/auth/andbang/failed', function (req, res) {
            delete req.session.token;
            res.clearCookie('accessToken');
            res.redirect(self.loginFailedRedirect);
        });

        this.app.get('/logout', function (req, res) {
            req.session.destroy();
            res.clearCookie('accessToken');
            res.redirect(self.loggedOutRedirect);
        });

        return function (req, res, next) {
            next();
        };
    };

    this.userRequired = function (req, res, next) {
        // Ensure that a user object is available after validating
        // or retrieving a token.
        if (req.session.user) {
            next();
        } else {
            request.get({
                url: self.apiUrl + '/me',
                strictSSL: true,
                headers: {
                    authorization: 'Bearer ' + req.session.token.access_token
                },
                json: true
            }, function (err, res2, body) {
                if (res2 && res2.statusCode === 200) {
                    req.session.user = body;
                    next();
                } else {
                    res.redirect('/auth/andbang/failed');
                }
            });
        }
    }

    this.secure = function () {
        // Check that an access token is available, either in the current
        // session or cached in a cookie. We'll validate cached tokens to
        // ensure that they were issued for our app and aren't expired.
        return function (req, res, next) {
            var cookieToken = req.cookies.accessToken,
                sessionToken;
           
            if (req.session.token) {
                sessionToken = req.session.token.access_token;
            }

            if (!cookieToken && !sessionToken) {
                req.session.nextUrl = req.url;
                return res.redirect('/auth');
            } else if (!cookieToken && sessionToken) {
                res.cookie('accessToken', sessionToken, {
                    maxAge: 86400000,
                    secure: req.secure || req.host != 'localhost'
                });
                return self.userRequired(req, res, next);
            } else if (cookieToken && !sessionToken) {
                request.post({
                    url: self.accountsUrl + '/oauth/validate',
                    strictSSL: true,
                    form: {
                        access_token: cookieToken,
                        client_id: self.clientId,
                        client_secret: self.clientSecret
                    },
                }, function (err, res2, body) {
                    if (res2 && res2.statusCode === 200) {
                        var token = JSON.parse(body);
                        if (token.access_token === cookieToken) {
                            req.session.token = token;
                            req.session.token.grant_date = Date.now();
                            return self.userRequired(req, res, next);
                        }
                    }
                    res.clearCookie('accessToken');
                    res.redirect('/auth');
                });
            } else if (cookieToken && sessionToken && cookieToken !== sessionToken) {
                res.cookie('accessToken', sessionToken, {
                    maxAge: 86400000,
                    secure: req.secure || req.host != 'localhost'
                });
                return self.userRequired(req, res, next);
            } else {
                return self.userRequired(req, res, next);
            }
        }
    };
}

module.exports = new AndBangMiddleware();
