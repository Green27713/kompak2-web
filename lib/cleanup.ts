import { exec } from 'child_process';

// Delete job and upload directories older than 60 minutes.
// Uses find -mmin +60 so only directories whose mtime is > 60 min ago are removed.
function runCleanup() {
  const cmds = [
    `find /tmp/jobs -maxdepth 1 -mindepth 1 -mmin +60 -exec rm -rf {} +`,
    `find /tmp/uploads -maxdepth 1 -mindepth 1 -mmin +60 -exec rm -rf {} +`,
  ];
  for (const cmd of cmds) {
    exec(cmd, (err) => {
      if (err && !err.message.includes('No such file')) {
        console.error('[cleanup] error:', err.message);
      }
    });
  }
}

// Run once at startup, then every 10 minutes
let started = false;
export function startCleanupScheduler() {
  if (started) return;
  started = true;
  runCleanup();
  setInterval(runCleanup, 10 * 60 * 1000);
}
