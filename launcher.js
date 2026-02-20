const { spawn } = require('child_process');

// Launcher: starts the Electron app and restarts it when the child exits
// unexpectedly (non-zero exit). If the app exits with code 0 (graceful
// shutdown), the launcher will not restart it.

const RESTART_DELAY_MS = 2000;

function startApp() {
  console.log('[launcher] Starting Electron app...');

  // Use npx so the locally installed electron binary is used in dev.
  // Spawn via shell so this works cross-platform.
  const child = spawn('npx electron .', { shell: true, stdio: 'inherit' });

  child.on('exit', (code, signal) => {
    console.log(`[launcher] Child exited. code=${code} signal=${signal}`);

    // If child exited with code === 0, assume graceful shutdown requested
    // and do not restart. Otherwise, restart after a short delay.
    if (code === 0) {
      console.log('[launcher] Graceful exit detected (code 0). Launcher exiting.');
      process.exit(0);
    }

    console.log(`[launcher] Unexpected exit, restarting in ${RESTART_DELAY_MS}ms...`);
    setTimeout(startApp, RESTART_DELAY_MS);
  });

  child.on('error', (err) => {
    console.error('[launcher] Failed to start child process:', err);
    setTimeout(startApp, RESTART_DELAY_MS);
  });

  // Make sure launcher cleans up child on signals
  const cleanup = () => {
    try { child.kill(); } catch (e) { }
    process.exit();
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startApp();
