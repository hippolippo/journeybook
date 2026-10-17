/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Album photos are uploaded at full resolution. Serve small, generated
    // variants in the UI instead of shipping multi-megabyte originals.
    // PocketBase creates these on demand, so existing files get them too.
    const media = app.findCollectionByNameOrId('media');
    const file = media.fields.getByName('file');
    file.thumbs = ['480x480', '1200x1200f'];
    app.save(media);
  },
  (app) => {
    const media = app.findCollectionByNameOrId('media');
    const file = media.fields.getByName('file');
    file.thumbs = [];
    app.save(media);
  },
);
