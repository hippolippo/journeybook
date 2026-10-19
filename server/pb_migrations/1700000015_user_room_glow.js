/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Per-user strength for the day-mode halo behind room text. Stored as text
    // so an empty/unset value can mean "use the default" while "0" means off.
    const users = app.findCollectionByNameOrId('users');
    let existing = null;
    try {
      existing = users.fields.getByName('roomGlow');
    } catch (e) {
      existing = null;
    }
    if (!existing) {
      users.fields.add(new TextField({ name: 'roomGlow', max: 12 }));
      app.save(users);
    }
  },
  () => {
    /* keep the column on rollback; harmless */
  },
);
