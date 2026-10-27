/// <reference path="../pb_data/types.d.ts" />
// Additive: remember the last notification attempt so the scheduled retry can
// back off instead of retrying every cron tick.
migrate(
  (app) => {
    const notes = app.findCollectionByNameOrId('notes');
    let field = null;
    try {
      field = notes.fields.getByName('emailLastAttempt');
    } catch (e) {
      field = null;
    }
    if (!field) {
      notes.fields.add(new NumberField({ name: 'emailLastAttempt' }));
      app.save(notes);
    }
  },
  (app) => {
    const notes = app.findCollectionByNameOrId('notes');
    const field = notes.fields.getByName('emailLastAttempt');
    if (field) notes.fields.remove(field.id);
    app.save(notes);
  },
);
