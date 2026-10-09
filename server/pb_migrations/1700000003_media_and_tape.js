/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const auth = '@request.auth.id != ""';

    // Album files: uploaded images per scrapbook.
    app.save(
      new Collection({
        type: 'base',
        name: 'media',
        fields: [
          { name: 'book', type: 'text', max: 20 },
          { name: 'name', type: 'text', max: 200 },
          {
            name: 'file',
            type: 'file',
            maxSelect: 1,
            maxSize: 25000000,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
          },
        ],
        listRule: auth,
        viewRule: auth,
        createRule: auth,
        updateRule: auth,
        deleteRule: auth,
      }),
    );

    // Widen element kinds to include album images and tape.
    const elements = app.findCollectionByNameOrId('elements');
    const kind = elements.fields.getByName('kind');
    const wanted = ['photo', 'note', 'sticker', 'image', 'tape'];
    kind.values = wanted;
    app.save(elements);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('media'));
  },
);
