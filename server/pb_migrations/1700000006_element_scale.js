/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const elements = app.findCollectionByNameOrId('elements');
    let existing = null;
    try {
      existing = elements.fields.getByName('scale');
    } catch (e) {
      existing = null;
    }
    if (!existing) elements.fields.add(new NumberField({ name: 'scale' }));
    app.save(elements);
  },
  () => {
    /* keep the column on rollback; harmless */
  },
);
