// Fixture: hangs past the runner timeout so the timeout path is exercised.
const end = Date.now() + 60000;
while (Date.now() < end) { /* busy wait; no timers to flush */ }
process.exit(0);
