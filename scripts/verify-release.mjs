import { existsSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const checks = [];
const addCheck = (name, pass, detail = '') => checks.push({ name, pass, detail });

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const flattenKeys = (obj, prefix = '') => Object.entries(obj).flatMap(([key, value]) => {
  const fullKey = prefix ? `${prefix}.${key}` : key;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? flattenKeys(value, fullKey)
    : [fullKey];
});

const locales = ['zh', 'en', 'ar'];
const localeKeys = Object.fromEntries(locales.map((lang) => [
  lang,
  new Set(flattenKeys(readJson(`src/locales/${lang}.json`)))
]));
const allLocaleKeys = new Set(locales.flatMap((lang) => [...localeKeys[lang]]));
const missingLocaleKeys = locales.flatMap((lang) => (
  [...allLocaleKeys]
    .filter((key) => !localeKeys[lang].has(key))
    .map((key) => `${lang}:${key}`)
));
addCheck('locale key parity', missingLocaleKeys.length === 0, missingLocaleKeys.join(', '));

const apkPath = 'public/downloads/mecc-latest.apk';
const maxGithubBytes = 100 * 1024 * 1024;
if (existsSync(apkPath)) {
  const apkSize = statSync(apkPath).size;
  addCheck('download APK exists', true, `${apkSize} bytes`);
  addCheck('download APK below GitHub hard limit', apkSize < maxGithubBytes, `${apkSize} bytes`);
} else {
  addCheck('download APK exists', false, apkPath);
  addCheck('download APK below GitHub hard limit', false, apkPath);
}

const nativeApkCopies = [
  'android/app/src/main/assets/public/downloads/mecc-latest.apk',
  'ios/App/App/public/downloads/mecc-latest.apk'
];
addCheck(
  'native assets do not embed APK',
  nativeApkCopies.every((path) => !existsSync(path)),
  nativeApkCopies.filter((path) => existsSync(path)).join(', ')
);

const dingtalkCheck = spawnSync(process.execPath, ['--check', 'netlify/functions/dingtalk.js'], {
  encoding: 'utf8'
});
addCheck('dingtalk function syntax', dingtalkCheck.status === 0, dingtalkCheck.stderr.trim());

const criticalLintFiles = [
  'src/components/AppLayout.tsx',
  'src/components/NotificationBell.tsx',
  'src/contexts/AuthContext.tsx',
  'src/pages/Account.tsx',
  'src/pages/LearningHub.tsx',
  'src/pages/TeamTasks.tsx',
  'src/pages/admin/CategoryManager.tsx',
  'src/pages/admin/RecordingsManager.tsx',
  'src/pages/admin/ReferralManager.tsx',
  'src/pages/admin/UserManager.tsx',
  'src/utils/appVersion.ts',
  'src/utils/campaignProgress.ts',
  'src/utils/userIdentity.ts'
];
const criticalLint = spawnSync('npx', [
  'eslint',
  ...criticalLintFiles,
  '--rule',
  '@typescript-eslint/no-explicit-any: off',
  '--rule',
  '@typescript-eslint/no-unused-vars: off',
  '--rule',
  'react-refresh/only-export-components: off',
  '--rule',
  'prefer-const: off',
  '--rule',
  'react-hooks/exhaustive-deps: off',
  '--max-warnings=0'
], {
  encoding: 'utf8',
  shell: process.platform === 'win32'
});
addCheck(
  'critical release files lint',
  criticalLint.status === 0,
  (criticalLint.stdout + criticalLint.stderr).trim().split('\n').slice(0, 12).join(' | ')
);

const sourceAssertions = [
  ['campaign learning route', 'src/pages/LearningHub.tsx', 'campaignLearnId'],
  ['campaign notification route', 'src/components/NotificationBell.tsx', 'campaignLearnId'],
  ['native campaign push route', 'src/components/AppLayout.tsx', 'campaignLearnId'],
  ['task draft autosave', 'src/pages/LearningHub.tsx', 'draftSavedAt'],
  ['effective user id helper', 'src/utils/userIdentity.ts', 'getEffectiveUserId'],
  ['safe native sync script', 'package.json', 'clean-native-download-assets.mjs']
];

for (const [name, path, needle] of sourceAssertions) {
  const content = existsSync(path) ? readFileSync(path, 'utf8') : '';
  addCheck(name, content.includes(needle), `${path} -> ${needle}`);
}

let failed = 0;
for (const check of checks) {
  const status = check.pass ? 'ok' : 'fail';
  console.log(`[${status}] ${check.name}${check.detail ? ` (${check.detail})` : ''}`);
  if (!check.pass) failed += 1;
}

if (failed > 0) {
  console.error(`Release verification failed: ${failed} check(s) failed.`);
  process.exit(1);
}

console.log('Release verification passed.');
