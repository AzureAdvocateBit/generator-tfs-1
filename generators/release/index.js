const url = require(`url`);
const path = require(`path`);
const app = require(`./app.js`);
const util = require(`../app/utility`);
const generators = require(`yeoman-generator`);

// Carry the arguments
var cmdLnInput = {};

function construct() {
   // Calling the super constructor is important so our generator is correctly set up
   generators.Base.apply(this, arguments);

   // Order is important 
   this.argument(`type`, { type: String, required: false, desc: `the project type to create` });
   this.argument(`applicationName`, { type: String, required: false, desc: `the name of the application` });
   this.argument(`tfs`, { type: String, required: false, desc: `the tfs from http to the collection i.e. http://localhost:8080/tfs/DefaultCollection` });
   this.argument(`queue`, { type: String, required: false, desc: `the agent queue name to use` });
   this.argument(`target`, { type: String, required: false, desc: `docker or Azure app service` });
   this.argument(`azureSub`, { type: String, required: false, desc: `the Azure Subscription name` });
   this.argument(`dockerHost`, { type: String, required: false, desc: `the docker host url including port` });
   this.argument(`dockerRegistryId`, { type: String, required: false, desc: `the ID for Docker repository` });
   this.argument(`dockerPorts`, { type: String, required: false, desc: `the port mapping for container and host` });
   this.argument(`pat`, { type: String, required: false, desc: `the tfs Personal Access Token` });
}

// Store all the values collected from the command line so we can pass to 
// sub generators. I also use this to determine which data I still need to
// prompt for.
function init() {
   cmdLnInput = {
      tfs: this.tfs,
      pat: this.pat,
      type: this.type,
      queue: this.queue,
      target: this.target,
      azureSub: this.azureSub,
      dockerHost: this.dockerHost,
      dockerPorts: this.dockerPorts,
      applicationName: this.applicationName,
      dockerRegistryId: this.dockerRegistryId
   };
}

// Collect any missing data from the user.
function input() {
   return this.prompt([{
      type: `input`,
      name: `tfs`,
      store: true,
      message: `What is your TFS URL including collection\n  i.e. http://tfs:8080/tfs/DefaultCollection?`,
      validate: util.validateTFS,
      when: function () {
         return cmdLnInput.tfs === undefined;
      }
   }, {
      type: `password`,
      name: `pat`,
      store: false,
      message: `What is your TFS Access Token?`,
      validate: util.validatePersonalAccessToken,
      when: function () {
         return cmdLnInput.pat === undefined;
      }
   }, {
      type: `list`,
      name: `queue`,
      store: true,
      message: `What agent queue would you like to use?`,
      default: `Default`,
      choices: util.getPools,
      when: function () {
         return cmdLnInput.queue === undefined;
      }
   }, {
      type: `list`,
      name: `type`,
      store: true,
      message: `What type of application do you want to create?`,
      default: cmdLnInput.type,
      choices: [{
         name: `.NET Core`,
         value: `asp`
      }, {
         name: `Node.js`,
         value: `node`
      }, {
         name: `Java`,
         value: `java`
      }],
      when: function () {
         return cmdLnInput.type === undefined;
      }
   }, {
      type: `input`,
      name: `applicationName`,
      store: true,
      message: `What is the name of your application?`,
      validate: util.validateApplicationName,
      when: function () {
         return cmdLnInput.applicationName === undefined;
      }
   }, {
      type: `list`,
      name: `target`,
      store: true,
      message: `Where would you like to deploy?`,
      default: cmdLnInput.target,
      choices: [{
         name: `Azure App Service`,
         value: `paas`
      }, {
         name: `Docker`,
         value: `docker`
      }],
      when: function () {
         return cmdLnInput.target === undefined;
      }
   }, {
      type: `input`,
      name: `azureSub`,
      store: true,
      message: `What is your Azure subscription name?`,
      validate: util.validateAzureSub,
      when: function (a) {
         return (a.target === `paas` || cmdLnInput.target === `paas`) && cmdLnInput.azureSub === undefined;
      }
   }, {
      type: `input`,
      name: `dockerHost`,
      store: true,
      message: `What is your Docker host url and port (tcp://host:2376)?`,
      validate: util.validateDockerHost,
      when: function (answers) {
         // If you pass in the target on the command line 
         // answers.target will be undefined so test cmdLnInput
         return (answers.target === `docker` || cmdLnInput.target === `docker`) && cmdLnInput.dockerHost === undefined;
      }
   }, {
      type: `input`,
      name: `dockerRegistryId`,
      store: true,
      message: `What is your Docker Hub ID (case sensitive)?`,
      validate: util.validateDockerHubID,
      when: function (answers) {
         return (answers.target === `docker` || cmdLnInput.target === `docker`) && cmdLnInput.dockerRegistryId === undefined;
      }
   }, {
      type: `input`,
      name: `dockerPorts`,
      default: util.getDefaultPortMapping,
      message: `What should the port mapping be?`,
      validate: util.validatePortMapping,
      when: function (answers) {
         return (answers.target === `docker` || cmdLnInput.target === `docker`) && cmdLnInput.dockerPorts === undefined;
      }
   }]).then(function (a) {
      // Transfer answers (a) to global object (cmdLnInput) for use in the rest
      // of the generator
      this.pat = util.reconcileValue(a.pat, cmdLnInput.pat);
      this.tfs = util.reconcileValue(a.tfs, cmdLnInput.tfs);
      this.type = util.reconcileValue(a.type, cmdLnInput.type);
      this.queue = util.reconcileValue(a.queue, cmdLnInput.queue);
      this.target = util.reconcileValue(a.target, cmdLnInput.target);
      this.azureSub = util.reconcileValue(a.azureSub, cmdLnInput.azureSub, ``);
      this.dockerHost = util.reconcileValue(a.dockerHost, cmdLnInput.dockerHost, ``);
      this.dockerPorts = util.reconcileValue(a.dockerPorts, cmdLnInput.dockerPorts, ``);
      this.applicationName = util.reconcileValue(a.applicationName, cmdLnInput.applicationName, ``);
      this.dockerRegistryId = util.reconcileValue(a.dockerRegistryId, cmdLnInput.dockerRegistryId, ``);
   }.bind(this));
}

function configureRelase() {
   var done = this.async();

   var release = this.templatePath(`release.json`);

   if (this.type === `asp`) {
      if (this.target === `docker`) {
         release = this.templatePath(`release_docker.json`);
      }
   } else if (this.type === `node`) {
      if (this.target === `docker`) {
         release = this.templatePath(`release_docker.json`);
      }
   } else {
      if (this.target === `docker`) {
         release = this.templatePath(`release_docker.json`);
      }
   }

   var args = {
      pat: this.pat,
      tfs: this.tfs,
      queue: this.queue,
      target: this.target,
      releaseJson: release,
      azureSub: this.azureSub,
      appName: this.applicationName,
      project: this.applicationName
   };

   if (this.target === `docker`) {
      // We only support Docker Hub so set the dockerRegistry to 
      // https://index.docker.io/v1/
      var registry = `https://index.docker.io/v1/`;

      args.dockerRegistry = registry;
      args.dockerHost = this.dockerHost;
      args.dockerPorts = this.dockerPorts;
      args.dockerRegistryId = this.dockerRegistryId;
   }

   var gen = this;

   app.run(args, this, function (err) {

      if (err !== null) {
         // TODO: Report error
      }

      done();
   });
}

module.exports = generators.Base.extend({
   // The name `constructor` is important here
   constructor: construct,

   // 1. Your initialization methods (checking current project state, getting configs, etc)
   initializing: init,

   // 2. Where you prompt users for options (where you`d call this.prompt())
   prompting: input,

   // 3. Saving configurations and configure the project (creating .editorconfig files and other metadata files)
   configuring: undefined,

   // 4. default - If the method name doesn`t match a priority, it will be pushed to this group.

   // 5. Where you write the generator specific files (routes, controllers, etc)
   writing: configureRelase,

   // 6. conflicts - Where conflicts are handled (used internally)

   // 7. Where installation are run (npm, bower)
   install: undefined,

   // 8. Called last, cleanup, say good bye, etc
   end: undefined
});