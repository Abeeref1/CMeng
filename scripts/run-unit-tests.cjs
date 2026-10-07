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
const raster = tests.filter(path => relative(testRoot, path) === 'boq-raster-recovery.test.js');
if (raster.length !== 1) throw new Error('The retained scan regression suite must exist exactly once.');
const regression = tests.filter(path => !acceptance.includes(path) && !raster.includes(path));

// Keep the full test population and each suite's deadlines. Original-page
// OCR is CPU intensive and hit its unchanged deadline beside other suites;
// run that complete file in its own phase. The 100-project benchmark already exercises its own four-worker gateway and concurrent
// requests. Running unrelated heavy suites beside it measures runner contention
// on the two-CPU CI host rather than that bounded system workload.
const phases = [
  ['regression', 'regression and feature cohorts', regression],
  ['raster', 'isolated original-page raster regressions', raster],
  ['acceptance', 'isolated 100-project blind acceptance', acceptance],
];
const selectedPhase = process.argv[2];
if (process.argv.length > 3 || (selectedPhase && !phases.some(([key]) => key === selectedPhase))) {
  throw new Error('Optional phase must be regression, raster or acceptance; omitting it runs every mandatory phase.');
}
for (const [key, label, files] of phases) {
  if (selectedPhase && key !== selectedPhase) continue;
  process.stdout.write('\nCMENG_UNIT_PHASE=' + label + '; files=' + files.length + '\n');
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=4', ...files], {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.signal) throw new Error('Test phase terminated by ' + result.signal);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
