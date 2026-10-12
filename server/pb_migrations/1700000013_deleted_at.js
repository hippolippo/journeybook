/// <reference path="../pb_data/types.d.ts" />
// Additive: soft-delete timestamp (epoch ms, 0 = live) for the trash/restore
// feature. Trashed records are filtered out of the app and can be restored or
// permanently purged.
migrate(
  (app) => {
    const collections = [
      'nodes',
      'pages',
      'elements',
      'media',
      'events',
      'room_layouts',
      'image_presets',
    ];
    for (const name of collections) {
      const collection = app.findCollectionByNameOrId(name);
      let existing = null;
      try {
        existing = collection.fields.getByName('deletedAt');
      } catch (e) {
        existing = null;
      }
      if (!existing) {
        collection.fields.add(new NumberField({ name: 'deletedAt' }));
        app.save(collection);
      }
    }

    const auth = '@request.auth.id != ""';
    app.save(
      new Collection({
        type: 'base',
        name: 'trash',
        fields: [
          { name: 'kind', type: 'text', max: 20 },
          { name: 'label', type: 'text', max: 200 },
          { name: 'detail', type: 'text', max: 120 },
          { name: 'records', type: 'json' },
          { name: 'deletedAt', type: 'number' },
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
    app.delete(app.findCollectionByNameOrId('trash'));
    const collections = [
      'nodes',
      'pages',
      'elements',
      'media',
      'events',
      'room_layouts',
      'image_presets',
    ];
    for (const name of collections) {
      const collection = app.findCollectionByNameOrId(name);
      const field = collection.fields.getByName('deletedAt');
      if (field) {
        collection.fields.remove(field.id);
        app.save(collection);
      }
    }
  },
);
