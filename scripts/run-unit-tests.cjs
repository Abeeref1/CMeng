const {readdirSync} = require('node:fs');
const {join, relative} = require('node:path');
const {spawnSync} = require('node:child_process');

const testRoot = join(__dirname, '..', 'dist', 'tests');
function discover(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? discover(path) :
      entry.isFile() && entry.name.endsWith('.test.js') && !entry.name.endsWith('-scale.test.js') ? [path] : [];
  });
}
const tests = discover(testRoot).sort();
const acceptanceName = 'j8-final-blind-release-acceptance.test.js';
const acceptance = tests.filter(path => relative(testRoot, path) === acceptanceName);
if (acceptance.length !== 1) throw new Error('The mandatory 100-project blind acceptance suite must exist exactly once.');
const regression = tests.filter(path => !acceptance.includes(path));

// Keep the full test population and each suite's deadlines. The 100-project
// benchmark already exercises its own four-worker gateway and concurrent
// requests. Running unrelated heavy suites beside it measures runner contention
// on the two-CPU CI host rather than that bounded system workload.
for (const [label, files] of [['regression and feature cohorts', regression], ['isolated 100-project blind acceptance', acceptance]]) {
  process.stdout.write('\nCMENG_UNIT_PHASE=' + label + '; files=' + files.length + '\n');
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=4', ...files], {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.signal) throw new Error('Test phase terminated by ' + result.signal);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
