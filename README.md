# Github API Router

![Travis Build Status](https://travis-ci.org/ricksteam/github-router-public.svg?branch=master)


This module produces Node.js express routes to interface with the GitHub API to treat a GitHub as if it were the a backend database. Specifically, this add CRUD routes to create, retrieve, update and delete files in a specified GitHub repository for which you have rights to do so. Note that this project is not associateded with or officially endorsed by GitHub.com.

In order to use this, you need:

1. Credentials on GitHub.com.

1. A repository on GitHub on which you have read and right permissions.

1. A personal access token that you have saved in a secrets.js file. This token will be read by githubrouter and passed to the GitHub api to access the CRUD routes. The secrets.js file should have the following format:

```javascript
exports.accessToken="<PERSONAL_ACCESS_TOKEN>"

```

To use, simply import the router and assign it to a URL path:


## Minimum working example
```javascript
const githubRouter = require('@c-hess/githubrouter');
const app = require("express")();
//const cors = require("cors"); //As needed
const secrets = require("./secrets.js")

//app.use(cors()); //As needed

app.use("/", (req, res, next)=>{
  req.res.locals.accessToken = secrets.accessToken;
  next();  
})

app.use(githubRouter)

app.listen(3000, ()=>{console.log("Listening on port 3000")});
```

Note that this module requires an active Redis instance to work at the moment.
Redis is used by this module to perform basic caching operations when
retrieving the contents of files.
