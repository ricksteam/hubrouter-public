const assert = require("assert");
const axios = require("axios");
const http = require("http");
const express = require("express");
const routes = require("../index.js");
const chai = require("chai");
const chaiHttp = require("chai-http");
const fs = require("fs");
const path = require("path")

const testData = path.join(__dirname, '../test_data');

chai.use(chaiHttp);

const app = express();
const httpServer = http.createServer(app);

let accessToken = process.env.ACCESS_TOKEN;
let port = "3333";
let org = "ricksteam";
let repo = "hubrouter-public";






app.use("/", (req, res, next) => {
  console.log(accessToken);
  res.locals.accessToken = accessToken
  next();
})

app.use("/", routes);



//before and after approach from https://stackoverflow.com/questions/38223053/ensuring-server-app-runs-before-mocha-tests-start






describe('This is always true', () => {
  it('Should return true', () => {
    assert.equal(true, true)
  })
});

describe("Hubcrud functionality", function () {
  this.timeout(100000);
  describe("File Retrieval", function () {
    it("Lists the files in a directory", function (done) {

      fs.readdir(testData, (err, localFiles) => {

        if(err){
          done(err);
        }

        axios.post(`http://localhost:${port}/crud/retrieve/${org}/${repo}`, {
          path: "test_data"
        })
          .then(result => {
            console.log(result.data);
            let gitFiles = result.data;
            assert.equal(gitFiles.length, localFiles.length);
            done();
          })
          .catch(err => {
            done(err);
          })
      })
    })
  })
});

before(function (done) {
  httpServer.listen(port, done);
});

after(function (done) {
  console.log("Trying to close the server.");
  httpServer.close(done);
  console.log("The server is closed");
})





