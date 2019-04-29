const express = require("express");
const routes = require("express").Router();
const axios = require("axios");
const redis = require("redis");
const bodyParser = require("body-parser");


app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const _ = require("lodash");
let stringify = require("json-stringify-safe");

const redisClient = redis.createClient();
redisClient.on("connect", function() {
  //console.log("Connected to redis");
});

function fromBase64ToAscii(base64) {
  return new Buffer(base64, "base64").toString();
}

function fromAsciiToBase64(ascii) {
  return new Buffer(ascii).toString("base64");
}

function saveToGithub(owner, repo, filename, contents, token, message) {
  let realMessage = message ? message : "Created via file API";
  let call = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}?access_token=${token}`;
  //console.log(call);
  return axios.put(call, {
    message: realMessage,
    content: fromAsciiToBase64(contents)
  });
}

function updateToGithub(owner, repo, filename, contents, token, sha, message) {
  let realMessage = message ? message : "Created via file API";
  return axios.put(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filename}?access_token=${token}`,
    {
      message: realMessage,
      content: fromAsciiToBase64(contents),
      sha
    }
  );
}

function getInGithub(owner, repo, filename, token) {
  let call = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}?access_token=${token}`;
  //console.log(call);
  return axios.get(call);
}

function deleteToGithub(owner, repo, filename, token, sha, message) {
  let realMessage = message ? message : "Created via file API";
  let call = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}?access_token=${token}`;
  return axios.delete(call, {
    data: {
      message: realMessage,
      sha
    }
  });
}

function mapFile(githubFileObject) {
  let toReturn = {};
  let keysToKeep = ["type", "name", "sha", "path"];
  //console.log(Object.entries(githubFileObject));
  for (key in githubFileObject) {
    if (keysToKeep.includes(key)) {
      toReturn[key] = githubFileObject[key];
    }
    if (key == "content") {
      toReturn["content"] = fromBase64ToAscii(githubFileObject[key]);
    }
  }

  return toReturn;
}

function mapDirectory(githubDirectoryObject) {
  let toReturn = {};
  let keysToKeep = ["type", "name", "sha", "path"];
  for (key in githubDirectoryObject) {
    if (keysToKeep.includes(key)) {
      toReturn[key] = githubDirectoryObject[key];
    }
  }

  return toReturn;
}

function mapFileLikeObjects(fileLikeArray) {
  let toReturn = [];

  for (let i = 0; i < fileLikeArray.length; i++) {
    let fileLikeObject = fileLikeArray[i];
    if (fileLikeObject.type === "file") {
      toReturn.push(mapFile(fileLikeObject));
    } else {
      toReturn.push(mapDirectory(fileLikeObject));
    }
  }

  return toReturn;
}

function retrieveFromGithub(res, org, repo, path, accessToken) {
  let promise = getInGithub(org, repo, path, accessToken);
  promise
    .then(result => {
      //console.log("Parsing result");

      //If the result is a directory, result.data is an array
      if (Array.isArray(result.data)) {
        res.send(mapFileLikeObjects(result.data));
      } else {
        let file = mapFile(result.data);
        redisClient.hmset(file.sha, file);
        res.send(mapFile(result.data));
      }
    })
    .catch(error => {
      console.log(error);
      res.send("error");
    });
}

routes.post("/crud/retrieve/:org/:repo", (req, res) => {
  let accessToken = req.res.locals.accessToken;
  let repo = req.params.repo;
  let path = req.body.path;
  let sha = req.body.sha;
  let org = req.params.org;
  //console.log(`Got db ${repo} ${path}`);

  if (sha != undefined) {
    //console.log("Checking redis file entry for " + sha);
    redisClient.hgetall(sha, function(err, reply) {
      if (reply != null) {
        //console.log("Found entry for " + sha);
        res.send(reply);
      } else {
        //console.log("No entry found. Polling GitHub...");
        retrieveFromGithub(res, org, repo, path, accessToken);
      }
    });
  } else {
    console.log("No sha in request body, skipping redis cache check...");
    retrieveFromGithub(res, org, repo, path, accessToken);
  }
});

//Get everything in a repo, up to 1,000 items
routes.get("/crud/retrieveAll/:org/:repo", (req, res) => {
  let accessToken = req.res.locals.accessToken;
  let repo = req.params.repo;
  let org = req.params.org;

  axios
    .get(
      `https://api.github.com/repos/${org}/${repo}/contents/?access_token=${accessToken}`
    )
    .then(result => {
      //If the result is a directory, result.data is an array
      if (Array.isArray(result.data)) {
        res.send(mapFileLikeObjects(result.data));
      } else res.send(mapFile(result.data));
    })
    .catch(error => {
      console.log(stringify(error));
      res.send("error");
    });
});

routes.post("/crud/create/:org/:repo", (req, res) => {
  let accessToken = req.res.locals.accessToken;
  let repo = req.params.repo;
  let path = req.body.path;
  let content = req.body.content;
  let message = req.body.message;
  let org = req.params.org;

  //console.log(`Got db ${repo} ${path} ${message}`);

  let promise = saveToGithub(org, repo, path, content, accessToken, message);
  //console.log(promise);
  promise
    .then(result => {
      res.send(result.data);
    })
    .catch(error => {
      let realError = stringify(error);
      //console.log(realError);
      res.send(realError);
    });
});

routes.post("/crud/update/:org/:repo", (req, res) => {
  let accessToken = req.res.locals.accessToken;
  let repo = req.params.repo;
  let path = req.body.path;
  let content = req.body.content;
  let message = req.body.message;
  let sha = req.body.sha;
  let org = req.params.org;

  //console.log(`Got db ${repo} ${path} ${message}`);

  let promise = updateToGithub(
    org,
    repo,
    path,
    content,
    accessToken,
    sha,
    message
  );
  //console.log(promise);
  promise
    .then(result => {
      res.send(result.data);
    })
    .catch(error => {
      let realError = stringify(error);
      console.log(realError);
      res.send(realError);
    });
});

routes.post("/crud/delete/:org/:repo", (req, res) => {
  let accessToken = req.res.locals.accessToken;
  let repo = req.params.repo;
  let path = req.body.path;
  let message = req.body.message;
  let sha = req.body.sha;
  let org = req.params.org;

  //console.log(`Got db ${repo} ${path} ${message}`);

  let promise = deleteToGithub(org, repo, path, accessToken, sha, message);
  //console.log(promise);
  promise
    .then(result => {
      res.send(result.data);
    })
    .catch(error => {
      let realError = stringify(error);
      console.log(realError);
      res.send(realError);
    });
});

routes.get("/repos/:org", (req, res) => {
  let accessToken = req.res.locals.accessToken;
  let org = req.params.org;

  axios
    .get(`https://api.github.com/orgs/${org}/repos?access_token=${accessToken}`)
    .then(result => {
      //console.log(result.data);
      let toSend = result.data.map(r => r.name);
      res.send(toSend);
    })
    .catch(err => {
      let error = stringify(err);
      res.send(error);
    });
});

app.use(routes);
module.exports = app;
