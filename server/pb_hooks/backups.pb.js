/// <reference path="../pb_data/types.d.ts" />

// Journeybook — scheduled, retained PocketBase backups.
//
// Backups land in pb_data/backups and are the foundation of the off-box flow
// documented in docs/DEPLOYMENT.md. We only set a schedule when none exists, so
// an admin who tuned the schedule in the UI keeps their settings.
const DEFAULT_CRON = '0 3 * * *'; // 03:00 daily
const DEFAULT_KEEP = 14;

onBootstrap((e) => {
  e.next();
  try {
    const settings = $app.settings();
    if (!settings.backups.cron) {
      settings.backups.cron = DEFAULT_CRON;
      settings.backups.cronMaxKeep = DEFAULT_KEEP;
      $app.save(settings);
      $app.logger().info('journeybook: enabled scheduled backups', 'cron', DEFAULT_CRON);
    }
  } catch (err) {
    $app.logger().error('journeybook: failed to configure backups', 'error', String(err));
  }
});
