/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const auth = '@request.auth.id != ""';
    // Drafts are private to their author. Sent letters are shared by both users,
    // while the recipient still needs update access to record openedAt.
    const canRead =
      auth + ' && (author = @request.auth.id || (status = "sent" && recipient = @request.auth.id))';
    const canUpdate =
      auth + ' && (author = @request.auth.id || (status = "sent" && recipient = @request.auth.id))';
    app.save(
      new Collection({
        type: 'base',
        name: 'notes',
        fields: [
          { name: 'author', type: 'text', max: 20 },
          { name: 'recipient', type: 'text', max: 20 },
          { name: 'status', type: 'text', max: 10 },
          { name: 'body', type: 'json' },
          { name: 'paper', type: 'text', max: 40 },
          { name: 'paperColor', type: 'text', max: 20 },
          { name: 'pageHeight', type: 'number' },
          { name: 'envelope', type: 'json' },
          { name: 'createdAt', type: 'number' },
          { name: 'updatedAt', type: 'number' },
          { name: 'sentAt', type: 'number' },
          { name: 'openedAt', type: 'number' },
          { name: 'emailedAt', type: 'number' },
          { name: 'deletedAt', type: 'number' },
        ],
        listRule: canRead,
        viewRule: canRead,
        createRule: auth + ' && @request.auth.id = author',
        updateRule: canUpdate,
        deleteRule: auth + ' && author = @request.auth.id',
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('notes'));
  },
);
