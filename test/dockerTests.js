const path = require(`path`);
const fs = require(`fs`);
const sinon = require(`sinon`);
const helpers = require(`yeoman-test`);
const assert = require(`yeoman-assert`);
const proxyquire = require(`proxyquire`);
const util = require(`../generators/app/utility`);
const docker = require(`../generators/docker/app`);

describe(`docker:index`, function () {
   "use strict";
   it(`test prompts docker should not return error`, function (done) {
      sinon.stub(util, `findProject`).callsArgWith(4, null, { value: "TeamProject", id: 1 });
      sinon.stub(util, `tryFindDockerServiceEndpoint`).callsArgWith(5, null, { name: `endpoint`, id: 1 });

      helpers.run(path.join(__dirname, `../generators/docker/index`))
         .withPrompts({
            pat: `token`,
            applicationName: `aspDemo`,
            dockerHost: `dockerHost`,
            dockerCertPath: `dockerCertPath`,
            dockerRegistryId: `dockerRegistryId`,
            dockerRegistryEmail: `dockerRegistryEmail`,
            dockerRegistryPassword: `dockerRegistryPassword`,
            tfs: `http://localhost:8080/tfs/DefaultCollection`
         })
         .on(`error`, function (error) {
            assert.fail(error);
            done();
         })
         .on(`ready`, function (generator) {
            // This is called right before `generator.run()` is called
         })
         .on(`end`, function () {
            // Using the yeoman helpers and sinon.test did not play nice
            // so clean up your stubs         
            util.tryFindDockerServiceEndpoint.restore();
            util.findProject.restore();

            done();
         });
   });

   it(`test cmd line docker should not return error`, function (done) {
      sinon.stub(util, `findProject`).callsArgWith(4, null, { value: "TeamProject", id: 1 });
      sinon.stub(util, `tryFindDockerServiceEndpoint`).callsArgWith(5, null, { name: `endpoint`, id: 1 });

      helpers.run(path.join(__dirname, `../generators/docker/index`))
         .withArguments([
         `aspDemo`,
         `http://localhost:8080/tfs/DefaultCollection`,
         `dockerHost`,
         `dockerCerts`,
         `dockerRegistryId`,
         `dockerRegistryEmail`,
         `dockerPorts`,
         `dockerRegistryPassword`,
         `token`])
         .on(`error`, function (error) {
            assert.fail(error);
            done();
         })
         .on(`ready`, function (generator) {
            // This is called right before `generator.run()` is called
         })
         .on(`end`, function () {
            // Using the yeoman helpers and sinon.test did not play nice
            // so clean up your stubs         
            util.tryFindDockerServiceEndpoint.restore();
            util.findProject.restore();

            done();
         });
   });
});

describe(`docker:app`, function () {
   "use strict";

   it(`run with existing endpoint should run without error`, sinon.test(function (done) {
      // Arrange
      this.stub(util, `findProject`).callsArgWith(4, null, { value: "TeamProject", id: 1 });
      this.stub(util, `tryFindDockerServiceEndpoint`).callsArgWith(5, null, { name: `endpoint`, id: 1 });

      var logger = sinon.stub();
      logger.log = function () { };

      var args = {
         tfs: `http://localhost:8080/tfs/DefaultCollection`,
         pat: `token`,
         project: `e2eDemo`,
         dockerHost: `dockerHost`,
         dockerCertPath: `dockerCertPath`
      };

      // Act
      docker.run(args, logger, function (e, ep) {
         assert.ok(!e);

         done();
      });
   }));

   it(`run with error should return error`, sinon.test(function (done) {
      // Arrange
      this.stub(util, `findProject`).callsArgWith(4, null, { value: "TeamProject", id: 1 });
      this.stub(util, `tryFindDockerServiceEndpoint`).callsArgWith(5, new Error("boom"), null);

      var logger = sinon.stub();
      logger.log = function () { };

      var args = {
         tfs: `http://localhost:8080/tfs/DefaultCollection`,
         pat: `token`,
         project: `e2eDemo`,
         dockerHost: `dockerHost`,
         dockerCertPath: `dockerCertPath`
      };

      // Act
      // I have to use an anonymous function otherwise
      // I would be passing the return value of findOrCreateProject
      // instead of the function. I have to do this to pass args
      // to findOrCreateProject.

      // I use the custom error validation method to call done
      // because my method is async 
      assert.throws(() => {
         docker.run(args, logger);
      }, function (e) {
         done();
         return true;
      });
   }));

   it(`findOrCreateDockerServiceEndpoint should create endpoint`, sinon.test(function (done) {
      // Arrange
      // This allows me to take control of the request requirement
      // without this there would be no way to stub the request calls
      var requestStub = sinon.stub();
      const proxyApp = proxyquire(`../generators/docker/app`, { "request": requestStub });

      this.stub(util, `tryFindDockerServiceEndpoint`).callsArgWith(5, null, undefined);

      this.stub(fs, `readFile`, function (files, options, cb) {
         if (cb === undefined) {
            cb = options;
         }

         cb(null, `contents`);
      });

      var logger = sinon.stub();
      logger.log = function () { };

      // Create Project
      requestStub.onCall(0).yields(null, { statusCode: 200 }, { name: `endpoint` });

      // Act
      proxyApp.findOrCreateDockerServiceEndpoint(`http://localhost:8080/tfs/DefaultCollection`, `ProjectId`,
         `DockerHost`, `dockerCertPath`, `token`, logger, function (e, ep) {
            assert.equal(e, null);
            assert.equal(ep.name, `endpoint`);

            done();
         });
   }));

   it(`findOrCreateDockerServiceEndpoint should throw error`, sinon.test(function (done) {
      // Arrange
      // This allows me to take control of the request requirement
      // without this there would be no way to stub the request calls
      var requestStub = sinon.stub();
      const proxyApp = proxyquire(`../generators/docker/app`, { "request": requestStub });

      this.stub(util, `tryFindDockerServiceEndpoint`).callsArgWith(5, null, undefined);

      this.stub(fs, `readFile`, function (files, options, cb) {
         if (cb === undefined) {
            cb = options;
         }

         cb(null, `contents`);
      });

      var logger = sinon.stub();
      logger.log = function () { };

      // Create Project
      requestStub.onCall(0).yields(null, { statusCode: 400 }, null);

      // Act
      // I use the custom error validation method to call done
      // because my method is async 
      assert.throws(() => {
         proxyApp.findOrCreateDockerServiceEndpoint(`http://localhost:8080/tfs/DefaultCollection`, `ProjectId`,
            `DockerHost`, `dockerCertPath`, `token`, logger, done);
      }, function (e) {
         done();
         return true;
      });
   }));

   it(`findOrCreateDockerServiceEndpoint should short circuit`, sinon.test(function (done) {
      // Arrange

      var logger = sinon.stub();
      logger.log = function () { };

      // Act
      docker.findOrCreateDockerServiceEndpoint(`http://localhost:8080/tfs/DefaultCollection`, `ProjectId`,
         null, null, `token`, logger, function (e, ep) {
            assert.equal(e, null);
            assert.equal(ep, null);

            done();
         });
   }));
});