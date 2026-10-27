// Shared Notes helpers. PocketBase serializes each hook callback in an isolated
// scope, so top-level declarations in a .pb.js file are not visible inside the
// callback. Keep reusable code here and require it from every handler.
const COLLECTION = 'notes';
const EMAIL_COOLDOWN_MS = 15 * 60 * 1000;
const CONTENT_FIELDS = [
  'author',
  'recipient',
  'status',
  'body',
  'paper',
  'paperColor',
  'pageHeight',
  'envelope',
  'sentAt',
];
const AUTHOR_LOCK_FIELDS = [...CONTENT_FIELDS, 'openedAt', 'emailedAt', 'emailLastAttempt'];
const RECIPIENT_LOCK_FIELDS = [
  ...CONTENT_FIELDS,
  'emailedAt',
  'emailLastAttempt',
  'deletedAt',
  'createdAt',
];

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function isNote(record) {
  return !!record && record.collection().name === COLLECTION;
}

function appLink(noteId) {
  const base = ($app.settings().meta.appURL || '').trim().replace(/\/+$/, '');
  const path = `/notes/${noteId}`;
  return base ? base + path : path;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function validateParticipants(record) {
  for (const field of ['author', 'recipient']) {
    const id = record.getString(field);
    if (!id) throw new BadRequestError('A letter needs both people.');
    try {
      $app.findRecordById('users', id);
    } catch (err) {
      throw new BadRequestError('A letter references a missing account.');
    }
  }
}

function sendNotification(record) {
  if (!isNote(record)) return;
  if (record.getString('status') !== 'sent') return;
  if (Number(record.get('deletedAt') || 0) > 0) return;
  if (Number(record.get('emailedAt') || 0) > 0) return;
  if (!record.getString('recipient')) return;

  const lastAttempt = Number(record.get('emailLastAttempt') || 0);
  if (lastAttempt && Date.now() - lastAttempt < EMAIL_COOLDOWN_MS) return;

  let recipient;
  let author;
  try {
    recipient = $app.findRecordById('users', record.getString('recipient'));
    author = $app.findRecordById('users', record.getString('author'));
  } catch (err) {
    $app.logger().warn('journeybook: note recipients missing', 'note', record.id);
    return;
  }
  if (!recipient || !recipient.email()) return;

  const senderName = (author && author.getString('name')) || 'your person';
  const recipientName = recipient.getString('name') || 'you';
  const link = appLink(record.id);
  const settings = $app.settings().meta;
  const message = new MailerMessage({
    from: {
      address: settings.senderAddress,
      name: settings.senderName || 'Journeybook',
    },
    to: [{ address: recipient.email() }],
    subject: 'A letter from ' + senderName,
    html:
      '<div style="font-family:Georgia,serif;color:#4a3b2e;line-height:1.5">' +
      '<p>' +
      escapeHtml(recipientName) +
      ',</p>' +
      '<p>' +
      escapeHtml(senderName) +
      ' sealed a letter for you.</p>' +
      '<p><a href="' +
      escapeHtml(link) +
      '" style="color:#8a3b3b">Open your letter</a></p>' +
      '<p style="color:#9a8770;font-size:13px">Journeybook · our little room</p>' +
      '</div>',
  });

  record.set('emailLastAttempt', Date.now());
  try {
    $app.newMailClient().send(message);
    record.set('emailedAt', Date.now());
    $app.save(record);
  } catch (err) {
    try {
      $app.save(record);
    } catch (saveErr) {
      $app
        .logger()
        .error(
          'journeybook: note email retry timestamp failed',
          'note',
          record.id,
          'error',
          String(saveErr),
        );
    }
    $app.logger().error('journeybook: note email failed', 'note', record.id, 'error', String(err));
  }
}

function validateUpdate(record, original, auth) {
  if (!auth || !original.id) return;
  const author = original.getString('author');
  const recipient = original.getString('recipient');
  const changed = (field) => stable(record.get(field)) !== stable(original.get(field));
  const onlyTrash =
    changed('deletedAt') &&
    !CONTENT_FIELDS.some(changed) &&
    !AUTHOR_LOCK_FIELDS.some((field) => field !== 'deletedAt' && changed(field));
  if (onlyTrash) {
    if (!author || !recipient) {
      if (auth.id !== author && auth.id !== recipient) {
        throw new BadRequestError('Only a participant may move a letter to the trash.');
      }
    } else if (auth.id !== author) {
      throw new BadRequestError('Only the author may move a letter to the trash.');
    }
    return;
  }

  validateParticipants(record);
  if (auth.id === recipient && auth.id !== author) {
    for (const field of RECIPIENT_LOCK_FIELDS) {
      if (changed(field)) {
        throw new BadRequestError('The recipient may only record that a letter was opened.');
      }
    }
  }
  if (auth.id === author && Number(original.get('openedAt') || 0) > 0) {
    for (const field of AUTHOR_LOCK_FIELDS) {
      if (changed(field)) {
        throw new BadRequestError('This letter is sealed; it can no longer be edited.');
      }
    }
  }
}

module.exports = {
  isNote,
  sendNotification,
  validateParticipants,
  validateUpdate,
};
