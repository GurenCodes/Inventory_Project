// Fixture: crash handler that prints an error but exits 0 (old pattern).
// The runner must treat "Test runner crashed:" output as a failure.
console.error('Test runner crashed: Error: boom');
process.exit(0);
