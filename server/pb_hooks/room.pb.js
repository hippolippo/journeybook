/// <reference path="../pb_data/types.d.ts" />

// Journeybook — the room is one shared singleton. The client uses a fixed record
// ID for first-load creation; this guard also blocks a second row created through
// the API or admin UI.
onRecordCreateRequest((e) => {
  if (e.record.collection().name !== 'room') {
    e.next();
    return;
  }
  if ($app.findAllRecords('room').length > 0) {
    throw new BadRequestError('The shared room already exists.');
  }
  e.next();
});
