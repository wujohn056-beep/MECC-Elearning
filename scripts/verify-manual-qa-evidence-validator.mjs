import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const tempDir = mkdtempSync(join(tmpdir(), 'mecc-qa-validator-'));
const passFile = join(tempDir, 'pass.md');
const failFile = join(tempDir, 'fail.md');
const notConfiguredFile = join(tempDir, 'not-configured.md');
const staleReleaseFile = join(tempDir, 'stale-release.md');
const blankEvidenceFile = join(tempDir, 'blank-evidence.md');
const placeholderEvidenceFile = join(tempDir, 'placeholder-evidence.md');
const expectedCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const expectedApkHash = createHash('sha256').update(readFileSync('public/downloads/mecc-latest.apk')).digest('hex');
const expectedProductionUrl = (process.env.PROD_BASE_URL || 'https://learning.mecloudhub.com').replace(/\/$/, '');

const table = (rows) => rows.map(([label, result, evidence = 'qa-evidence-2026-07-02.png']) => `| ${label} | ${result} | ${evidence} |`).join('\n');
const passRows = [
  ['`npm run verify:release`', 'Pass', 'local terminal log 2026-07-02 15:20'],
  ['`npm run smoke:prod`', 'Pass', 'local terminal log 2026-07-02 15:24'],
  ['GitHub Actions latest main run', 'Pass', 'https://github.com/example/repo/actions/runs/123456'],
  ['Production APK hash matches repository APK', 'Pass', expectedApkHash],
  ['Leader creates a challenge task for the learner', 'Pass', 'task id task-123 in leader account'],
  ['Learner sees the assigned challenge task', 'Pass', 'qa-evidence-learner-task-list.png'],
  ['`Go Learn` opens the challenge learning page', 'Pass', 'https://learning.mecloudhub.com/hub?campaignLearnId=campaign-456'],
  ['Challenge does not fall back to the general hub tab', 'Pass', 'url retained campaignLearnId=campaign-456'],
  ['Task recordings are grouped by category', 'Pass', 'categories Expertise and First Call visible'],
  ['Category order follows the configured Learning Hub order', 'Pass', 'category order: Expertise, App Introduction, First Call'],
  ['Partial listening progress survives leaving and reopening', 'Pass', 'progress 8 of 60 min after reopen'],
  ['Reflection draft survives leaving and reopening', 'Pass', 'draft text retained after reopen'],
  ['Task completion is visible to learner and leader', 'Pass', 'leader board shows learner completed'],
  ['Learner receives in-system notification', 'Pass', 'notification id notif-123'],
  ['In-system notification opens the challenge learning page', 'Pass', 'https://learning.mecloudhub.com/hub?campaignLearnId=campaign-456'],
  ['DingTalk task message opens the task learning page', 'Pass', 'https://learning.mecloudhub.com/hub?taskId=task-123'],
  ['DingTalk challenge message opens the challenge learning page', 'Pass', 'https://learning.mecloudhub.com/hub?campaignLearnId=campaign-456'],
  ['Arabic DingTalk task/challenge messages render in Arabic', 'Pass', 'تم تعيين مهمة تعلم جديدة / تم تعيين تحدي شهادة جديد'],
  ['Android push notification is received', 'Pass', 'Pixel 8 notification shade 15:28'],
  ['Android push tap opens the correct recording/task/campaign page', 'Pass', 'Android opened campaignLearnId=campaign-456'],
  ['Arabic Android push notification renders in Arabic', 'Pass', 'مهمة تعلم جديدة / تحدي شهادة جديد'],
  ['FCM failure fallback still leaves task accessible', 'Not applicable', 'push delivered in this QA run'],
  ['`/download` renders iOS and Android options', 'Pass', 'https://learning.mecloudhub.com/download'],
  ['Android APK installs successfully', 'Pass', 'Pixel 8 installed version 1.0.7'],
  ['Android learner login works', 'Pass', 'learner account opened Learning Hub'],
  ['Android challenge task flow matches Web', 'Pass', 'Android campaignLearnId=campaign-456'],
  ['Android reflection draft and completion behavior match Web', 'Pass', 'Android draft retained and completion posted'],
  ['App update prompt shows current/latest versions in active language', 'Pass', 'update modal shows 1.0.7 latest'],
  ['Chinese', 'Pass', 'zh task/update text checked'],
  ['English', 'Pass', 'en task/update text checked'],
  ['Arabic', 'Pass', 'ar task/update text checked']
];

const content = `
# Manual QA Evidence

## Release Under Test

- Release commit: ${expectedCommit}
- Production URL: ${expectedProductionUrl}
- QA date: 2026-07-02
- QA owner: QA Owner
- Leader account: leader@example.com
- Learner account: learner@example.com
- Android device and OS: Pixel 8 / Android 15
- Android APK SHA-256: ${expectedApkHash}
- iOS TestFlight device and OS, if tested: iPhone / iOS 18
- Sign-off name and time: QA Owner 2026-07-02 15:30

${table(passRows)}

## Sign-off

- Fully verified: Yes
- Known issues: None
- Follow-up owner: None
`;

try {
  writeFileSync(passFile, content);
  writeFileSync(failFile, content.replace('| Android APK installs successfully | Pass |', '| Android APK installs successfully | Fail |'));
  writeFileSync(notConfiguredFile, content.replace('| Android push notification is received | Pass |', '| Android push notification is received | Not configured |'));
  writeFileSync(staleReleaseFile, content.replace(`- Release commit: ${expectedCommit}`, '- Release commit: stale123'));
  writeFileSync(blankEvidenceFile, content.replace('| Android APK installs successfully | Pass | Pixel 8 installed version 1.0.7 |', '| Android APK installs successfully | Pass |  |'));
  writeFileSync(placeholderEvidenceFile, content.replace('| Android APK installs successfully | Pass | Pixel 8 installed version 1.0.7 |', '| Android APK installs successfully | Pass | Device screenshot |'));

  const passResult = spawnSync(process.execPath, ['scripts/validate-manual-qa-evidence.mjs', passFile], {
    encoding: 'utf8'
  });
  if (passResult.status !== 0) {
    throw new Error(`Expected valid evidence to pass: ${(passResult.stdout + passResult.stderr).trim()}`);
  }

  const failResult = spawnSync(process.execPath, ['scripts/validate-manual-qa-evidence.mjs', failFile], {
    encoding: 'utf8'
  });
  if (failResult.status === 0) {
    throw new Error('Expected invalid evidence with a Fail row to be rejected');
  }

  const notConfiguredResult = spawnSync(process.execPath, ['scripts/validate-manual-qa-evidence.mjs', notConfiguredFile], {
    encoding: 'utf8'
  });
  if (notConfiguredResult.status === 0) {
    throw new Error('Expected invalid evidence with a Not configured push row to be rejected');
  }

  const staleReleaseResult = spawnSync(process.execPath, ['scripts/validate-manual-qa-evidence.mjs', staleReleaseFile], {
    encoding: 'utf8'
  });
  if (staleReleaseResult.status === 0) {
    throw new Error('Expected invalid evidence with a stale release commit to be rejected');
  }

  const blankEvidenceResult = spawnSync(process.execPath, ['scripts/validate-manual-qa-evidence.mjs', blankEvidenceFile], {
    encoding: 'utf8'
  });
  if (blankEvidenceResult.status === 0) {
    throw new Error('Expected invalid evidence with blank evidence to be rejected');
  }

  const placeholderEvidenceResult = spawnSync(process.execPath, ['scripts/validate-manual-qa-evidence.mjs', placeholderEvidenceFile], {
    encoding: 'utf8'
  });
  if (placeholderEvidenceResult.status === 0) {
    throw new Error('Expected invalid evidence with placeholder evidence to be rejected');
  }

  console.log('Manual QA evidence validator verified.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
