/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const nodes = app.findCollectionByNameOrId('nodes');
    let existing = null;
    try {
      existing = nodes.fields.getByName('published');
    } catch (e) {
      existing = null;
    }
    if (!existing) nodes.fields.add(new BoolField({ name: 'published' }));
    app.save(nodes);
  },
  () => {
    /* keep the column on rollback; harmless */
  },
);
