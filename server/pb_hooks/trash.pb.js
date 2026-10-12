/// <reference path="../pb_data/types.d.ts" />

// Journeybook — automatically purge trash older than the retention window.
// Anyone can restore a deleted item from Settings → Trash until it ages out.
const RETENTION_DAYS = 30;

onBootstrap((e) => {
  e.next();
  cronAdd('journeybook-trash-purge', '0 4 * * *', () => {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let groups = [];
    try {
      groups = $app.findAllRecords('trash');
    } catch (err) {
      return;
    }
    for (const group of groups) {
      const deletedAt = group.getNumber('deletedAt');
      if (!deletedAt || deletedAt > cutoff) continue;
      let refs = [];
      try {
        refs = group.get('records') || [];
      } catch (err) {
        refs = [];
      }
      for (const ref of refs) {
        try {
          const record = $app.findRecordById(ref.collection, ref.id);
          if (record) $app.delete(record);
        } catch (err) {
          /* already gone */
        }
      }
      try {
        $app.delete(group);
      } catch (err) {
        /* already gone */
      }
    }
  });
});
