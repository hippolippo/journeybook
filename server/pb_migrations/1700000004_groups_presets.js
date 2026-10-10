/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const auth = '@request.auth.id != ""';

    const elements = app.findCollectionByNameOrId('elements');
    const ensureField = (collection, name, field) => {
      let existing = null;
      try {
        existing = collection.fields.getByName(name);
      } catch (e) {
        existing = null;
      }
      if (!existing) collection.fields.add(field);
    };
    ensureField(elements, 'locked', new BoolField({ name: 'locked' }));
    ensureField(elements, 'aspectLocked', new BoolField({ name: 'aspectLocked' }));
    ensureField(elements, 'group', new TextField({ name: 'group', max: 40 }));
    app.save(elements);

    // Existing items default to a locked aspect ratio.
    for (const rec of app.findAllRecords('elements')) {
      rec.set('aspectLocked', true);
      app.save(rec);
    }

    const pages = app.findCollectionByNameOrId('pages');
    ensureField(pages, 'groups', new JSONField({ name: 'groups' }));
    app.save(pages);

    // Shared, user-defined image effect presets.
    app.save(
      new Collection({
        type: 'base',
        name: 'image_presets',
        fields: [
          { name: 'name', type: 'text', max: 120 },
          { name: 'effects', type: 'json' },
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
    app.delete(app.findCollectionByNameOrId('image_presets'));
  },
);
