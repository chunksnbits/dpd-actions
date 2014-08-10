/* jshint node: true, unused:true */
'use strict';

var _ = require('lodash');
var logger = require('npmlog');
var Resource = require('deployd/lib/resource');
var Script = require('deployd/lib/script');
var util = require('util');

var _tag_;

function ActionResource(name, options) {

  Resource.apply(this, arguments);

  this.dpd = internalClient.build(this.options.server);
  this.actions = {};

  this.name = name;

  _tag_ = 'action-resource::' + this.name;

  // Store actions for later reference
  _.each(this.config.actions, function(action) {

    action.name = action.name.replace(' ', '-')
      .toLowerCase();

    action.executable = Script.load(this.options.configPath + '/actions/' + action.name + '.js',
      function(error, script) {
        if (!error) {
          action.executable = script;
        } else {
          logger.error(_tag_, 'Failed to init executable for action %j. Failed with error: %j', action.name, error);
        }
      });

    this.actions[action.name] = action;
  }, this);

  logger.verbose(_tag_, 'Initializing action collection... done');
}

util.inherits(ActionResource, Resource);

ActionResource.label = 'ActionResource';
ActionResource.defaultPath = '/action';

ActionResource.dashboard.path = './dashboard';
ActionResource.dashboard.pages.push('Actions');

ActionResource.prototype = _.extend(ActionResource.prototype, Collection.prototype);
ActionResource.prototype.clientGeneration = true;
ActionResource.prototype.clientGenerationExec = ['action'];

/**
 *  Tests if the current request comes from a local client.
 *  This is verified by using either an internal client dpd,
 *  or adding a key as specified in the config to the request.
 *
 */
ActionResource.prototype.isInternal = function(query, internal) {
  var keyValidation = query && query['__internal'] !== undefined && this.config.key !== undefined && query['__internal'] === this.config.key;
  var result = internal || keyValidation;
  return result;
};

ActionResource.prototype.handle = function(context) {

  logger.info(_tag_, 'Handling context: %j', context.url);

  if (context.url.indexOf('/action') === 0) {
    var requestPath = context.url.replace(/^\/action\//, '');
    var action = this.actions[requestPath];

    if (action) {
      action.data = _.merge({}, context.query, context.body);
      try {
        this.executeAction(context, action);
      } catch (error) {
        logger.error(_tag_, 'Failed executing action: %j with error: %j', action.name, error);
        context.done(error);
      }
    }

    // Log errors if no action was found for the request path
    else {
      if (!action) {
        logger.error(_tag_, 'No action found for action %j', context.url);
      } else {
        logger.error(_tag_, 'An unexpected error occured. If this problem persists, please contact support!');
      }

      context.done('Failed executing action:' + requestPath);
    }
  }
};


ActionResource.prototype.executeAction = function(context, action) {
  logger.info(_tag_, 'Executing action: %j', action.name);

  var _this = this;

  action.executable.run(context, this.createDomain(action.data),
    function(error) {
      logger.error(_tag_, 'Failed executing action %j with error: %j', action.name, error);
      context.done(error);
    });
};

ActionResource.prototype.createDomain = function(data) {
  var hasErrors = false;

  return {

    // Helpers as provided with default Collection Resource
    error: function(key, val) {
      debug('error %s %s', key, val);
      errors[key] = val || true;
      hasErrors = true;
    },
    errorIf: function(condition, key, value) {
      if (condition) {
        domain.error(key, value);
      }
    },
    errorUnless: function(condition, key, value) {
      domain.errorIf(!condition, key, value);
    },
    hasErrors: function() {
      return hasErrors;
    },
    hide: function(property) {
      delete domain.data[property];
    },
    'this': data,
    data: data

    // Additional resources, that will come in handy...
    // Provide dependency management access
    require: require,

    // Logging
    logger: logger,

    // Allow internal access to other resources
    dpd: this.internalClient,
  };
}

module.exports = ActionResource;