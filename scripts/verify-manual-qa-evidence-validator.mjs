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
const expectedCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const expectedApkHash = createHash('sha256').update(readFileSync('public/downloads/mecc-latest.apk')).digest('hex');
const expectedProductionUrl = (process.env.PROD_BASE_URL || 'https://learning.mecloudhub.com').replace(/\/$/, '');

const table = (rows) => rows.map(([label, result, evidence = 'screenshot']) => `| ${label} | ${result} | ${evidence} |`).join('\n');
const passRows = [
  ['`npm run verify:release`', 'Pass', 'CI run'],
  ['`npm run smoke:prod`', 'Pass', 'terminal timestamp'],
  ['GitHub Actions latest main run', 'Pass', 'run URL'],
  ['Production APK hash matches repository APK', 'Pass', 'sha256'],
  ['Leader creates a challenge task for the learner', 'Pass'],
  ['Learner sees the assigned challenge task', 'Pass'],
  ['`Go Learn` opens the challenge learning page', 'Pass'],
  ['Challenge does not fall back to the general hub tab', 'Pass'],
  ['Task recordings are grouped by category', 'Pass'],
  ['Category order follows the configured Learning Hub order', 'Pass'],
  ['Partial listening progress survives leaving and reopening', 'Pass'],
  ['Reflection draft survives leaving and reopening', 'Pass'],
  ['Task completion is visible to learner and leader', 'Pass'],
  ['Learner receives in-system notification', 'Pass'],
  ['In-system notification opens the challenge learning page', 'Pass'],
  ['DingTalk task message opens the task learning page', 'Pass', 'https://learning.mecloudhub.com/hub?taskId=task-123'],
  ['DingTalk challenge message opens the challenge learning page', 'Pass', 'https://learning.mecloudhub.com/hub?campaignLearnId=campaign-456'],
  ['Android push notification is received', 'Pass'],
  ['Android push tap opens the correct recording/task/campaign page', 'Pass'],
  ['FCM failure fallback still leaves task accessible', 'Not applicable'],
  ['`/download` renders iOS and Android options', 'Pass'],
  ['Android APK installs successfully', 'Pass'],
  ['Android learner login works', 'Pass'],
  ['Android challenge task flow matches Web', 'Pass'],
  ['Android reflection draft and completion behavior match Web', 'Pass'],
  ['App update prompt shows current/latest versions in active language', 'Pass'],
  ['Chinese', 'Pass'],
  ['English', 'Pass'],
  ['Arabic', 'Pass']
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

  console.log('Manual QA evidence validator verified.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
