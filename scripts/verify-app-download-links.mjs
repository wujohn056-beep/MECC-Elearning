import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import vm from 'node:vm';

const source = readFileSync('src/utils/appDownloadLinks.ts', 'utf8');
const compiled = transformSync(source, {
  loader: 'ts',
  format: 'cjs',
  target: 'es2022'
}).code;

const sandbox = {
  exports: {},
  module: { exports: {} },
  window: { location: { origin: 'https://learning.mecloudhub.com' } }
};
vm.runInNewContext(compiled, sandbox);

const {
  DEFAULT_IOS_TESTFLIGHT_URL,
  DEFAULT_ANDROID_APK_PATH,
  getDefaultAndroidApkUrl,
  resolveAppDownloadUrl
} = sandbox.module.exports;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(DEFAULT_IOS_TESTFLIGHT_URL.includes('testflight.apple.com/join/'), 'iOS fallback must be a TestFlight join URL');
assert(!DEFAULT_IOS_TESTFLIGHT_URL.includes('xxxxxx'), 'iOS fallback must not be a placeholder URL');
assert(DEFAULT_ANDROID_APK_PATH === '/downloads/mecc-latest.apk', 'Android fallback path must point to latest APK');
assert(getDefaultAndroidApkUrl() === 'https://learning.mecloudhub.com/downloads/mecc-latest.apk', 'Android default URL must use current origin');
assert(resolveAppDownloadUrl('ios') === DEFAULT_IOS_TESTFLIGHT_URL, 'iOS resolver must use default fallback');
assert(resolveAppDownloadUrl('android') === 'https://learning.mecloudhub.com/downloads/mecc-latest.apk', 'Android resolver must use default APK fallback');
assert(resolveAppDownloadUrl('ios', { ios_testflight_url: 'https://example.com/ios' }) === 'https://example.com/ios', 'iOS resolver must prefer config URL');
assert(resolveAppDownloadUrl('android', { android_apk_url: 'https://example.com/app.apk' }) === 'https://example.com/app.apk', 'Android resolver must prefer config URL');

console.log('App download link behavior verified.');
