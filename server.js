var express = require('express'),
    andbangAuth = require('./andbang-express-auth'),
    app = express();

// config our middleware
app.use(express.cookieParser());
app.use(express.session({ secret: 'keyboard cat' }));
app.use(andbangAuth.middleware({
    app: app,
    clientId: 'You can get a client ID and secret from https://accounts.andbang.com',
    clientSecret: 'Yup, you should get a client secret too.',
    defaultRedirect: '/secured'
}));

app.get('/', function (req, res) {
    res.send('<a href="/auth">login</a>');
});

app.get('/login', function (req, res) {
    res.send('<h1>Please login</h1><a href="/auth">login</a>');
});

app.get('/secured', andbangAuth.secured, function (req, res) {
    res.send(req.session.user);
});

app.get('/other-secured', andbangAuth.secured, function (req, res) {
    res.send(req.session.user);
});

app.listen(3003);