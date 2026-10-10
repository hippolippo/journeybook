/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Additive: per-page colour overrides for recolourable paper layers.
    const pages = app.findCollectionByNameOrId('pages');
    const ensureField = (collection, name, field) => {
      let existing = null;
      try {
        existing = collection.fields.getByName(name);
      } catch (e) {
        existing = null;
      }
      if (!existing) collection.fields.add(field);
    };
    ensureField(pages, 'paperColors', new JSONField({ name: 'paperColors' }));
    app.save(pages);
  },
  (app) => {
    const pages = app.findCollectionByNameOrId('pages');
    const field = pages.fields.getByName('paperColors');
    if (field) pages.fields.remove(field.id);
    app.save(pages);
  },
);
