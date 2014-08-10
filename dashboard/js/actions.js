/* jshint node: true */
/* global _, $, ko, ui, dpd, ace, Context */

(function () {
  'use strict';

  if (window.actionsInitialized) {
    return;
  }

  window.actionsInitialized = true;

  var $editor = $('#ace-editor');
  var editor, bindings, configuration;

  var defaults = {
    name: '',
    description: '',
    internal: false
  };

  function render(configuration) {

    var data = _.extend({
        actions: [],
        type: 'ActionResource'
      },
      configuration || {});

    bindings = {};

    bindings.editable = {
      name: ko.observable(''),
      description: ko.observable(''),
      internal: ko.observable(false)
    };

    bindings.creatable = {
      name: ko.observable(''),
      description: ko.observable(''),
      internal: ko.observable(false)
    };

    bindings.actions = data.actions;

    _.forEach(bindings.actions, function (action, index) {
      bindings.actions[index] = _.defaults(action, defaults);
    });

    bindings.onEdit = _.bind(function (action, event) {

      $('.edit-mode')
        .removeClass('edit-mode');
      $(event.currentTarget)
        .addClass('edit-mode');

      if (!action.name) {
        return;
      }

      $('.action-edit')
        .toggleClass('hide');

      bindings.editable.name(action.name);
      bindings.editable.description(action.description);
      bindings.editable.internal(action.internal);

      bindings.isNew(false);
      bindings.isEdit(true);
      bindings.isEditMode(true);

      fetchCode();
    });

    bindings.onAdd = _.bind(function () {
      configuration.actions.push({
        name: bindings.creatable.name(),
        description: bindings.creatable.description(),
        internal: bindings.creatable.internal()
      });

      storeConfiguration(configuration);
      storeCode(bindings.creatable.name());
    }, bindings);

    bindings.onUpdate = _.bind(function () {

      _.forEach(configuration.actions, function (action, index) {
        if (bindings.editable.name === action.name) {
          configuration.actions[index] = {
            name: bindings.editable.name(),
            description: bindings.editable.description(),
            internal: bindings.editable.internal()
          };
        }
      });

      storeConfiguration(configuration);
      storeCode(bindings.editable.name());
    }, bindings);

    bindings.onNew = _.bind(function () {
      bindings.editable.name('');
    });

    bindings.onDelete = _.bind(function (action) {

      _.forEach(bindings.actions, function (storedAction, index) {
        if (storedAction.name === action.name) {
          bindings.actions.splice(index, 1);
        }
      });

      storeConfiguration();
    });

    bindings.isEmpty = ko.observable(bindings.actions.length === 0);
    bindings.isNew = ko.observable(true);
    bindings.isEdit = ko.observable(false);
    bindings.isEditMode = ko.observable(false);
    bindings.isInitialized = ko.observable(true);

    $(document)
      .on('mouseover', '.component-item', function () {
        $(this)
          .find('.hide')
          .toggle(true);
      })
      .on('mouseout', '.component-item', function () {
        $(this)
          .find('.hide')
          .toggle(false);
      });

    ko.applyBindings(bindings);
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
        .on('change', function () {
          // trackUpdate(editor);
        });
      editor.commands.addCommand({
        name: 'save',
        bindKey: {
          win: 'Ctrl-S',
          mac: 'Command-S'
        },
        exec: function () {
          storeCode(bindings.editable.name());
        }
      });
    }
  }

  function storeConfiguration(configuration) {
    dpd('__resources')
      .put(Context.resourceId, configuration, function (resource, error) {
        if (error) {
          console.error(error);
        }
      });
  }

  function storeCode(name) {
    var value = editor.getSession()
      .getValue();

    var fileName = name.replace(' ', '-')
      .toLowerCase() + '.js';

    if (value) {
      dpd('__resources')
        .put(Context.resourceId + '/actions/' + fileName, {
          value: value
        }, function (resource, error) {
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
  }

  function fetchCode(callback) {
    if (bindings && bindings.editable.name()) {
      var fileName = bindings.editable.name()
        .replace(' ', '-')
        .toLowerCase() + '.js';

      dpd('__resources')
        .get(Context.resourceId + '/actions/' + fileName, function (resource) {
          editor.getSession()
            .setValue(resource.value);

          callback && callback(resource.value);
        });
    }
  }

  function fetchProperties(callback) {
    // Update resources from disk
    dpd('__resources')
      .get(Context.resourceId, callback);
  }

  fetchProperties(function (resourceConfig) {
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