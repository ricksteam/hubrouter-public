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
  res.locals.accessToken = accessToken
  next();
})

app.use("/", routes);



//before and after approach from https://stackoverflow.com/questions/38223053/ensuring-server-app-runs-before-mocha-tests-start


let temp_sha = ""; //Sometimes we need to store a sha for a later operation.





describe("Hubcrud functionality", function () {
  this.timeout(100000);
  describe("File Retrieval", function () {
    it("Lists the files in a directory", function (done) {

      fs.readdir(testData, (err, localFiles) => {

        if (err) {
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
    it("Gets the contents of a small file w/o a sha", function (done) {

      fs.readFile(testData + "/hello.world", "utf8", (err, localContents) => {
        localContents = localContents.replace("\r", "");

        if (err) {
          done(err);
        }

        axios.post(`http://localhost:${port}/crud/retrieve/${org}/${repo}`, {
          path: "test_data/hello.world"
        })
          .then(result => {
            let gitContents = result.data.content;
            console.log(result.data.sha);
            assert.equal(localContents, gitContents);
            done();
          })
          .catch(err => {
            done(err);
          })
      });
    });
    it("Get the contents of a small file with a sha", function(done){
      
      fs.readFile(testData + "/hello.world", "utf8", (err, localContents) => {
        localContents = localContents.replace("\r", "");

        if (err) {
          done(err);
        }

        axios.post(`http://localhost:${port}/crud/retrieve/${org}/${repo}`, {
          sha: "980a0d5f19a64b4b30a87d4206aade58726b60e3"
        })
          .then(result => {
            let gitContents = result.data.content;
            console.log(result.data.sha);
            assert.equal(localContents, gitContents);
            done();
          })
          .catch(err => {
            done(err);
          })
      });
    });
    it("Doesn't get a non-existant file", function (done) {
      axios.post(`http://localhost:${port}/crud/retrieve/${org}/${repo}`, {
        path: "bad_path.txt"
      })
        .then(result => {
          done("Shouldn't have gotten here " + result.data);
        })
        .catch(err => {
          done();
        })
    });
    it("Gets the contents of a large file with a sha", function (done) {
      fs.readFile(testData + "/Noise.png", "utf8", (err, localContents) => {

        if (err) {
          done(err);
        }

        axios.post(`http://localhost:${port}/crud/retrieve/${org}/${repo}`, {
          path: "test_data/Noise.png",
          sha: "28118e82fb7143e141024be09eb7f80e20bd097e"
        })
          .then(result => {
            let gitContents = result.data.content;
            assert.equal(localContents, gitContents);
            done();
          })
          .catch(err => {
            console.log(err.message);
            done(new Error(err.message));
          })
      });
    });
    it("Puts a file with size greater than 1mb", function (done) {
      fs.readFile(testData + "/Noise.png", "utf8", (err, localContents) => {
        if (err) {
          done(err);
        }

        axios.post(`http://localhost:${port}/crud/create/${org}/${repo}`, {
          path: "test_data/Temp_Noise.png",
          message: "[skip travis] Test commit",
          content: localContents
        })
        .then(result=>{
          console.log(result.data.message);
          //console.log(result.data.substr(0, 1000));
          done();
        })
        .catch(err=>{
          console.log("Error in put");
          console.log(err.message);
          done(new Error(err.message));
        })
      })
    });
    it("Deletes a file", function (done) {
      fs.readFile(testData + "/Temp_Noise.png", "utf8", (err, localContents) => {
        if (err) {
          done(err);
        }

        axios.post(`http://localhost:${port}/crud/delete/${org}/${repo}`, {
          path: "test_data/Temp_Noise.png",
          message: "[skip travis] Test commit",
          sha: "980a0d5f19a64b4b30a87d4206aade58726b60e3",
        })
        .then(result=>{
          done();
        })
        .catch(err=>{
          console.log(err.message);
          done(new Error(err.message));
        })
      })
    });
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





