# And Bang auth middleware for Express.js

World's simplest oAuth. 

You just have to go register your application at https://accounts.andbang.com. You'll get a client ID and client secret. Just drop those into the code below and then just add a link or button that points to `/auth` somewhere on your page and you're good to go.

The code below should work once you've dropped in your client id and secret:

```js
var express = require('express'),
    andbangAuth = require('./andbang-express-auth'),
    app = express();

// config our middleware
app.use(express.cookieParser());
app.use(express.session({ secret: 'keyboard cat' }));
app.use(andbangAuth.middleware({
    app: app,
    clientId: '<< YOUR CLIENT ID>>',
    clientSecret: '<< YOUR CLIENT SECRET>>',
    defaultRedirect: '/secured'
}));

// Just re-direct people to '/auth' and the plugin does the rest.
app.get('/', function (req, res) {
    res.send('<a href="/auth">login</a>');
});

// if for routes where you want to require login add the middleware
// like this:
app.get('/secured', andbangAuth.secured, function (req, res) {
    res.send(req.session.user);
});

```

# License
MIT