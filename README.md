# DEPRECATED (This plugin is no longer maintained

=========== 

# Archive:

## Deployd custom route action module

This custom resource type allows you to define custom actions, to be performed outside the default collection resource, i.e., dpd-actions do not necessarily require a collection to be executed.

## Installation

Within your deployd app, you can add dpd-actions using npm:

`npm install dpd-actions`

See [Installing Modules](http://docs.deployd.com/docs/using-modules/installing-modules.md) for details.

## Configuration

Go to the deployd dashboard and add a new dpd-action. Specify a name for your action ('myactions').
In the actions panel add actions using the provided forms and add the code necessary to execute the action.

Actions can be accessed using the dpd client or http request.

For the dpd client use:

`dpd.actions.myaction('actionname', callback);`

For http access:

`http.get/post/put/delete('http://*my-host*:*my-port*/actions/myaction/actionname');

### Settings:

`resource`

Allows you to specify any resource in your current setup. This resource will be directly available through the store object within your actions.

### Helpers

A couple of helper methods/objects will be available within a custom action:

* `require`

Provides access to the node [module loader](http://nodejs.org/api/modules.html)

* `dpd`

Gives access to the internal dpd client. Allows to query other resources / collections / actions within your deployd app.

* `store`

Direct access to this action's `resource`'s Mongo store. Provides two accessor methods:

`store.fetch`: Query the mongo store

`store.persist`: Persist data into the mongo store

* `this` / `data`

Provides access to the requested resource and is used to provide the values returned by the request.
