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

const requiredLocaleKeys = [
  'navbar.download_app',
  'download_page.android_btn',
  'download_page.android_desc',
  'download_page.ios_btn',
  'update_modal.btn_update',
  'team_tasks.fcm_push_error',
  'team_tasks.fcm_apns_auth_error',
  'team_tasks.notification_error',
  'learning_hub.category_recordings_count',
  'learning_hub.task_resume_notice'
];
const missingRequiredLocaleKeys = locales.flatMap((lang) => (
  requiredLocaleKeys
    .filter((key) => !localeKeys[lang].has(key))
    .map((key) => `${lang}:${key}`)
));
addCheck('critical trilingual keys', missingRequiredLocaleKeys.length === 0, missingRequiredLocaleKeys.join(', '));

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
  'src/hooks/usePushNotifications.ts',
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
  ['campaign learning route', 'src/pages/LearningHub.tsx', ['campaignLearnId']],
  ['campaign go learn opens challenge page', 'src/pages/LearningHub.tsx', ['openCampaignLearningTarget', "newParams.set('campaignLearnId', campaign.id)", "newParams.delete('taskId')"]],
  ['campaign focused view has trilingual fallback copy', 'src/pages/LearningHub.tsx', ['learning_hub.go_learn', 'campaign.back_to_challenge', 'campaign.challenge_label']],
  ['task category grouping follows configured category order', 'src/pages/LearningHub.tsx', ['taskRecordingGroups', 'categoryOrderById', 'categoryOrderByName', 'a.categoryOrder - b.categoryOrder']],
  ['task focused view renders category sections', 'src/pages/LearningHub.tsx', ['taskRecordingGroups.map(group', 'learning_hub.category_recordings_count']],
  ['campaign notification route', 'src/components/NotificationBell.tsx', ['campaignLearnId']],
  ['notification identity uses effective uid helper', 'src/components/NotificationBell.tsx', ['getEffectiveUserId', "where('assigneeIds', 'array-contains', myUid)", '[`assignees.${myUid}.read`]']],
  ['task notifications reopen incomplete work', 'src/components/NotificationBell.tsx', ['isIncompleteTask', 'tasks.filter(isIncompleteTask)', 'navigate(`/hub?taskId=${task.id}`)']],
  ['account task list keeps in-progress tasks visible', 'src/pages/Account.tsx', ['isTaskIncomplete', 'matchesTaskTab', "task.myStatus !== 'completed'"]],
  ['native campaign push route', 'src/components/AppLayout.tsx', ['campaignLearnId']],
  ['campaign push payload includes campaign id', 'src/pages/admin/CampaignManager.tsx', ["action: 'notifyCampaign'", 'campaignId: campaignId']],
  ['campaign push function forwards campaign id', 'netlify/functions/dingtalk.js', ['notifyCampaign', 'campaignId', "type: 'campaign'"]],
  ['task draft autosave', 'src/pages/LearningHub.tsx', ['draftSavedAt']],
  ['effective user id helper', 'src/utils/userIdentity.ts', ['getEffectiveUserId']],
  ['app download page uses latest APK', 'src/pages/DownloadPage.tsx', ['mecc-latest.apk', 'download_page.android_btn', 'download_page.ios_btn']],
  ['app version update gate exists', 'src/utils/appVersion.ts', ['CLIENT_APP_VERSIONS', 'isVersionOutdated']],
  ['task push fallback messaging', 'src/pages/TeamTasks.tsx', ['getFcmFailureMessage', 'third-party-auth-error', 'fcm_apns_auth_error', 'fcm_push_error']],
  ['safe native sync script', 'package.json', ['clean-native-download-assets.mjs']]
];

for (const [name, path, needles] of sourceAssertions) {
  const content = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const missingNeedles = needles.filter((needle) => !content.includes(needle));
  addCheck(name, missingNeedles.length === 0, missingNeedles.length > 0 ? `${path} missing ${missingNeedles.join(', ')}` : path);
}

const forbiddenSourceAssertions = [
  ['legacy noop native push action listener removed', 'src/hooks/usePushNotifications.ts', ['pushNotificationActionPerformed']]
];

for (const [name, path, needles] of forbiddenSourceAssertions) {
  const content = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const foundNeedles = needles.filter((needle) => content.includes(needle));
  addCheck(name, foundNeedles.length === 0, foundNeedles.length > 0 ? `${path} still contains ${foundNeedles.join(', ')}` : path);
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
