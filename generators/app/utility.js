const request = require(`request`);

const BUILD_API_VERSION = `2.0`;
const PROJECT_API_VERSION = `1.0`;
const RELEASE_API_VERSION = `3.0-preview.3`;
const DISTRIBUTED_TASK_API_VERSION = `3.0-preview.1`;
const SERVICE_ENDPOINTS_API_VERSION = `3.0-preview.1`;

String.prototype.replaceAll = function (search, replacement) {
   var target = this;
   return target.split(search).join(replacement);
};

function reconcileValue(first, second, fallback) {
   return first ? first : (second ? second : fallback);
}

function getDefaultPortMapping(answers) {
   if (answers.type === `java`) {
      return `8080:8080`;
   } else if (answers.type === `node`) {
      return `3000:3000`;
   } else {
      return `80:80`;
   }
}

function validateRequired(input, msg) {
   return !input ? msg : true;
}

function validatePortMapping(input) {
   return validateRequired(input, `You must provide a Port Mapping`);
}

function validateGroupID(input) {
   return validateRequired(input, `You must provide a Group ID`);
}

function validateApplicationName(input) {
   return validateRequired(input, `You must provide a name for your application`);
}

function validatePersonalAccessToken(input) {
   return validateRequired(input, `You must provide a Personal Access Token`);
}

function validateTFS(input) {
   return validateRequired(input, `You must provide your TFS URL including collection`);
}

function validateAzureSub(input) {
   return validateRequired(input, `You must provide an Azure Subscription Name`);
}

function validateDockerHost(input) {
   return validateRequired(input, `You must provide a Docker Host URL`);
}

function validateDockerCertificatePath(input) {
   return validateRequired(input, `You must provide a Docker Certificate Path`);
}

function validateDockerHubID(input) {
   return validateRequired(input, `You must provide a Docker Hub ID`);
}

function validateDockerHubPassword(input) {
   return validateRequired(input, `You must provide a Docker Hub Password`);
}

function validateDockerHubEmail(input) {
   return validateRequired(input, `You must provide a Docker Hub Email`);
}

function validateAzureSubID(input) {
   return validateRequired(input, `You must provide an Azure Subscription ID`);
}

function validateAzureTenantID(input) {
   return validateRequired(input, `You must provide an Azure Tenant ID`);
}

function validateServicePrincipalID(input) {
   return validateRequired(input, `You must provide a Service Principal ID`);
}

function validateServicePrincipalKey(input) {
   return validateRequired(input, `You must provide a Service Principal Key`);
}

function tokenize(input, nvp) {
   for (var key in nvp) {
      input = input.replaceAll(key, nvp[key]);
   }

   return input;
}

function encodePat(pat) {
   'use strict';

   // The personal access token must be 64 bit encoded to be used
   // with the REST API

   var b = new Buffer(`:` + pat);
   var s = b.toString(`base64`);

   return s;
}

function checkStatus(uri, token, gen, callback) {
   'use strict';

   // Simply issues a get to the provided URI and returns
   // the body as JSON.  Call this when the action taken
   // requires time to process.

   var options = {
      "method": `GET`,
      "headers": { "authorization": `Basic ${token}` },
      "url": `${uri}`
   };

   request(options, function (err, res, body) {
      callback(err, JSON.parse(body));
   });
}

function tryFindDockerRegistryServiceEndpoint(account, projectId, dockerRegistry, token, callback) {
   'use strict';

   // Will NOT throw an error if the endpoint is not found.  This is used
   // by code that will create the endpoint if it is not found.

   findDockerRegistryServiceEndpoint(account, projectId, dockerRegistry, token, function (e, ep) {
      if (e && e.code === `NotFound`) {
         callback(null, undefined);
      } else {
         callback(e, ep);
      }
   });
}

function findDockerRegistryServiceEndpoint(account, projectId, dockerRegistry, token, callback) {
   'use strict';

   // There is nothing to do
   if (!dockerRegistry) {
      callback(null, null);
      return;
   }

   var options = {
      "method": `GET`,
      "headers": { "cache-control": `no-cache`, "authorization": `Basic ${token}` },
      "url": `${account}/${projectId}/_apis/distributedtask/serviceendpoints`,
      "qs": { "api-version": SERVICE_ENDPOINTS_API_VERSION }
   };

   request(options, function (error, response, body) {
      var obj = JSON.parse(body);

      // TODO: Test that authorization.parameters.registry === dockerHost.  But that requires
      // a second REST call once you know the ID of the dockerregistry type service endpoint.
      // For now assume any dockerregistry service endpoint is safe to use.
      var endpoint = obj.value.find(function (i) { return i.type === `dockerregistry`; });

      if (endpoint === undefined) {
         callback({ "message": `x Could not find Docker Registry Service Endpoint`, "code": `NotFound` }, undefined);
      } else {
         callback(error, endpoint);
      }
   });
}

function tryFindDockerServiceEndpoint(account, projectId, dockerHost, token, gen, callback) {
   'use strict';

   // Will NOT throw an error if the endpoint is not found.  This is used
   // by code that will create the endpoint if it is not found.

   findDockerServiceEndpoint(account, projectId, dockerHost, token, gen, function (e, ep) {
      if (e && e.code === `NotFound`) {
         callback(null, undefined);
      } else {
         callback(e, ep);
      }
   });
}

function findDockerServiceEndpoint(account, projectId, dockerHost, token, gen, callback) {
   'use strict';

   // There is nothing to do
   if (!dockerHost) {
      callback(null, null);
      return;
   }

   var options = {
      "method": `GET`,
      "headers": { "cache-control": `no-cache`, "authorization": `Basic ${token}` },
      "url": `${account}/${projectId}/_apis/distributedtask/serviceendpoints`,
      "qs": { "api-version": SERVICE_ENDPOINTS_API_VERSION }
   };

   request(options, function (error, response, body) {
      // Check the response statusCode first. If it is not a 200
      // the body will be html and not JSON
      if (response.statusCode >= 400) {
         callback(`Error trying to find Docker Service Endpoint: ${response.statusMessage}`);
         return;
      }

      var obj = JSON.parse(body);

      // The i.url is returned with a trailing / so just use starts with just in case
      // the dockerHost is passed in without it
      var endpoint = obj.value.find(function (i) { return i.url.startsWith(dockerHost); });

      if (endpoint === undefined) {
         callback({ "message": `x Could not find Docker Service Endpoint`, "code": `NotFound` }, undefined);
      } else {
         callback(error, endpoint);
      }
   });
}

function tryFindAzureServiceEndpoint(account, projectId, sub, token, gen, callback) {
   'use strict';

   // Will NOT throw an error if the endpoint is not found.  This is used
   // by code that will create the endpoint if it is not found.

   findAzureServiceEndpoint(account, projectId, sub, token, gen, function (err, ep) {
      if (err && err.code === `NotFound`) {
         callback(null, undefined);
      } else {
         callback(err, ep);
      }
   });
}

function findAzureServiceEndpoint(account, projectId, sub, token, gen, callback) {
   'use strict';

   // There is nothing to do
   if (!sub.name) {
      callback(null, null);
      return;
   }

   var options = {
      "method": `GET`,
      "headers": {
         "cache-control": `no-cache`,
         "authorization": `Basic ${token}`
      },
      "url": `${account}/${projectId}/_apis/distributedtask/serviceendpoints`,
      "qs": {
         "api-version": SERVICE_ENDPOINTS_API_VERSION
      }
   };

   request(options, function (error, response, body) {
      var obj = JSON.parse(body);

      var endpoint = obj.value.find(function (i) { return i.data.subscriptionName === sub.name; });

      if (endpoint === undefined) {
         callback({ "message": `x Could not find Azure Service Endpoint`, "code": `NotFound` }, undefined);
      } else {
         callback(error, endpoint);
      }
   });
}

function tryFindProject(account, project, token, gen, callback) {
   'use strict';

   // Will NOT throw an error if the project is not found.  This is used
   // by code that will create the project if it is not found.

   findProject(account, project, token, gen, function (err, obj) {
      if (err && err.code === `NotFound`) {
         callback(null, undefined);
      } else {
         callback(err, obj);
      }
   });
}

function findProject(account, project, token, gen, callback) {
   'use strict';

   // Will throw an error if the project is not found. This is used
   // by code that requires a project and will stop execution if the
   // project is not found.

   var options = {
      "method": `GET`,
      "headers": { "cache-control": `no-cache`, "authorization": `Basic ${token}` },
      "url": `${account}/_apis/projects/${project}`,
      "qs": { "api-version": PROJECT_API_VERSION }
   };

   request(options, function (err, res, body) {

      if (err) {
         callback(err, null);
         return;
      }

      // Test for this before you try and parse the body.
      // When a 203 is returned the body is HTML instead of
      // JSON and will throw an exception if you try and parse.
      // I only test this here because the project is required for
      // all other items. 
      if (res.statusCode === 203) {
         // You get this when the site tries to send you to the
         // login page.
         gen.log.error(`x Unable to authenticate with Team Services. Check account name and personal access token.`);
         callback({ "message": `Unable to authenticate with Team Services. Check account name and personal access token.` });
         return;
      }

      if (res.statusCode === 404) {
         // Returning a undefined project indicates it was not found
         callback({ "message": `x Project ${project} not found`, "code": `NotFound` }, undefined);
      } else {
         var obj = JSON.parse(body);

         // Return the team project we just found.
         callback(err, obj);
      }
   });
}

function findQueue(name, account, teamProject, token, callback) {
   'use strict';

   var options = {
      "method": `GET`,
      "headers": {
         "cache-control": `no-cache`, "authorization": `Basic ${token}`
      },
      "url": `${account}/${teamProject.id}/_apis/distributedtask/queues`,
      "qs": { "api-version": DISTRIBUTED_TASK_API_VERSION, "queueName": name }
   };

   request(options, function (err, res, body) {
      var obj = JSON.parse(body);

      if (res.statusCode >= 400) {
         callback(new Error(res.statusMessage), null);
      } else if (res.statusCode >= 300) {
         // When it is a 300 the obj is a error
         // object from the server
         callback(obj);
      } else {
         // Setting to null is the all clear signal to the async
         // series to continue
         callback(null, obj.value[0].id);
      }
   });
}

function tryFindBuild(account, teamProject, token, target, callback) {
   'use strict';

   findBuild(account, teamProject, token, target, function (e, bld) {
      if (e && e.code === `NotFound`) {
         callback(null, undefined);
      } else {
         callback(e, bld);
      }
   });
}

function findBuild(account, teamProject, token, target, callback) {
   'use strict';

   var name = target === `docker` ? `${teamProject.name}-Docker-CI` : `${teamProject.name}-CI`;
   var options = {
      "method": `GET`,
      "headers": {
         "cache-control": `no-cache`, "authorization": `Basic ${token}`
      },
      "url": `${account}/${teamProject.id}/_apis/build/definitions`,
      "qs": { "api-version": BUILD_API_VERSION }
   };

   request(options, function (e, response, body) {
      var obj = JSON.parse(body);

      var bld = obj.value.find(function (i) { return i.name === name; });

      if (!bld) {
         callback({ "message": `x Build ${name} not found`, "code": `NotFound` }, undefined);
      } else {
         callback(e, bld);
      }
   });
}

function tryFindRelease(args, callback) {
   'use strict';

   findRelease(args, function (e, rel) {
      if (e && e.code === `NotFound`) {
         callback(null, undefined);
      } else {
         callback(e, rel);
      }
   });
}

function findRelease(args, callback) {
   "use strict";

   var name = args.target === `docker` ? `${args.appName}-Docker-CD` : `${args.appName}-CD`;

   var options = {
      "method": `GET`,
      "headers": {
         "cache-control": `no-cache`, "authorization": `Basic ${args.token}`
      },
      "url": `${args.account}/${args.teamProject.name}/_apis/release/definitions`,
      "qs": { "api-version": RELEASE_API_VERSION }
   };

   request(options, function (e, response, body) {
      var obj = JSON.parse(body);

      var rel = obj.value.find(function (i) { return i.name === name; });

      if (!rel) {
         callback({ "message": `x Release ${name} not found`, "code": `NotFound` }, undefined);
      } else {
         callback(e, rel);
      }
   });
}

function getPools(answers) {
   "use strict";

   var token = encodePat(answers.pat);

   var options = {
      "method": `GET`,
      "headers": {
         "cache-control": `no-cache`, "authorization": `Basic ${token}`
      },
      "url": `${answers.tfs}/_apis/distributedtask/pools`,
      "qs": { "api-version": DISTRIBUTED_TASK_API_VERSION }
   };

   return new Promise(function (resolve, reject) {
      request(options, function (e, response, body) {
         if (e) {
            reject(e);
            return;
         }
         
         var obj = JSON.parse(body);
         resolve(obj.value);
      });
   });
}

module.exports = {

   // Exports the portions of the file we want to share with files that require
   // it.

   getPools: getPools,
   tokenize: tokenize,
   encodePat: encodePat,
   findQueue: findQueue,
   findBuild: findBuild,
   checkStatus: checkStatus,
   findProject: findProject,
   findRelease: findRelease,
   validateTFS: validateTFS,
   tryFindBuild: tryFindBuild,
   tryFindRelease: tryFindRelease,
   reconcileValue: reconcileValue,
   tryFindProject: tryFindProject,
   validateGroupID: validateGroupID,
   validateAzureSub: validateAzureSub,
   validateDockerHost: validateDockerHost,
   validateAzureSubID: validateAzureSubID,
   validatePortMapping: validatePortMapping,
   validateDockerHubID: validateDockerHubID,
   getDefaultPortMapping: getDefaultPortMapping,
   validateAzureTenantID: validateAzureTenantID,
   validateDockerHubEmail: validateDockerHubEmail,
   validateApplicationName: validateApplicationName,
   findAzureServiceEndpoint: findAzureServiceEndpoint,
   findDockerServiceEndpoint: findDockerServiceEndpoint,
   validateDockerHubPassword: validateDockerHubPassword,
   validateServicePrincipalID: validateServicePrincipalID,
   validateServicePrincipalKey: validateServicePrincipalKey,
   tryFindAzureServiceEndpoint: tryFindAzureServiceEndpoint,
   validatePersonalAccessToken: validatePersonalAccessToken,
   tryFindDockerServiceEndpoint: tryFindDockerServiceEndpoint,
   validateDockerCertificatePath: validateDockerCertificatePath,
   findDockerRegistryServiceEndpoint: findDockerRegistryServiceEndpoint,
   tryFindDockerRegistryServiceEndpoint: tryFindDockerRegistryServiceEndpoint
};