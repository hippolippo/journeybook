/// <reference path="../pb_data/types.d.ts" />

// Journeybook — notes notification email and per-field update guard.
//
// PocketBase serializes each hook callback into an isolated scope; shared code
// lives in notes-lib.js and is required inside every callback.
//
// Sending is best-effort: a letter is never blocked by a mail failure. SMTP is
// configured in PocketBase's admin settings; the public app URL is used for the
// deep link and should be set in Settings → Application URL.
//
// Recipients may update a sent note only to record openedAt. The author's
// "editable until opened" lock is enforced in the update guard as well.

onRecordCreateRequest((e) => {
  const notes = require(`${__hooks}/notes-lib.js`);
  if (notes.isNote(e.record)) notes.validateParticipants(e.record);
  e.next();
}, 'notes');

onRecordAfterCreateSuccess((e) => {
  require(`${__hooks}/notes-lib.js`).sendNotification(e.record);
}, 'notes');

onRecordAfterUpdateSuccess((e) => {
  require(`${__hooks}/notes-lib.js`).sendNotification(e.record);
}, 'notes');

onRecordUpdateRequest((e) => {
  const notes = require(`${__hooks}/notes-lib.js`);
  const record = e.record;
  if (!notes.isNote(record)) {
    e.next();
    return;
  }
  notes.validateUpdate(record, record.original(), e.auth);
  e.next();
}, 'notes');

onBootstrap((e) => {
  e.next();
  cronAdd('journeybook-note-email-retry', '*/15 * * * *', () => {
    const notes = require(`${__hooks}/notes-lib.js`);
    let records = [];
    try {
      records = $app.findAllRecords('notes');
    } catch (err) {
      return;
    }
    for (const note of records) {
      try {
        notes.sendNotification(note);
      } catch (err) {
        $app.logger().error('journeybook: note email retry failed', 'note', note.id, String(err));
      }
    }
  });
});
