/* jshint node: true */
/* global _, $, ko, ui, dpd, ace, Context */

(function() {
  'use strict';

  if (window.actionsInitialized) {
    return;
  }

  window.actionsInitialized = true;

  var $editor = $('#ace-editor');
  var editor, bindings, configuration;

  function render(configuration) {

    var data = _.extend({
        actions: [],
        type: 'ActionResource'
      },
      configuration || {});

    bindings = {};

    bindings.editable = {
      id: ko.observable(''),
      name: ko.observable(''),
      resource: ko.observable('')
    };

    bindings.creatable = {
      name: ko.observable(''),
      resource: ko.observable('')
    };

    var reset = _.bind(function() {
      bindings.creatable.name('');
      bindings.creatable.resource('');
    });

    bindings.actions = ko.observableArray(data.actions);

    bindings.onEdit = _.bind(function(action) {

      $('.edit-mode')
        .removeClass('edit-mode');
      $('#action-' + action.name)
        .addClass('edit-mode');

      if (!action.name) {
        return;
      }

      $('.action-edit')
        .toggleClass('hide');

      bindings.editable.id(action.name);
      bindings.editable.name(action.name);
      bindings.editable.resource(action.resource);

      bindings.isNew(false);
      bindings.isEdit(true);
      bindings.isEditMode(true);

      fetchCode();
    });

    bindings.onAdd = _.bind(function() {
      var action = {
        name: bindings.creatable.name(),
        resource: bindings.creatable.resource()
      };

      data.actions.push(action);

      storeConfiguration(data);
      storeCode(bindings.creatable.name());

      bindings.actions(data.actions);

      reset();

      bindings.editable.name(action.name);
      bindings.editable.resource(action.resource);


      $('.edit-mode')
        .removeClass('edit-mode');
      $('#action-' + action.name)
        .addClass('edit-mode');

    }, bindings);

    bindings.onUpdate = _.bind(function(action, event) {
      var name = bindings.editable.id();

      _.forEach(configuration.actions, function(action, index) {
        if (name === action.name) {
          configuration.actions[index] = {
            name: bindings.editable.name(),
            resource: bindings.editable.resource()
          };
        }
      });

      storeConfiguration(configuration);
      storeCode(bindings.editable.name());

      bindings.actions(configuration.actions);

      $('#action-' + action.name)
        .addClass('edit-mode');

    }, bindings);

    bindings.onNew = _.bind(function() {
      bindings.editable.name('');
      bindings.editable.resource('');

      $('.edit-mode')
        .removeClass('edit-mode');
      $('#action-new')
        .addClass('edit-mode');
    });

    bindings.onDelete = _.bind(function(action, event) {

      event.preventDefault();
      event.stopPropagation();

      _.forEach(bindings.actions(), function(storedAction, index) {
        if (storedAction.name === action.name) {
          data.actions.splice(index, 1);
        }
      });

      bindings.actions(data.actions);

      storeConfiguration(data);
    });

    bindings.isEmpty = ko.observable(bindings.actions().length === 0);
    bindings.isNew = ko.observable(true);
    bindings.isEdit = ko.observable(false);
    bindings.isEditMode = ko.observable(false);
    bindings.isInitialized = ko.observable(true);

    $(document)
      .on('mouseover', '.component-item', function() {
        $(this)
          .find('.hide')
          .toggle(true);
      })
      .on('mouseout', '.component-item', function() {
        $(this)
          .find('.hide')
          .toggle(false);
      });

    bindings.availableResources = [];
    fetchAvailableResources(bindings);
  }

  function createEditor() {
    editor = ace.edit('ace-editor');
    editor.setTheme('ace/theme/deployd');
    editor.session.setMode('ace/mode/javascript');
    editor.setShowPrintMargin(false);

    bindEditor();
  }

  function bindEditor(action) {
    if (editor) {

      var code = action || '';

      editor.getSession()
        .setValue(code);
      editor.getSession()
        .on('change', function() {
          // trackUpdate(editor);
        });
      editor.commands.addCommand({
        name: 'save',
        bindKey: {
          win: 'Ctrl-S',
          mac: 'Command-S'
        },
        exec: function() {
          storeCode(bindings.editable.name());
        }
      });
    }
  }

  function storeConfiguration(configuration) {
    dpd('__resources')
      .put(Context.resourceId, configuration, function(resource, error) {
        if (error) {
          console.error(error);
        }
      });
  }

  function fetchAvailableResources(bindings) {
    dpd('__resources').get(function(resources) {
      bindings.availableResources = _.compact(
        _.map(resources, function(resource) {
          return resource.type !== 'ActionResource' ? resource.id : false;
        }));

      bindings.availableResources.splice(0, 0, '');

      ko.applyBindings(bindings);
    });
  }

  function storeCode(name) {
    var value = editor.getSession()
      .getValue() || '';

    var fileName = name.replace(' ', '-')
      .toLowerCase() + '.js';

    dpd('__resources')
      .put(Context.resourceId + '/' + fileName, {
        value: value
      }, function(resource, error) {
        if (error) {
          return ui.error('Error saving event', error.message)
            .effect('slide');
        }
        if (!$('#notifications li')
          .length) {
          ui.notify('Saved')
            .hide(1000)
            .effect('slide');
        }
      });
  }

  function fetchCode(callback) {
    if (bindings && bindings.editable.name()) {
      var fileName = bindings.editable.name()
        .replace(' ', '-')
        .toLowerCase() + '.js';

      dpd('__resources')
        .get(Context.resourceId + '/' + fileName,
          function(resource, error) {
            if (!error) {
              editor.getSession()
                .setValue(resource.value);

              callback && callback(resource.value);
            }
          });
    }
  }

  function fetchProperties(callback) {
    // Update resources from disk
    dpd('__resources')
      .get(Context.resourceId, callback);
  }

  fetchProperties(function(resourceConfig) {
    configuration = resourceConfig;
    render(resourceConfig);
  });

  $('#actions')
    .show();

  if ($editor) {
    createEditor();
    fetchCode();
  }

})();