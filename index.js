var _ = require('underscore'),
    colors = require('colors'),
    request = require('request'),
    querystring = require('querystring');


function AndBangMiddleware() {
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
            loginPageUrl: '/login'
        }, config);

        // set our account and API urls
        this.accountsUrl = config.local ? 'http://localhost:3001' : 'https://accounts.andbang.com';
        this.apiUrl = config.local ? 'http://localhost:3000' : 'https://api.andbang.com';

        // the login route
        this.app.get('/auth', function (req, res) {
            if (req.session.accessToken) {
                res.redirect(self.defaultRedirect);
            } else {
                var url = self.accountsUrl + '/oauth/authorize?' + querystring.stringify({
                        response_type: 'code',
                        client_id: self.clientId,
                        type: 'web_server'
                    });
                res.redirect(url);
            }
        });

        this.app.get('/auth/andbang/callback', function (req, response) {
            var code = querystring.parse(req.url.split('?')[1]).code,
                token;
            request.post({
                url: self.accountsUrl + '/oauth/access_token', 
                form: {
                    code: code,
                    grant_type: 'authorization_code',
                    client_id: self.clientId,
                    client_secret: self.clientSecret
                }
            }, function (err, res, body) {
                if (res && res.statusCode === 200) {
                    token = JSON.parse(body).access_token;
                }
                request.get({
                    url: self.apiUrl + '/me',
                    headers: {
                        authorization: 'Bearer ' + token
                    },
                    json: true
                }, function (err, res, body) {
                    var nextUrl = req.session.nextUrl || self.defaultRedirect || '/';
                    if (res && res.statusCode === 200) {
                        req.session.user = body;
                        req.session.accessToken = token;
                        delete req.session.nextUrl;
                        req.session.save(function () {
                            response.redirect(nextUrl);
                        });
                    } else {
                        response.redirect('/login-failed'); 
                    }
                });
            });
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

    this.secure = function () {
        var self = this;
        return function (req, res, next) {
            if (req.session.user) {
                next();
            } else {
                req.session.nextUrl = req.url;
                res.redirect(self.loginPageUrl);
            }
        }   
    };
}

module.exports = new AndBangMiddleware();
