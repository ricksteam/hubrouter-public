/*
MIT License

Copyright (c) 2019 B. Ricks

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const express = require("express");
const routes = require("express").Router();
const axios = require("axios");

const bodyParser = require("body-parser");


app = express();
app.use(bodyParser({ limit: '50mb' }));
//app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const _ = require("lodash");
let stringify = require("json-stringify-safe");

/**
 * Convert a string that is encoded in base 64 into a string that is encoded is ascii
 * @param {String} base64 A base64 encoded string
 * @return {String} A ascii encoded string
 */
function fromBase64ToAscii(base64) {
  return new Buffer(base64, "base64").toString();
}

/**
 * Convert a string that is encoded in ascii into a string that is encoded in base64
 * @param {String} ascii An ascii encoded string
 * @return {String} A base 64 encode string
 */
function fromAsciiToBase64(ascii) {
  return new Buffer(ascii).toString("base64");
}

/**
 * Save an ascii encoded file to a github using the repo/contents api.  
 * @param {String} owner The owner/organization in which the file will go
 * @param {String} repo The repository in which the file will go
 * @param {String} filename The name of the file to save
 * @param {String} contents The ascii-encoded file to save
 * @param {String} token The acess token to pass to the github api
 * @param {String} message The commit message to attach to the commit
 * @return {Promise} The resulting promise from the commit network call.
 */
function saveToGithub(owner, repo, filename, contents, token, message, encoding) {
  let realMessage = message ? message : "Created via file API";
  let realEncoding = encoding ? encoding : "utf8";

  //Get the HEAD. Process explained here http://www.levibotelho.com/development/commit-a-file-with-the-github-api/
  let call = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/master?access_token=${token}`;
  let commitURL, commitSHA, treeSHA, treeURL, blobSHA, nextTreeSHA, nextCommitSHA;
  let p = axios.get(call)
    .then(result => {
      //console.log(result.data.ref);
      //console.log(result.data.object.url);
      commitURL = result.data.object.url;
      // console.log(result.data.object.sha);


      //Now get the commit object
      return axios.get(commitURL);
    })
    .then(result => {

      commitSHA = result.data.sha;
      treeSHA = result.data.tree.sha;
      treeURL = result.data.tree.url;

      //Now post blob of the data

      let realContents = contents;
      if(realEncoding == "utf8"){
        console.log("Encoding from ASCII to base64");
        realContents = fromAsciiToBase64(contents)
      }
      else{
        console.log("Putting base64 data directly.");
      }

      return axios({
        url: `https://api.github.com/repos/${owner}/${repo}/git/blobs?access_token=${token}`,
        method: 'post',
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        data: {
          content: realContents,
          encoding: "base64"
        }
      })

      /* return axios.post(`https://api.github.com/repos/${owner}/${repo}/git/blobs?access_token=${token}`, {
         content: fromAsciiToBase64(contents),
         encoding: "base64"
       });*/
    })
    .then(result => {

      blobSHA = result.data.sha;

      //Get the tree

      return axios.get(treeURL + `?access_token=${token}`);
    })
    .then(result => {

      //console.log(JSON.stringify(result.data, null, 2));

      let newTreeSHA = result.data.sha;
      // console.log(newTreeSHA + " " + treeSHA);

      //Create a new tree entry with the new file

      let t = [{
        path: filename,
        type: "blob",
        mode: "100644",
        sha: blobSHA,
      }];

      //console.log(t);

      return axios.post(`https://api.github.com/repos/${owner}/${repo}/git/trees?access_token=${token}`, {
        tree: t,
        base_tree: newTreeSHA,
      });
    })
    .then(result => {
      nextTreeSHA = result.data.sha;

      //Create a new commit pointing to the that tree

      return axios.post(`https://api.github.com/repos/${owner}/${repo}/git/commits?access_token=${token}`, {
        message,
        tree: nextTreeSHA,
        parents: [commitSHA],
      })

    })
    .then(result => {

      nextCommitSHA = result.data.sha;

      //Now point the head to this commit
      return axios.patch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/master?access_token=${token}`, {
        sha: nextCommitSHA
      })


    })
    .then(result => {
      //Resolve to a promise with the blob sha in the same format as if we had used the contents api
      return new Promise(function (resolve, reject) {
        resolve({
          data: {
            content: {
              sha: blobSHA
            }
          }
        });
      })
    })




  /* let call = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}?access_token=${token}`;
   //console.log(call);
   return axios.put(call, {
     message: realMessage,
     content: fromAsciiToBase64(contents)
   });
 })
 /*.catch(err => {
   console.log("ERROR in getting head reference. " + err);
 })*/

  return p;



}

/**
 * Update a file to a github wusing the repo/contents api with an ascii encoded file.  
 * @param {String} owner The owner/organization in which the file will go
 * @param {String} repo The repository in which the file will go
 * @param {String} filename The name of the file to save
 * @param {String} contents The ascii-encoded file to save
 * @param {String} token The acess token to pass to the github api
 * @param {String} message The commit message to attach to the commit
 * @return {Promise} The resulting promise from the commit network call.
 */
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

/**
 * Get the contents of a file in github using the repos/contents api. 
 * This function has tighter file size constraints than the function getGithubWithSHA. 
 * Therefore, it is best to avoid this function when possible.
 * @param {String} owner The owner/organization where the file resides
 * @param {String} repo The repository where the file resides
 * @param {String} filename The name of the file to retrieve
 * @param {String} token The acess token to pass to the github api
 * @return {Promise} The resulting promise from the get network call.
 */

function getInGithub(owner, repo, filename, token) {
  let call = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}?access_token=${token}`;
  //console.log(call);
  return axios.get(call);
}

/**
 * Get the contents of a file in github using the blobs api. 
 * Thin function can retrieve larger files than the function getInGithub. 
 * Therefore, it is the prefered function to use.
 * @param {String} owner The owner/organization where the file resides
 * @param {String} repo The repository where the file resides
 * @param {String} sha The sha of the file to retrieve
 * @param {String} token The acess token to pass to the github api
 * @return {Promise} The resulting promise from the get network call.
 */

function getInGithubWithSHA(owner, repo, sha, token) {
  console.log("Doing a sha call " + sha);
  let call = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}?access_token=${token}`;
  //console.log(call);
  return axios.get(call);
}

/**
 * Remove a file from Github.
 * @param {String} owner The owner/organization in which the file resides
 * @param {String} repo  The repository in which the file resides
 * @param {String} filename The name of the file to remove
 * @param {String} token The access token granting permission to do the removal
 * @param {String} sha The sha of the file to remove
 * @param {String} message The commit message
 * @returns {Promise} The resulting promise from the delete network call.
 */
function deleteToGithub(owner, repo, filename, token, sha, message) {
  let realMessage = message ? message : "Created via file API";
  let call = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}?access_token=${token}`;
  console.log(call);
  return axios.delete(call, {
    data: {
      message: realMessage,
      sha
    }
  });
}

/**
 * Github returns a lot of information about an file and gives the content as base64-encoded.
 * This function simplifies that object by only returning the keys that are relevant 
 * and converting the base64 content to ascii-encoded content.
 * @param {Object} githubFileObject The file object returned from github to be simplified
 * @returns A file object with fewer keys and ascii-encoded content.
 */
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

/**
 * Github returns a lot of information about a directory.
 * The function returns an object with only the keys of interest
 * @param {Object} githubDirectoryObject A directory object received from a call to the Github api.
 * @returns A directory object with only the relevant keys
 */
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

/**
 * Recursively create a flat map of the files in a directory, ignoring readme files if requisted
 * @param {Array} fileLikeArray An array of file descriptors as returned by Github when querying the contents of a directory
 * @param {Boolean} includeReadme True if the result should include the readme files, false otherwise
 * @returns {Array} A flat-mapped array of just file descriptors that includes readme files if requested.
 */
function mapFileLikeObjects(fileLikeArray, includeReadme) {
  let toReturn = [];

  for (let i = 0; i < fileLikeArray.length; i++) {
    let fileLikeObject = fileLikeArray[i];
    if (fileLikeObject.type === "file") {
      if (fileLikeObject.name != "README.md" || includeReadme)
        toReturn.push(mapFile(fileLikeObject));
    } else {
      toReturn.push(mapDirectory(fileLikeObject));
    }
  }

  return toReturn;
}

/**
 * Retrieve a content from github and return it as ascii-enncoded text
 * If the user includes a sha (preferred), then the content is retrieved using a sha.
 * In this case, the path is ignored.
 * Otherwise, the content is retreived using the path, in which case the sha is ignored.
 * 
 * Once the result come back from Github, the result is analyzed to see if it is a file descriptor
 * Or a directory descriptor (i.e. an array of file descriptors).
 * If it is a file descriptor, the function immediately continues.
 * If not, the function recursively flat maps the directory including the readme as requested
 * In either case, the resulting file descriptor or array of file descriputors as "returned" 
 * using the express response variable provided.
 * 
 * An errors that are caught and retured using the express response variable provided.
 * @param {String} res Express middleway response variable used to send the results of this function back to the caller
 * @param {String} org The owner/organization in which the file resides
 * @param {String} repo The repository in which the file resides
 * @param {String} path The path of the file. *Note* This parameter is ignored if the sha parameter is provided.
 * @param {String} accessToken The access token used to grant access to the file
 * @param {String} sha The SHA of the file. *Note* This parameter is optional, though proferred. If it is not provided, the path parameter must be provided.
 * @param {Boolean} includeReadme Whether or not to include readme files which requesting the file descriptors of a directory. *Note* This is optional when reuesting only a file.
 */
function retrieveFromGithub(res, org, repo, path, accessToken, sha, includeReadme) {
  let promise;
  if (sha)
    promise = getInGithubWithSHA(org, repo, sha, accessToken);
  else
    promise = getInGithub(org, repo, path, accessToken);
  promise
    .then(result => {
      //If the result is a directory, result.data is an array
      if (Array.isArray(result.data)) {
        res.send(mapFileLikeObjects(result.data, includeReadme));
      } else {
        let mappedFile = mapFile(result.data);
        res.send(mappedFile);
      }


    })
    .catch(error => {
      console.log("Error " + error.response.data.message);

      res.status(error.response.status);
      res.send(error.response.statusText);
    });
}

/**
 * Route to request a resource from Github. If it is a file, the ascii-encoded contents are returened
 * Expected values in the body of the post:
 * org: The owner/organization in which the file/directory resides
 * repo: The repository in which the file resides
 * accessToken: The access token that grants access for the operation
 * path: The path of the file to retrieve. *Note* This is ignored if the sha is provided (proferred).
 * sha: The sha of the file to retrieve. *Note* This is optional if the path parameter is provided.
 * includeReadme: If a directory is requested, should the readme file descriptors be returned?
 */
routes.post("/crud/retrieve/:org/:repo", (req, res) => {
  let accessToken = req.res.locals.accessToken;
  let repo = req.params.repo;
  let path = req.body.path;
  let sha = req.body.sha;
  let org = req.params.org;
  let includeReadme = req.body.includeReadme;

  retrieveFromGithub(res, org, repo, path, accessToken, sha, includeReadme);
});

/**
 * @deprecated
 */
//Get everything in a repo, up to 1,000 items
routes.get("/crud/retrieveAll/:org/:repo", (req, res) => {
  let accessToken = req.res.locals.accessToken;
  let repo = req.params.repo;
  let org = req.params.org;
  let includeReadme = true;

  axios
    .get(
      `https://api.github.com/repos/${org}/${repo}/contents/?access_token=${accessToken}`
    )
    .then(result => {
      //If the result is a directory, result.data is an array
      if (Array.isArray(result.data)) {
        res.send(mapFileLikeObjects(result.data, includeReadme));
      } else res.send(mapFile(result.data));
    })
    .catch(error => {
      console.log(stringify(error));
      res.send("error");
    });
});

/**
 * Create a resource in github from an ascii-encoded file
 * This route expects the following values in the post body:
 * org: The owner/organization in which the file/directory will reside
 * repo: The repository in which the file will reside
 * accessToken: The access token that grants access for the operation
 * path: The path of the file. 
 * message: The commit message.
 * content: The ascii-encoded content of the file
  */
routes.post("/crud/create/:org/:repo", (req, res) => {
  let accessToken = req.res.locals.accessToken;
  let repo = req.params.repo;
  let path = req.body.path;
  let content = req.body.content;
  let message = req.body.message;
  let org = req.params.org;
  let encoding = req.body.encoding;

  //console.log(`Got db ${repo} ${path} ${message}`);

  let promise = saveToGithub(org, repo, path, content, accessToken, message, encoding);
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

/**
 * Update a resource in github from an ascii-encoded file
 * This route expects the following values in the post body:
 * org: The owner/organization in which the file/directory  resides
 * repo: The repository in which the file resides
 * accessToken: The access token that grants access for the operation
 * path: The path of the file.
 * sha: The sha of the file 
 * message: The commit message.
 * content: The ascii-encoded content of the file
  */
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

/**
 * Route to remove a resource from Github
 * Expected values in the body of the post:
 * org: The owner/organization in which the file/directory resides
 * repo: The repository in which the file resides
 * accessToken: The access token that grants access for the operation
 * path: The path of the file to remove.
 * sha: The sha of the file to remove. 
 * message: The commit message to accompany the removal
 
 */
routes.post("/crud/delete/:org/:repo", (req, res) => {
  let accessToken = req.res.locals.accessToken;
  let repo = req.params.repo;
  let path = req.body.path;
  let message = req.body.message;
  let sha = req.body.sha;
  let org = req.params.org;

  console.log(`Got db ${org} ${repo} ${path} ${message} ${sha}`);

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

/**
 * Get a list of the repositories in an organization
 * Expected values ithe body of this post are:
 * org: The owner/organiation that holds the repositories
 * accessToken: The access token used for the query
 */
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
