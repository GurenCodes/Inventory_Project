// Fixture: setup failure swallowed by an old-style catch that exits 0.
// The runner must treat "Setup failed:" output as a failure.
console.log('Setup failed: could not connect');
process.exit(0);
