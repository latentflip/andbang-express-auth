# And Bang auth middleware for Express.js

World's simplest OAuth. 

1. Sign up for an And Bang account at https://andbang.com
2. Register your application at https://accounts.andbang.com/developer

   When setting your redirect URL, make sure your path is `/auth/andbang/callback`.
   For example: `localhost:9000/auth/andbang/callback`

3. Copy your app's client ID and secret, and insert them into the middleware's
   constructor, like in the example below.
4. Add a link or button that points to `/auth` somewhere on your page. You can also optionally set the "next" url to go to after successful auth all in one swoop by doing `/auth?next={{some URL}}`.
5. ...
6. Profit!
   
The code below should work once you've dropped in your client ID and secret:

```js
var express = require('express'),
    andbangAuth = require('andbang-express-auth'),
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

// For routes where you want to require login,
// add the middleware like this:
app.get('/secured', andbangAuth.secure(), function (req, res) {
    res.send(req.session.user);
});

// This port should match the port you set in the andbang redirect URL
// (eg 9000 as in the example above)
app.listen(9000);

```

# License
MIT
