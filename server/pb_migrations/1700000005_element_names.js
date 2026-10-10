/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const elements = app.findCollectionByNameOrId('elements');
    let existing = null;
    try {
      existing = elements.fields.getByName('name');
    } catch (e) {
      existing = null;
    }
    if (!existing) elements.fields.add(new TextField({ name: 'name', max: 120 }));
    app.save(elements);
  },
  () => {
    /* keep the column on rollback; harmless */
  },
);
