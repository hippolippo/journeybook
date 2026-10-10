/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    let existing = null;
    try {
      existing = users.fields.getByName('role');
    } catch (e) {
      existing = null;
    }
    if (!existing) {
      users.fields.add(new SelectField({ name: 'role', maxSelect: 1, values: ['him', 'her'] }));
      app.save(users);
    }
  },
  () => {
    /* keep the column on rollback; harmless */
  },
);
