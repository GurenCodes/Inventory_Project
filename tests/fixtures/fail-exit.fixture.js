// Fixture: a suite that exits non-zero. The runner must count this as a failure.
console.log('something went wrong');
process.exit(1);
