# Github API Router

![Travis Build Status](https://travis-ci.org/ricksteam/github-router-public.svg?branch=master)

This module produces Node.js express routes to interface with the Github API.

To use, simply import the router and assign it to a URL path:

```javascript
const routes = require('@c-hess/githubrouter');

app.use("/", routes);
```

Note that this module requires an active Redis instance to work at the moment.
Redis is used by this module to perform basic caching operations when
retrieving the contents of files.
