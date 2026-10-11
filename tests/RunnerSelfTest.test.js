// tests/RunnerSelfTest.test.js
// Proves tests/run-all.js failure detection actually works, using small
// fixture processes (tests/fixtures/*.fixture.js) and the shared
// evaluateSuite() helper. No database access — safe to run anywhere.
//
// Covered (K15):
//  - a clean suite is counted as a pass
//  - non-zero exit is a failure
//  - failure markers in output are a failure even when exit is 0
//  - "Setup failed:" / "Test runner crashed:" output is a failure
//  - a spawn error (missing file) is a failure
//  - a timed-out suite is a failure
//  - assertNotProductionEnv rejects NODE_ENV=production

const { spawnSync } = require('child_process');
const path = require('path');
const { evaluateSuite, assertNotProductionEnv } = require('./runner-utils');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`);
  }
}

function runFixture(name, timeout = 10000) {
  return spawnSync(process.execPath, [path.join(__dirname, 'fixtures', name)], {
    encoding: 'utf8',
    timeout,
  });
}

function verdictOf(name, timeout = 10000) {
  const result = runFixture(name, timeout);
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  return evaluateSuite(result, output);
}

async function main() {
  console.log('\n========== Runner Self-Test ==========\n');

  console.log('--- evaluateSuite on real fixture processes ---');
  const pass = verdictOf('pass.fixture.js');
  assert(pass.ok === true, `clean suite -> pass (got ok=${pass.ok}, ${pass.reason})`);

  const failExit = verdictOf('fail-exit.fixture.js');
  assert(failExit.ok === false && /exit=1/.test(failExit.reason), `exit 1 -> fail (got ${failExit.reason})`);

  const failMarker = verdictOf('fail-marker.fixture.js');
  assert(failMarker.ok === false && failMarker.failureMarkers === true,
    `marker with exit 0 -> fail (got ${failMarker.reason})`);

  const setupFail = verdictOf('setup-fail.fixture.js');
  assert(setupFail.ok === false && setupFail.failureMarkers === true,
    `setup-fail marker with exit 0 -> fail (got ${setupFail.reason})`);

  const crash = verdictOf('crash.fixture.js');
  assert(crash.ok === false && crash.failureMarkers === true,
    `crash-marker with exit 0 -> fail (got ${crash.reason})`);

  // Missing suite file: spawn error must be a failure, never a pass.
  const missing = spawnSync(process.execPath, [path.join(__dirname, 'fixtures', 'does-not-exist.fixture.js')], {
    encoding: 'utf8',
    timeout: 10000,
  });
  const missingVerdict = evaluateSuite(missing, `${missing.stdout || ''}\n${missing.stderr || ''}`);
  assert(missingVerdict.ok === false, `missing suite file -> fail (got ${missingVerdict.reason})`);

  // Timeout: hang fixture runs 60s of busy-wait; kill it at 500ms.
  const hung = runFixture('hang.fixture.js', 500);
  const hungVerdict = evaluateSuite(hung, `${hung.stdout || ''}\n${hung.stderr || ''}`);
  assert(hungVerdict.ok === false, `timed-out suite -> fail (got ${hungVerdict.reason})`);

  console.log('\n--- evaluateSuite on synthetic spawnSync shapes ---');
  const signalKill = evaluateSuite({ error: null, status: null, signal: 'SIGKILL' }, '');
  assert(signalKill.ok === false, 'signal-killed child (status null) -> fail');

  const spawnErr = evaluateSuite({ error: new Error('ENOENT'), status: null, signal: null }, '');
  assert(spawnErr.ok === false && /spawn error/.test(spawnErr.reason), 'spawn error -> fail with spawn reason');

  const clean = evaluateSuite({ error: null, status: 0, signal: null }, '✅ all good');
  assert(clean.ok === true, 'status 0 without markers -> pass');

  const statusOnly = evaluateSuite({ error: null, status: 2, signal: null }, 'Total: 5 passed, 1 failed');
  assert(statusOnly.ok === false, 'non-zero status -> fail even without output markers');

  console.log('\n--- NODE_ENV guard ---');
  let guardThrew = false;
  try {
    assertNotProductionEnv({ NODE_ENV: 'production' });
  } catch (e) {
    guardThrew = /Refusing to run tests/.test(e.message);
  }
  assert(guardThrew, 'assertNotProductionEnv rejects NODE_ENV=production');
  let guardOk = true;
  try {
    assertNotProductionEnv({ NODE_ENV: 'test' });
  } catch (e) {
    guardOk = false;
  }
  assert(guardOk, 'assertNotProductionEnv accepts NODE_ENV=test');

  console.log('\n========== Runner Self-Test Summary ==========');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('❌ Runner self-test crashed:', e);
  process.exit(1);
});
