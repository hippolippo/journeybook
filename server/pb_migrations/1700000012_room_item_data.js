/// <reference path="../pb_data/types.d.ts" />
// Additive: store the full room item JSON so fields without a dedicated column
// (e.g. lightLevel) survive the round-trip to the database.
migrate(
  (app) => {
    const items = app.findCollectionByNameOrId('room_items');
    let hasData = false;
    try {
      hasData = !!items.fields.getByName('data');
    } catch (e) {
      hasData = false;
    }
    if (!hasData) {
      items.fields.add(new JSONField({ name: 'data' }));
      app.save(items);
    }
  },
  (app) => {
    const items = app.findCollectionByNameOrId('room_items');
    const field = items.fields.getByName('data');
    if (field) items.fields.remove(field.id);
    app.save(items);
  },
);
