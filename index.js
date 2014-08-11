/* jshint node: true, unused:true */
'use strict';

var _ = require('lodash');
var internalClient = require('deployd/lib/internal-client');
var logger = require('npmlog');
var path = require('path');
var Resource = require('deployd/lib/resource');
var Script = require('deployd/lib/script');
var util = require('util');
var q = require('q');

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
        action.executable.run(context, this.createDomain(action),
          function(error) {
            if (error) {
              logger.error(_tag_, 'Failed executing action %j with error: %j', action.name, error);
            } else {
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
        logger.error(_tag_, 'An unexpected error occured. If this problem persists, please contact support!');
      }

      context.done('Failed executing action:' + requestPath);
    }
  }
};


ActionResource.prototype.createDomain = function(action) {
  var hasErrors = false;
  var errors = {};

  var persistFunction = this.persist;
  var fetchFunction = this.fetch;

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
    action: action,

    // Additional resources, that will come in handy...
    // Provide dependency management access
    require: require,

    // Allow internal access to other resources
    store: function(data, callback) {
      return persistFunction(domain.action, data, callback);
    },
    fetch: function(query, callback) {
      return fetchFunction(domain.action, query, callback);
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

ActionResource.prototype.store = function(action, element, callback) {
  if (element.id) {
    action.store.update({
      id: element.id
    }, element, this.handleResponse(callback));
  } else {
    action.store.insert(element, this.handleResponse(callback));
  }
};

ActionResource.prototype.fetch = function(action, query, callback) {
  if (_.isObject(query)) {
    this.store.find(query, this.handleResponse(callback));
  }
  // id was provided
  else {
    this.store.first({
      id: query
    }, this.handleResponse(callback));
  }
};

module.exports = ActionResource;