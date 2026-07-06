import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const page = read('src/pages/admin/AppReleaseManager.tsx');
const app = read('src/App.tsx');
const layout = read('src/components/AdminLayout.tsx');

[
  'system_config',
  'app_versions',
  'android_latest',
  'ios_latest',
  'web_latest',
  'android_latest_build',
  'ios_latest_build',
  'web_latest_build',
  'min_required_version',
  'android_apk_url',
  'ios_testflight_url',
  'setDoc',
  'serverTimestamp'
].forEach(token => {
  assert(page.includes(token), `App release manager must include ${token}`);
});

assert(app.includes('AppReleaseManager'), 'Admin app release route must import AppReleaseManager');
assert(app.includes('path="app-release"'), 'Admin app release route must be registered');
assert(layout.includes('/admin/app-release'), 'Admin sidebar must link to app release settings');
assert(layout.includes('isSuperAdmin'), 'App release sidebar entry must remain super admin scoped');

const locales = ['zh', 'en', 'ar'].map(lang => ({
  lang,
  data: JSON.parse(read(`src/locales/${lang}.json`))
}));

[
  'badge',
  'title',
  'subtitle',
  'load_error',
  'save_success',
  'save_error',
  'android_latest',
  'ios_latest',
  'web_latest',
  'android_latest_build',
  'ios_latest_build',
  'web_latest_build',
  'min_required_version',
  'min_required_placeholder',
  'min_required_hint',
  'android_url',
  'ios_url',
  'checklist_title',
  'checklist_body',
  'open_download'
].forEach(key => {
  locales.forEach(({ lang, data }) => {
    assert(data.admin_menu?.app_release, `${lang} admin menu app_release key is missing`);
    assert(data.app_release?.[key], `${lang} app_release.${key} is missing`);
  });
});

console.log('App release configuration admin behavior verified.');
