// tests/runner-utils.js
// Shared failure-detection logic for tests/run-all.js and its self-test.
// Kept dependency-free so RunnerSelfTest can exercise it without a DB.

// Markers that indicate a real failure in suite output even when the suite
// exits 0 (several legacy suites historically always exited 0).
//  - "❌" is printed by every suite on assertion failure.
//  - "Total: N passed, M failed" with M > 0 comes from the API-style suites.
//  - "Setup failed:" / "Test runner crashed:" were previously swallowed by
//    catch handlers that exited 0 — treat them as failures.
//  - "PASS (verified in service tests)" is the removed Stage9Security
//    placeholder; if it reappears, the suite is failing its duty to assert.
//  - "UnhandledPromiseRejection" appears in newer Node crash text.
const FAILURE_PATTERNS = [
  /❌/,
  /Total:\s*\d+\s*passed,\s*[1-9]\d*\s*failed/,
  /Setup failed:/,
  /Test runner crashed:/,
  /Regression suite crashed:/,
  /UnhandledPromiseRejection/,
  /PASS \(verified in service tests\)/,
];

// Decide whether a spawnSync result (plus captured output) is a failure.
// result fields used: error, status, signal. status is null when the child
// was killed by a signal or the timeout, or failed to spawn.
function evaluateSuite(result, output) {
  const text = output || '';
  const spawnBad = !!result.error || result.status === null;
  const outputBad = FAILURE_PATTERNS.some((p) => p.test(text));
  if (spawnBad) {
    const reason = result.error
      ? `spawn error: ${result.error.message}`
      : `killed (${result.signal || 'timeout or signal'})`;
    return { ok: false, reason, failureMarkers: outputBad };
  }
  if (result.status !== 0) {
    return { ok: false, reason: `exit=${result.status}`, failureMarkers: outputBad };
  }
  if (outputBad) {
    return { ok: false, reason: 'exit=0 but failure markers in output', failureMarkers: true };
  }
  return { ok: true, reason: 'clean', failureMarkers: false };
}

// Guard so `npm test` never intentionally targets a production NODE_ENV.
// Individual suites may flip NODE_ENV transiently (e.g. cookie tests) but
// the runner itself must not launch children in production mode.
function assertNotProductionEnv(env) {
  if ((env && env.NODE_ENV) === 'production') {
    throw new Error(
      'Refusing to run tests with NODE_ENV=production. Unset it or run with NODE_ENV=test.'
    );
  }
}

module.exports = { FAILURE_PATTERNS, evaluateSuite, assertNotProductionEnv };
