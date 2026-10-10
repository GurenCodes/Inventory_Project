// tests/run-all.js
// Runs every backend test suite in sequence and exits non-zero if any
// suite fails. The individual suites print ✅/❌ lines; several of them
// historically exited 0 regardless of failures, so this runner both
// checks exit codes AND scans output for failure markers.
//
// Usage: node tests/run-all.js   (or: npm test)

const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  'AuthService.bcrypt.test.js',
  'ProductService.test.js',
  'StockService.test.js',
  'SaleService.test.js',
  'ReportService.test.js',
  'ReportTimezone.test.js',
  'Authorization.test.js',
  'Stage8Api.test.js',
  'Stage9Security.test.js',
  'StockConcurrency.test.js',
  'Regression.test.js',
];

// Markers that indicate a real failure in suite output.
// "❌ FAIL" is printed by the service suites on assertion failure;
// "Total: N passed, M failed" with M > 0 comes from the API suites;
// "PASS (verified in service tests)" is the removed Stage9Security
// placeholder — if it ever reappears in output, the suite is failing its
// duty to assert, so treat it as a failure.
const FAILURE_PATTERNS = [
  /❌/,
  /Total:\s*\d+\s*passed,\s*[1-9]\d*\s*failed/,
  /Traceback|UnhandledPromiseRejection/,
  /PASS \(verified in service tests\)/,
];

let failedSuites = [];

for (const suite of SUITES) {
  const suitePath = path.join(__dirname, suite);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RUNNING: ${suite}`);
  console.log('='.repeat(60));

  const result = spawnSync(process.execPath, [suitePath], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    timeout: 10 * 60 * 1000, // 10 minutes per suite (Aiven DB latency)
  });

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  process.stdout.write(output);

  // A child that failed to spawn, was killed by the timeout, or exited
  // non-zero is a failure. result.status is null on timeout/spawn error.
  const spawnBad = !!result.error || result.status === null;
  const exitBad = spawnBad || result.status !== 0;
  const outputBad = FAILURE_PATTERNS.some((p) => p.test(output));

  if (exitBad || outputBad) {
    const reason = spawnBad
      ? `spawn/timeout error: ${result.error ? result.error.message : 'killed by timeout'}`
      : `exit=${result.status}`;
    console.error(`\n>>> SUITE FAILED: ${suite} (${reason}, failureMarkers=${outputBad})`);
    failedSuites.push(suite);
  } else {
    console.log(`\n>>> Suite passed: ${suite}`);
  }
}

console.log('\n' + '='.repeat(60));
if (failedSuites.length > 0) {
  console.error(`RESULT: ${failedSuites.length} suite(s) FAILED:`);
  failedSuites.forEach((s) => console.error(`  - ${s}`));
  process.exit(1);
} else {
  console.log(`RESULT: all ${SUITES.length} suites passed`);
  process.exit(0);
}
