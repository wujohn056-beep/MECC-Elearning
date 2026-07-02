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
  getCurrentClientAppVersion,
  getLatestClientAppVersion,
  isVersionOutdated
} = sandbox.module.exports;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(getCurrentClientAppVersion('android') === '1.0.7', 'Android current version must be 1.0.7');
assert(getCurrentClientAppVersion('web') === '1.0.7', 'Web current version must be 1.0.7');
assert(compareVersions('1.0.7', '1.0.6') === 1, 'Version compare should detect newer patch');
assert(compareVersions('1.0.7', '1.0.7') === 0, 'Version compare should detect equality');
assert(isVersionOutdated('1.0.6', '1.0.7'), '1.0.6 should be outdated against 1.0.7');
assert(!isVersionOutdated('1.0.7', '1.0.6'), '1.0.7 should not be outdated against stale 1.0.6 config');
assert(getLatestClientAppVersion('android') === '1.0.7', 'Missing remote config should fall back to bundled latest');
assert(getLatestClientAppVersion('android', { android_latest: '1.0.6' }) === '1.0.7', 'Stale remote config must not lower bundled latest');
assert(getLatestClientAppVersion('android', { android_latest: '1.0.8' }) === '1.0.8', 'Newer remote config should win');

console.log('App version behavior verified.');
