/// <reference path="../pb_data/types.d.ts" />
// Protected file URLs require a short-lived file token, so a copied
// /api/files/... URL no longer works without an authenticated token.
migrate(
  (app) => {
    const media = app.findCollectionByNameOrId('media');
    const file = media.fields.getByName('file');
    file.protected = true;
    app.save(media);
  },
  (app) => {
    const media = app.findCollectionByNameOrId('media');
    const file = media.fields.getByName('file');
    file.protected = false;
    app.save(media);
  },
);
