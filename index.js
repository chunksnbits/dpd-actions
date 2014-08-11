/* jshint node: true, unused:true */
'use strict';

var _ = require('lodash');
var internalClient = require('deployd/lib/internal-client');
var logger = require('npmlog');
var path = require('path');
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

    action.store = options && action.resource ? options.db.createStore(action.resource) : {};

    action.executable = Script.load(this.options.configPath + '/' + action.name + '.js',
      function(error, script) {
        if (!error) {
          action.executable = script;
        } else {
          throw new Error('Failed to init executable for action ' + action.name + '. Failed with error: ' + error.message);
        }
      });

    this.actions[action.name] = action;
  }, this);

  logger.verbose(_tag_, 'Initializing action collection... done');
}

util.inherits(ActionResource, Resource);

ActionResource.label = 'ActionResource';
ActionResource.defaultPath = '/action';

ActionResource.dashboard = {
  path: path.join(__dirname, 'dashboard'),
  pages: ['Actions'],
  scripts: [
    '/js/lib/jquery-ui-1.8.22.custom.min.js',
    '/js/lib/knockout-2.1.0.js',
    '/js/lib/knockout.mapping.js',
    '/js/util/knockout-util.js',
    '/js/util/key-constants.js',
    '/js/actions.js',
    '/js/util.js',
  ]
};

ActionResource.prototype = _.extend(ActionResource.prototype, Resource.prototype);
ActionResource.prototype.clientGeneration = true;
ActionResource.prototype.clientGenerationExec = ['action'];

ActionResource.prototype.handle = function(context) {

  logger.info(_tag_, 'Handling context: %j', context.url);

  if (context.url.indexOf('/action') === 0) {

    var requestPath = context.url.replace(/^\/action\//, '');
    var action = this.actions[requestPath];

    if (action) {
      action.data = _.merge({}, context.query, context.body);
      try {
        action.executable.run(context, this.createDomain(action),
          function(error) {
            if (error) {
              logger.error(_tag_, 'Failed executing action %j with error: %j', action.name, error);
            } else {
              logger.info(_tag_, 'Successfully executed action %j', action.name);
              context.done(error, action.data);
            }
          });
      } catch (error) {
        logger.error(_tag_, 'Failed executing action: %j with error: %j', action.name, error.message);
        context.done(error);
      }
    }

    // Log errors if no action was found for the request path
    else {
      if (!action) {
        logger.error(_tag_, 'No action found for action %j', context.url);
      } else {
        logger.error(_tag_, 'An unexpected error occured.');
      }

      context.done('Failed executing action:' + requestPath);
    }
  }

  // Not an action, let Resource handle request
  else {
    Resource.prototype.handle.apply(this, arguments);
  }
};


ActionResource.prototype.createDomain = function(action) {
  var hasErrors = false;
  var errors = {};

  var domain = {

    // Helpers as provided with default Collection Resource
    error: function(key, value) {
      logger.error(_tag_, key, value);

      errors[key] = value || true;
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

    'this': action.data,
    data: action.data,

    // Additional resources, that will come in handy...
    // Provide dependency management access
    require: require,

    // Allow internal access to other resources
    store: {
      persist: this.preparePersistFunction(action),
      fetch: this.prepareFetchFunction(action)
    },

    dpd: this.internalClient
  };

  return domain;
};

ActionResource.prototype.handleResponse = function(callback) {
  return function(error, data) {
    callback(error, data);
  };
};

ActionResource.prototype.preparePersistFunction = function(action) {
  var _this = this;

  return function(element, callback) {
    if (element.id) {
      action.store.update({
        id: element.id
      }, element, _this.handleResponse(callback));
    } else {
      action.store.insert(element, _this.handleResponse(callback));
    }
  };
};

ActionResource.prototype.prepareFetchFunction = function(action) {
  var _this = this;

  return function(query, callback) {

    // No query argument provided, fetch all.
    if (_.isFunction(query)) {
      action.store.find(_this.handleResponse(query));
    }
    // Query provided.
    else if (_.isObject(query)) {
      action.store.find(query, _this.handleResponse(callback));
    }
    // Id was provided.
    else {
      action.store.first({
        id: query
      }, _this.handleResponse(callback));
    }
  };
};

module.exports = ActionResource;