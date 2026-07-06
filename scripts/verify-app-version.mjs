import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import vm from 'node:vm';

const source = readFileSync('src/utils/appVersion.ts', 'utf8');
const compiled = transformSync(source, {
  loader: 'ts',
  format: 'cjs',
  target: 'es2022'
}).code;

const sandbox = {
  exports: {},
  module: { exports: {} }
};
vm.runInNewContext(compiled, sandbox);

const {
  compareVersions,
  formatClientRelease,
  getCurrentClientAppBuild,
  getCurrentClientAppVersion,
  getLatestClientAppBuild,
  getLatestClientAppVersion,
  isClientAppOutdated,
  isClientReleaseOutdated,
  isVersionOutdated
} = sandbox.module.exports;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(getCurrentClientAppVersion('android') === '1.0.7', 'Android current version must be 1.0.7');
assert(getCurrentClientAppVersion('web') === '1.0.7', 'Web current version must be 1.0.7');
assert(getCurrentClientAppBuild('ios') === 8, 'iOS current build must be 8');
assert(getCurrentClientAppBuild('android') === 7, 'Android current build must be 7');
assert(compareVersions('1.0.7', '1.0.6') === 1, 'Version compare should detect newer patch');
assert(compareVersions('1.0.7', '1.0.7') === 0, 'Version compare should detect equality');
assert(isVersionOutdated('1.0.6', '1.0.7'), '1.0.6 should be outdated against 1.0.7');
assert(!isVersionOutdated('1.0.7', '1.0.6'), '1.0.7 should not be outdated against stale 1.0.6 config');
assert(getLatestClientAppVersion('android') === '1.0.7', 'Missing remote config should fall back to bundled latest');
assert(getLatestClientAppVersion('android', { android_latest: '1.0.6' }) === '1.0.7', 'Stale remote config must not lower bundled latest');
assert(getLatestClientAppVersion('android', { android_latest: '1.0.8' }) === '1.0.8', 'Newer remote config should win');
assert(getLatestClientAppBuild('ios', { ios_latest: '1.1', ios_latest_build: 9 }) === 9, 'Same iOS version with newer build should win');
assert(getLatestClientAppBuild('ios', { ios_latest: '1.1', ios_latest_build: 7 }) === 8, 'Stale iOS build must not lower bundled build');
assert(isClientReleaseOutdated('ios', '1.1', '1.1', 7, 8), 'Same iOS version with lower build should be outdated');
assert(!isClientReleaseOutdated('ios', '1.1', '1.1', 8, 8), 'Same iOS version and build should be current');
assert(isClientAppOutdated('ios', '1.1', { ios_latest: '1.1', ios_latest_build: 9 }, 8), 'Remote same-version newer iOS build should trigger update');
assert(formatClientRelease('ios', '1.1', 8) === '1.1 (8)', 'Native release label should include build number');

console.log('App version behavior verified.');
