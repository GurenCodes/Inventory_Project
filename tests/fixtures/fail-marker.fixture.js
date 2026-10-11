// Fixture: legacy-suite shape — prints a failure marker but exits 0.
// The runner must still count this as a failure (output scan).
console.log('❌ some assertion failed');
process.exit(0);
