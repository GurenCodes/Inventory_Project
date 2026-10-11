// tests/run-all.js
// Runs every backend test suite in sequence and exits non-zero if any
// suite fails. The individual suites print ✅/❌ lines; several of them
// historically exited 0 regardless of failures, so this runner both
// checks exit codes AND scans output for failure markers
// (see tests/runner-utils.js; exercised by tests/RunnerSelfTest.test.js).
//
// Usage: node tests/run-all.js   (or: npm test)

require('dotenv').config();

const { spawnSync } = require('child_process');
const path = require('path');
const { evaluateSuite, assertNotProductionEnv } = require('./runner-utils');

const SUITES = [
  'RunnerSelfTest.test.js',
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

try {
  assertNotProductionEnv(process.env);
} catch (e) {
  console.error(`FATAL: ${e.message}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set (expected in repo-root .env).');
  process.exit(1);
}

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
    // Force NODE_ENV=test for children so a production shell (e.g. a Render
    // host) cannot leak production cookie/rate-limit behavior into tests.
    env: { ...process.env, NODE_ENV: 'test' },
  });

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  process.stdout.write(output);

  const verdict = evaluateSuite(result, output);
  if (!verdict.ok) {
    console.error(`\n>>> SUITE FAILED: ${suite} (${verdict.reason}, failureMarkers=${verdict.failureMarkers})`);
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
