import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const evidencePath = process.argv[2];

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!evidencePath) {
  fail('Usage: node scripts/validate-manual-qa-evidence.mjs <evidence-file.md>');
}

if (!existsSync(evidencePath)) {
  fail(`Manual QA evidence file not found: ${evidencePath}`);
}

const content = readFileSync(evidencePath, 'utf8');
const errors = [];
const apkPath = 'public/downloads/mecc-latest.apk';
const productionBaseUrl = (process.env.PROD_BASE_URL || 'https://learning.mecloudhub.com').replace(/\/$/, '');

const runGit = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const expectedCommit = process.env.QA_EVIDENCE_COMMIT || runGit(['rev-parse', '--short', 'HEAD']);
const expectedApkHash = process.env.QA_EVIDENCE_APK_SHA256 || (
  existsSync(apkPath) ? createHash('sha256').update(readFileSync(apkPath)).digest('hex') : ''
);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const listValue = (label) => {
  const match = content.match(new RegExp(`^- ${escapeRegExp(label)}:\\s*(.*)$`, 'm'));
  return match?.[1]?.trim() || '';
};

const normalize = (value) => value.replace(/`/g, '').trim().toLowerCase();
const tableRow = (label) => {
  const escapedLabel = escapeRegExp(label).replace(/\\`/g, '`');
  const row = content.match(new RegExp(`^\\|\\s*${escapedLabel}\\s*\\|\\s*([^|]+)\\|\\s*([^|]*)\\|`, 'm'));
  return {
    result: row?.[1]?.trim() || '',
    evidence: row?.[2]?.trim() || ''
  };
};

const tableResult = (label) => tableRow(label).result;
const evidenceLooksFilled = (value) => {
  const normalized = normalize(value);
  if (!normalized) return false;
  const placeholderSnippets = [
    'paste ',
    'screenshot',
    'url/screenshot',
    'task title, task id',
    'before/after',
    'category list',
    'device screenshot',
    'command timestamp',
    'ci run url',
    'run url',
    'sha-256'
  ];
  return !placeholderSnippets.some((snippet) => normalized.includes(snippet));
};

const requiredFields = [
  'Release commit',
  'Production URL',
  'QA date',
  'QA owner',
  'Leader account',
  'Learner account',
  'Android device and OS',
  'Android APK SHA-256',
  'Sign-off name and time'
];

for (const field of requiredFields) {
  if (!listValue(field)) errors.push(`Missing required field: ${field}`);
}

const productionUrl = listValue('Production URL');
if (productionUrl && !/^https?:\/\//.test(productionUrl)) {
  errors.push('Production URL must start with http:// or https://');
}
if (productionUrl && productionUrl.replace(/\/$/, '') !== productionBaseUrl) {
  errors.push(`Production URL must match ${productionBaseUrl} (${productionUrl})`);
}

const releaseCommit = listValue('Release commit');
if (releaseCommit && releaseCommit !== expectedCommit) {
  errors.push(`Release commit must match current release commit ${expectedCommit} (${releaseCommit})`);
}

const apkHash = listValue('Android APK SHA-256');
if (apkHash && !/^[a-f0-9]{64}$/i.test(apkHash)) {
  errors.push('Android APK SHA-256 must be a 64-character hex hash');
}
if (apkHash && expectedApkHash && apkHash.toLowerCase() !== expectedApkHash.toLowerCase()) {
  errors.push(`Android APK SHA-256 must match current repository APK ${expectedApkHash} (${apkHash})`);
}

const exactPassRows = [
  '`npm run verify:release`',
  '`npm run smoke:prod`',
  'GitHub Actions latest main run',
  'Production APK hash matches repository APK',
  'Leader creates a challenge task for the learner',
  'Learner sees the assigned challenge task',
  '`Go Learn` opens the challenge learning page',
  'Challenge does not fall back to the general hub tab',
  'Task recordings are grouped by category',
  'Category order follows the configured Learning Hub order',
  'Partial listening progress survives leaving and reopening',
  'Reflection draft survives leaving and reopening',
  'Task completion is visible to learner and leader',
  'Learner receives in-system notification',
  'In-system notification opens the challenge learning page',
  'DingTalk task message opens the task learning page',
  'DingTalk challenge message opens the challenge learning page',
  'Arabic DingTalk task/challenge messages render in Arabic',
  'Android push notification is received',
  'Android push tap opens the correct recording/task/campaign page',
  'Material App push notification is received',
  'Material App push opens the recording detail page',
  'Arabic Android push notification renders in Arabic',
  '`/download` renders iOS and Android options',
  'Android APK installs successfully',
  'Android learner login works',
  'Android challenge task flow matches Web',
  'Android reflection draft and completion behavior match Web',
  'App update prompt shows current/latest versions in active language',
  'Chinese',
  'English',
  'Arabic'
];

for (const row of exactPassRows) {
  const { result, evidence } = tableRow(row);
  if (!result) {
    errors.push(`Missing QA row: ${row}`);
  } else if (normalize(result) !== 'pass') {
    errors.push(`QA row must be Pass: ${row} (${result})`);
  }
  if (result && !evidenceLooksFilled(evidence)) {
    errors.push(`QA row must include concrete evidence: ${row} (${evidence || 'blank'})`);
  }
}

const fcmFallbackRow = tableRow('FCM failure fallback still leaves task accessible');
const fcmFallbackResult = fcmFallbackRow.result;
if (!fcmFallbackResult) {
  errors.push('Missing QA row: FCM failure fallback still leaves task accessible');
} else if (!['pass', 'not applicable'].includes(normalize(fcmFallbackResult))) {
  errors.push(`FCM fallback row must be Pass or Not applicable (${fcmFallbackResult})`);
}
if (fcmFallbackResult && !evidenceLooksFilled(fcmFallbackRow.evidence)) {
  errors.push(`FCM fallback row must include concrete evidence (${fcmFallbackRow.evidence || 'blank'})`);
}

const fullyVerified = listValue('Fully verified');
if (fullyVerified !== 'Yes') {
  errors.push(`Fully verified must be Yes after all required evidence is present (${fullyVerified || 'blank'})`);
}

const unresolvedPlaceholders = [
  'Pass / Fail',
  'Pass / Fail / Not configured',
  'Pass / Fail / Not applicable',
  'Yes / No'
].filter((placeholder) => content.includes(placeholder));
if (unresolvedPlaceholders.length > 0) {
  errors.push(`Unresolved placeholders remain: ${unresolvedPlaceholders.join(', ')}`);
}

const failedRows = content
  .split('\n')
  .filter((line) => /^\|/.test(line))
  .filter((line) => /\|\s*Fail\s*(?:\/|\|)/i.test(line));
if (failedRows.length > 0) {
  errors.push(`Fail rows remain: ${failedRows.length}`);
}

const notConfiguredRows = content
  .split('\n')
  .filter((line) => /^\|/.test(line))
  .filter((line) => /\|\s*Not configured\s*(?:\/|\|)/i.test(line));
if (notConfiguredRows.length > 0) {
  errors.push(`Android push must be configured for full verification: ${notConfiguredRows.length} row(s) still say Not configured`);
}

if (errors.length > 0) {
  console.error(`Manual QA evidence validation failed for ${evidencePath}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Manual QA evidence validated: ${evidencePath}`);
