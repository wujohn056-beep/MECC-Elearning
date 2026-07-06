import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const runGit = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = runGit(['rev-parse', '--short', 'HEAD']);
const date = new Date().toISOString().slice(0, 10);
const productionUrl = (process.env.PROD_BASE_URL || 'https://learning.mecloudhub.com').replace(/\/$/, '');
const apkPath = 'public/downloads/mecc-latest.apk';
const apkHash = existsSync(apkPath)
  ? createHash('sha256').update(readFileSync(apkPath)).digest('hex')
  : '';

const tempDir = mkdtempSync(join(tmpdir(), 'mecc-qa-evidence-'));

try {
  const result = spawnSync(process.execPath, ['scripts/create-manual-qa-evidence.mjs'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      QA_EVIDENCE_DIR: tempDir
    }
  });

  assert(result.status === 0, `QA evidence generator failed: ${(result.stdout + result.stderr).trim()}`);

  const outputPath = join(tempDir, `${date}-${commit}.md`);
  assert(existsSync(outputPath), `Expected generated evidence file missing: ${outputPath}`);

  const content = readFileSync(outputPath, 'utf8');
  assert(content.includes(`- Release commit: ${commit}`), 'Generated evidence must include current commit');
  assert(content.includes(`- Production URL: ${productionUrl}`), 'Generated evidence must include production URL');
  assert(content.includes(`- Android APK SHA-256: ${apkHash}`), 'Generated evidence must include APK hash');
  assert(content.includes('| Production APK hash matches repository APK | Pass / Fail |'), 'Generated evidence must keep APK hash evidence row');
  assert(content.includes('| DingTalk task message opens the task learning page | Pass / Fail |'), 'Generated evidence must include DingTalk task deep-link row');
  assert(content.includes('| DingTalk challenge message opens the challenge learning page | Pass / Fail |'), 'Generated evidence must include DingTalk challenge deep-link row');
  assert(content.includes('| Material App push notification is received | Pass / Fail |'), 'Generated evidence must include material App push receive row');
  assert(content.includes('| Material App push opens the recording detail page | Pass / Fail |'), 'Generated evidence must include material App push recording route row');
  assert(content.includes('| Policy App push notification is received | Pass / Fail |'), 'Generated evidence must include policy App push receive row');
  assert(content.includes('| Policy App push opens the policy detail page | Pass / Fail |'), 'Generated evidence must include policy App push route row');
  assert(content.includes('| Brand App push notification is received | Pass / Fail |'), 'Generated evidence must include brand App push receive row');
  assert(content.includes('| Brand App push opens the brand detail page | Pass / Fail |'), 'Generated evidence must include brand App push route row');
  assert(content.includes('| Arabic Android push notification renders in Arabic | Pass / Fail |'), 'Generated evidence must include Arabic Android push row');
  assert(!content.includes('Pass / Fail / Not configured'), 'Generated evidence must not allow Not configured push placeholders');
  assert(!content.includes('if configured'), 'Generated evidence must not use optional push language');
  assert(result.stdout.includes('local-only and gitignored'), 'Generator must remind users that evidence is local-only');

  console.log('Manual QA evidence generator verified.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
