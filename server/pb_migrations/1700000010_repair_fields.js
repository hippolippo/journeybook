/// <reference path="../pb_data/types.d.ts" />
// Repair migration: databases created before PocketBase 0.40.5 have the fields
// from migrations 1700000004-0007 recorded as applied but never added, because
// older field-lookup checks silently skipped when `getByName` returned null.
// This idempotently adds any that are missing. Additive only.
migrate(
  (app) => {
    const ensureField = (collectionName, name, field) => {
      const collection = app.findCollectionByNameOrId(collectionName);
      let existing = null;
      try {
        existing = collection.fields.getByName(name);
      } catch (e) {
        existing = null;
      }
      if (existing) return false;
      collection.fields.add(field);
      app.save(collection);
      return true;
    };

    ensureField('elements', 'locked', new BoolField({ name: 'locked' }));
    const addedAspect = ensureField(
      'elements',
      'aspectLocked',
      new BoolField({ name: 'aspectLocked' }),
    );
    ensureField('elements', 'group', new TextField({ name: 'group', max: 40 }));
    ensureField('elements', 'name', new TextField({ name: 'name', max: 120 }));
    ensureField('elements', 'scale', new NumberField({ name: 'scale' }));
    ensureField('pages', 'groups', new JSONField({ name: 'groups' }));
    ensureField('nodes', 'published', new BoolField({ name: 'published' }));

    // Match migration 1700000004: existing elements lock their aspect ratio.
    if (addedAspect) {
      for (const rec of app.findAllRecords('elements')) {
        rec.set('aspectLocked', true);
        app.save(rec);
      }
    }
  },
  () => {
    /* keep the columns on rollback; harmless */
  },
);
