/// <reference path="../pb_data/types.d.ts" />
// Journeybook is a two-person private space, so PocketBase's generic
// "login from a new location" alert is noise. The only automated email is the
// letter notification in notes.pb.js.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.authAlert.enabled = false;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.authAlert.enabled = true;
    app.save(users);
  },
);
