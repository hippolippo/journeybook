/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // --- users (auth): invite-only, shared space ---
    let users;
    try {
      users = app.findCollectionByNameOrId('users');
    } catch (e) {
      users = new Collection({
        type: 'auth',
        name: 'users',
        fields: [{ name: 'name', type: 'text', max: 80 }],
      });
    }
    users.listRule = '@request.auth.id != ""';
    users.viewRule = '@request.auth.id != ""';
    users.createRule = null; // no public signup
    users.updateRule = 'id = @request.auth.id';
    users.deleteRule = null;
    app.save(users);

    const auth = '@request.auth.id != ""';

    app.save(
      new Collection({
        type: 'base',
        name: 'nodes',
        fields: [
          { name: 'type', type: 'select', maxSelect: 1, values: ['folder', 'scrapbook'] },
          { name: 'title', type: 'text', max: 200 },
          { name: 'parent', type: 'text', max: 20 },
          { name: 'tags', type: 'json' },
          { name: 'order', type: 'number' },
          { name: 'cover', type: 'text', max: 20 },
        ],
        listRule: auth,
        viewRule: auth,
        createRule: auth,
        updateRule: auth,
        deleteRule: auth,
      }),
    );

    app.save(
      new Collection({
        type: 'base',
        name: 'pages',
        fields: [
          { name: 'book', type: 'text', max: 20 },
          { name: 'index', type: 'number' },
          { name: 'background', type: 'text', max: 40 },
        ],
        listRule: auth,
        viewRule: auth,
        createRule: auth,
        updateRule: auth,
        deleteRule: auth,
      }),
    );

    app.save(
      new Collection({
        type: 'base',
        name: 'elements',
        fields: [
          { name: 'page', type: 'text', max: 20 },
          { name: 'kind', type: 'select', maxSelect: 1, values: ['photo', 'note', 'sticker'] },
          { name: 'payload', type: 'json' },
          { name: 'x', type: 'number' },
          { name: 'y', type: 'number' },
          { name: 'w', type: 'number' },
          { name: 'h', type: 'number' },
          { name: 'rotation', type: 'number' },
          { name: 'z', type: 'number' },
          { name: 'opacity', type: 'number' },
        ],
        listRule: auth,
        viewRule: auth,
        createRule: auth,
        updateRule: auth,
        deleteRule: auth,
      }),
    );

    app.save(
      new Collection({
        type: 'base',
        name: 'room',
        fields: [
          { name: 'wallId', type: 'text', max: 40 },
          { name: 'floorId', type: 'text', max: 40 },
          { name: 'dayNightMode', type: 'text', max: 10 },
          { name: 'referenceTz', type: 'text', max: 60 },
        ],
        listRule: auth,
        viewRule: auth,
        createRule: auth,
        updateRule: auth,
        deleteRule: auth,
      }),
    );

    app.save(
      new Collection({
        type: 'base',
        name: 'room_items',
        fields: [
          { name: 'catalogId', type: 'text', max: 60 },
          { name: 'layer', type: 'select', maxSelect: 1, values: ['wall', 'floor', 'surface'] },
          { name: 'z', type: 'number' },
          { name: 'attachTo', type: 'text', max: 20 },
          { name: 'color', type: 'json' },
          { name: 'desktop', type: 'json' },
          { name: 'mobile', type: 'json' },
          { name: 'hideMobile', type: 'bool' },
        ],
        listRule: auth,
        viewRule: auth,
        createRule: auth,
        updateRule: auth,
        deleteRule: auth,
      }),
    );
  },
  (app) => {
    for (const name of ['room_items', 'room', 'elements', 'pages', 'nodes']) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
