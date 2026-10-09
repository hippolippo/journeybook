/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const elements = app.findCollectionByNameOrId('elements');
    try {
      elements.fields.getByName('scale');
    } catch (e) {
      elements.fields.add(new NumberField({ name: 'scale' }));
    }
    app.save(elements);
  },
  () => {
    /* keep the column on rollback; harmless */
  },
);
