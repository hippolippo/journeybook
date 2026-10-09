/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const auth = '@request.auth.id != ""';
    app.save(
      new Collection({
        type: 'base',
        name: 'events',
        fields: [
          { name: 'kind', type: 'text', max: 20 },
          { name: 'title', type: 'text', max: 200 },
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
    app.delete(app.findCollectionByNameOrId('events'));
  },
);
