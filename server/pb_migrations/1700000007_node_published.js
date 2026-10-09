/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const nodes = app.findCollectionByNameOrId('nodes');
    try {
      nodes.fields.getByName('published');
    } catch (e) {
      nodes.fields.add(new BoolField({ name: 'published' }));
    }
    app.save(nodes);
  },
  () => {
    /* keep the column on rollback; harmless */
  },
);
