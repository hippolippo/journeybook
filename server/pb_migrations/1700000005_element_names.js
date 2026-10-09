/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const elements = app.findCollectionByNameOrId('elements');
    try {
      elements.fields.getByName('name');
    } catch (e) {
      elements.fields.add(new TextField({ name: 'name', max: 120 }));
    }
    app.save(elements);
  },
  () => {
    /* keep the column on rollback; harmless */
  },
);
