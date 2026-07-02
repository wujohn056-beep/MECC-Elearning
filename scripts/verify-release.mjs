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
const minApkBytes = 10 * 1024 * 1024;
const maxGithubBytes = 100 * 1024 * 1024;
if (existsSync(apkPath)) {
  const apkSize = statSync(apkPath).size;
  addCheck('download APK exists', true, `${apkSize} bytes`);
  addCheck('download APK above minimum plausible size', apkSize >= minApkBytes, `${apkSize} bytes`);
  addCheck('download APK below GitHub hard limit', apkSize < maxGithubBytes, `${apkSize} bytes`);
} else {
  addCheck('download APK exists', false, apkPath);
  addCheck('download APK above minimum plausible size', false, apkPath);
  addCheck('download APK below GitHub hard limit', false, apkPath);
}

const apkWebAssetsCheck = spawnSync(process.execPath, ['scripts/verify-apk-web-assets.mjs'], {
  encoding: 'utf8'
});
addCheck(
  'download APK contains current web assets',
  apkWebAssetsCheck.status === 0,
  (apkWebAssetsCheck.stdout + apkWebAssetsCheck.stderr).trim()
);

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

const releaseWorkflowCheck = spawnSync(process.execPath, ['scripts/verify-release-workflow.mjs'], {
  encoding: 'utf8'
});
addCheck(
  'release workflow behavior',
  releaseWorkflowCheck.status === 0,
  (releaseWorkflowCheck.stdout + releaseWorkflowCheck.stderr).trim()
);

const taskRecordingGroupsCheck = spawnSync(process.execPath, ['scripts/verify-task-recording-groups.mjs'], {
  encoding: 'utf8'
});
addCheck(
  'task recording group behavior',
  taskRecordingGroupsCheck.status === 0,
  (taskRecordingGroupsCheck.stdout + taskRecordingGroupsCheck.stderr).trim()
);

const learningRoutesCheck = spawnSync(process.execPath, ['scripts/verify-learning-routes.mjs'], {
  encoding: 'utf8'
});
addCheck(
  'learning route behavior',
  learningRoutesCheck.status === 0,
  (learningRoutesCheck.stdout + learningRoutesCheck.stderr).trim()
);

const appDownloadLinksCheck = spawnSync(process.execPath, ['scripts/verify-app-download-links.mjs'], {
  encoding: 'utf8'
});
addCheck(
  'app download link behavior',
  appDownloadLinksCheck.status === 0,
  (appDownloadLinksCheck.stdout + appDownloadLinksCheck.stderr).trim()
);

const appVersionCheck = spawnSync(process.execPath, ['scripts/verify-app-version.mjs'], {
  encoding: 'utf8'
});
addCheck(
  'app version behavior',
  appVersionCheck.status === 0,
  (appVersionCheck.stdout + appVersionCheck.stderr).trim()
);

const appReleaseConfigCheck = spawnSync(process.execPath, ['scripts/verify-app-release-config.mjs'], {
  encoding: 'utf8'
});
addCheck(
  'app release config admin behavior',
  appReleaseConfigCheck.status === 0,
  (appReleaseConfigCheck.stdout + appReleaseConfigCheck.stderr).trim()
);

const manualQaEvidenceCheck = spawnSync(process.execPath, ['scripts/verify-manual-qa-evidence.mjs'], {
  encoding: 'utf8'
});
addCheck(
  'manual QA evidence generator behavior',
  manualQaEvidenceCheck.status === 0,
  (manualQaEvidenceCheck.stdout + manualQaEvidenceCheck.stderr).trim()
);

const manualQaEvidenceValidatorCheck = spawnSync(process.execPath, ['scripts/verify-manual-qa-evidence-validator.mjs'], {
  encoding: 'utf8'
});
addCheck(
  'manual QA evidence validator behavior',
  manualQaEvidenceValidatorCheck.status === 0,
  (manualQaEvidenceValidatorCheck.stdout + manualQaEvidenceValidatorCheck.stderr).trim()
);

const manualQaTemplateSyncCheck = spawnSync(process.execPath, ['scripts/verify-manual-qa-template-sync.mjs'], {
  encoding: 'utf8'
});
addCheck(
  'manual QA template sync behavior',
  manualQaTemplateSyncCheck.status === 0,
  (manualQaTemplateSyncCheck.stdout + manualQaTemplateSyncCheck.stderr).trim()
);

const dingtalkPushPayloadsCheck = spawnSync(process.execPath, ['scripts/verify-dingtalk-push-payloads.mjs'], {
  encoding: 'utf8'
});
addCheck(
  'dingtalk push payload behavior',
  dingtalkPushPayloadsCheck.status === 0,
  (dingtalkPushPayloadsCheck.stdout + dingtalkPushPayloadsCheck.stderr).trim().split('\n').slice(-4).join(' | ')
);

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
  'src/utils/appDownloadLinks.ts',
  'src/utils/appVersion.ts',
  'src/utils/campaignProgress.ts',
  'src/utils/learningRoutes.ts',
  'src/utils/taskRecordingGroups.ts',
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
  ['campaign go learn opens challenge page', 'src/pages/LearningHub.tsx', ['openCampaignLearningTarget', 'buildLearningSearchParams', "type: 'campaign'", 'campaignId: campaign.id']],
  ['campaign focused view has trilingual fallback copy', 'src/pages/LearningHub.tsx', ['learning_hub.go_learn', 'campaign.back_to_challenge', 'campaign.challenge_label']],
  ['recording card opens focused route through shared helper', 'src/pages/LearningHub.tsx', ["type: 'recording'", 'recordingId: rec.id', 'buildLearningSearchParams']],
  ['central learning route builder', 'src/utils/learningRoutes.ts', ['buildLearningRoute', 'buildLearningSearchParams', 'focusedRouteParams', "params.set('campaignLearnId', target.campaignId)", "params.set('taskId', target.taskId)", "params.set('recordingId', target.recordingId)"]],
  ['task category grouping follows configured category order', 'src/utils/taskRecordingGroups.ts', ['getTaskRecordingGroups', 'categoryOrderById', 'categoryOrderByName', 'a.categoryOrder - b.categoryOrder']],
  ['task focused view renders category sections', 'src/pages/LearningHub.tsx', ['taskRecordingGroups.map(group', 'learning_hub.category_recordings_count']],
  ['campaign notification route', 'src/components/NotificationBell.tsx', ['buildLearningRoute', "type: 'campaign'", 'campaignId: notif.campaignId']],
  ['notification identity uses effective uid helper', 'src/components/NotificationBell.tsx', ['getEffectiveUserId', "where('assigneeIds', 'array-contains', myUid)", '[`assignees.${myUid}.read`]']],
  ['task notifications reopen incomplete work', 'src/components/NotificationBell.tsx', ['isIncompleteTask', 'tasks.filter(isIncompleteTask)', "buildLearningRoute({ type: 'task', taskId: task.id })"]],
  ['account task list keeps in-progress tasks visible', 'src/pages/Account.tsx', ['isTaskIncomplete', 'matchesTaskTab', "task.myStatus !== 'completed'"]],
  ['account learning links use shared route builder', 'src/pages/Account.tsx', ['buildLearningRoute', "type: 'task'", 'taskId: task.id', "type: 'recording'", 'recordingId: rec.id']],
  ['native recording push route', 'src/components/AppLayout.tsx', ["type === 'recording'", 'data.recordingId', "buildLearningRoute({ type: 'recording'"]],
  ['native task push route', 'src/components/AppLayout.tsx', ["type === 'task'", 'data.taskId', "buildLearningRoute({ type: 'task'"]],
  ['native campaign push route', 'src/components/AppLayout.tsx', ["type === 'campaign'", 'data.campaignId', "buildLearningRoute({ type: 'campaign'"]],
  ['user language preference syncs for trilingual push targeting', 'src/components/AppLayout.tsx', ['normalizeAppLanguage', 'persistUserLanguage', 'preferredLanguage', 'languageUpdatedAt', 'const languageUpdates', 'updateProfile(languageUpdates)', 'setDoc(doc(db, \'users\', targetUid)']],
  ['new user profiles default language for push targeting', 'src/pages/admin/UserManager.tsx', ['DEFAULT_USER_LANGUAGE', 'preferredLanguage', 'uiLanguage']],
  ['test login profile stores language for push targeting', 'src/pages/Login.tsx', ['preferredLanguage: i18n.language', 'uiLanguage: i18n.language']],
  ['task push payload includes task id', 'src/pages/TeamTasks.tsx', ["action: 'notifyTask'", 'taskId: docRef.id']],
  ['task push function forwards task id', 'netlify/functions/dingtalk.js', ['notifyTask', 'taskId', "type: 'task'", 'buildLearningUrl', 'buildDingTalkLearningLink']],
  ['task push has trilingual DingTalk and FCM copy', 'netlify/functions/dingtalk.js', ['getUserNotificationLanguage', 'recipientsAr', 'markdownAr', 'getTaskFcmNotification', 'مهمة تعلم جديدة']],
  ['campaign push payload includes campaign id', 'src/pages/admin/CampaignManager.tsx', ["action: 'notifyCampaign'", 'campaignId: campaignId']],
  ['campaign push function forwards campaign id', 'netlify/functions/dingtalk.js', ['notifyCampaign', 'campaignId', "type: 'campaign'", 'buildLearningUrl', 'buildDingTalkLearningLink']],
  ['campaign push has trilingual DingTalk and FCM copy', 'netlify/functions/dingtalk.js', ['getUserNotificationLanguage', 'recipientsAr', 'markdownAr', 'getCampaignFcmNotification', 'تحدي شهادة جديد']],
  ['campaign dingtalk link opens learning page', 'netlify/functions/dingtalk.js', ['campaignLearnId', 'dingTalkCampaignLink', 'buildDingTalkLearningLink']],
  ['material app push forwards recording id', 'netlify/functions/dingtalk.js', ['notifyMaterial', 'recordingId: recordingId', "type: 'recording'"]],
  ['material app push verifier exercises recording route payload', 'scripts/verify-dingtalk-push-payloads.mjs', ['notifyMaterial', "targetType: 'app'", "recordingId: 'recording-789'", "type=recording", 'displayId']],
  ['task draft autosave', 'src/pages/LearningHub.tsx', ['draftSavedAt']],
  ['effective user id helper', 'src/utils/userIdentity.ts', ['getEffectiveUserId']],
  ['download route is public', 'src/App.tsx', ['path="/download"', 'element={<DownloadPage />}']],
  ['app download link resolver', 'src/utils/appDownloadLinks.ts', ['DEFAULT_IOS_TESTFLIGHT_URL', 'DEFAULT_ANDROID_APK_PATH', 'resolveAppDownloadUrl', 'mecc-latest.apk']],
  ['app download page uses latest APK', 'src/pages/DownloadPage.tsx', ['resolveAppDownloadUrl', 'download_page.android_btn', 'download_page.ios_btn']],
  ['download page reads configurable app links', 'src/pages/DownloadPage.tsx', ['system_config', 'app_versions', 'resolveAppDownloadUrl']],
  ['native update modal has platform fallbacks', 'src/components/AppLayout.tsx', ['resolveAppDownloadUrl']],
  ['hub update card has platform fallbacks', 'src/pages/LearningHub.tsx', ['resolveAppDownloadUrl']],
  ['app version update gate exists', 'src/utils/appVersion.ts', ['CLIENT_APP_VERSIONS', 'getLatestClientAppVersion', 'isVersionOutdated']],
  ['app release admin route exists', 'src/App.tsx', ['AppReleaseManager', 'app-release']],
  ['app release admin menu exists', 'src/components/AdminLayout.tsx', ['/admin/app-release', 'admin_menu.app_release']],
  ['app release admin manages Firestore config', 'src/pages/admin/AppReleaseManager.tsx', ['system_config', 'app_versions', 'android_latest', 'android_apk_url']],
  ['production smoke verifies current shell and APK hash', 'scripts/smoke-production.mjs', ['localDistIndexPath', 'local build output exists for production shell comparison', 'shell matches current build output', 'all production HTML routes match current build output', 'createHash', 'sha256', 'getRemoteFileHash', 'production APK matches repository APK hash']],
  ['production smoke workflow builds current shell first', '.github/workflows/release-verify.yml', ['Build current shell for smoke comparison', 'npm run build', 'PROD_SMOKE_RETRIES', 'PROD_SMOKE_RETRY_DELAY_MS', 'npm run smoke:prod']],
  ['release workflow verifier exists', 'scripts/verify-release-workflow.mjs', ['Release workflow verified', 'needs: verify-release', "if: github.event_name != 'pull_request'", 'Build current shell for smoke comparison', 'envNumber', "envNumber('PROD_SMOKE_RETRIES') < 8", "envNumber('PROD_SMOKE_RETRY_DELAY_MS') < 20000"]],
  ['manual QA evidence generator exists', 'scripts/create-manual-qa-evidence.mjs', ['manual-qa-evidence-template.md', 'QA_EVIDENCE_DIR', 'docs/qa-evidence', 'Android APK SHA-256']],
  ['manual QA evidence verifier exists', 'scripts/verify-manual-qa-evidence.mjs', ['QA_EVIDENCE_DIR', 'Material App push notification is received', 'Arabic Android push notification renders in Arabic', 'Generated evidence must not allow Not configured push placeholders', 'Manual QA evidence generator verified']],
  ['manual QA evidence validator exists', 'scripts/validate-manual-qa-evidence.mjs', ['Release commit must match current release commit', 'Android APK SHA-256 must match current repository APK', 'Fully verified must be Yes', 'Android push must be configured for full verification', 'DingTalk task message opens the task learning page', 'DingTalk challenge message opens the challenge learning page', 'Arabic DingTalk task/challenge messages render in Arabic', 'Arabic Android push notification renders in Arabic', 'Android push tap opens the correct recording/task/campaign page', 'Material App push notification is received', 'Material App push opens the recording detail page', 'QA row must include concrete evidence', 'Manual QA evidence validated']],
  ['manual QA evidence validator verifier exists', 'scripts/verify-manual-qa-evidence-validator.mjs', ['Manual QA evidence validator verified', 'Expected invalid evidence with a Fail row to be rejected', 'Expected invalid evidence with a Not configured push row to be rejected', 'Expected invalid evidence with a stale release commit to be rejected', 'Expected invalid evidence with blank evidence to be rejected', 'Expected invalid evidence with placeholder evidence to be rejected']],
  ['manual QA template sync verifier exists', 'scripts/verify-manual-qa-template-sync.mjs', ['exactPassRows', 'requiredFields', 'Manual QA template and validator are in sync']],
  ['manual QA evidence command exists', 'package.json', ['qa:evidence', 'create-manual-qa-evidence.mjs']],
  ['manual QA evidence check command exists', 'package.json', ['qa:evidence:check', 'validate-manual-qa-evidence.mjs']],
  ['manual QA evidence stays local', '.gitignore', ['docs/qa-evidence/*.md', '!docs/qa-evidence/README.md']],
  ['task push fallback messaging', 'src/pages/TeamTasks.tsx', ['getFcmFailureMessage', 'third-party-auth-error', 'fcm_apns_auth_error', 'fcm_push_error']],
  ['safe native sync script', 'package.json', ['clean-native-download-assets.mjs']]
];

for (const [name, path, needles] of sourceAssertions) {
  const content = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const missingNeedles = needles.filter((needle) => !content.includes(needle));
  addCheck(name, missingNeedles.length === 0, missingNeedles.length > 0 ? `${path} missing ${missingNeedles.join(', ')}` : path);
}

const appVersionSource = existsSync('src/utils/appVersion.ts') ? readFileSync('src/utils/appVersion.ts', 'utf8') : '';
const androidGradleSource = existsSync('android/app/build.gradle') ? readFileSync('android/app/build.gradle', 'utf8') : '';
const androidClientVersion = appVersionSource.match(/android:\s*'([^']+)'/)?.[1] || '';
const webClientVersion = appVersionSource.match(/web:\s*'([^']+)'/)?.[1] || '';
const androidVersionName = androidGradleSource.match(/versionName\s+"([^"]+)"/)?.[1] || '';
const androidVersionCode = Number(androidGradleSource.match(/versionCode\s+(\d+)/)?.[1] || 0);
addCheck('android native version matches client version', androidClientVersion && androidClientVersion === androidVersionName, `client=${androidClientVersion}, native=${androidVersionName}`);
addCheck('web client version matches android client version', webClientVersion && webClientVersion === androidClientVersion, `web=${webClientVersion}, android=${androidClientVersion}`);
addCheck('android native version code advanced', androidVersionCode >= 7, `versionCode=${androidVersionCode}`);

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
