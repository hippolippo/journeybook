/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const items = app.findCollectionByNameOrId('room_items');
    let hasLocked = false;
    try {
      hasLocked = !!items.fields.getByName('locked');
    } catch (e) {
      hasLocked = false;
    }
    if (!hasLocked) {
      items.fields.add(new BoolField({ name: 'locked' }));
      app.save(items);
    }

    const auth = '@request.auth.id != ""';
    app.save(
      new Collection({
        type: 'base',
        name: 'room_layouts',
        fields: [
          { name: 'name', type: 'text', max: 120 },
          { name: 'data', type: 'json' },
        ],
        listRule: auth,
        viewRule: auth,
        createRule: auth,
        updateRule: auth,
        deleteRule: auth,
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('room_layouts'));
  },
);
