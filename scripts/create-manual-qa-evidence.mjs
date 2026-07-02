import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const productionUrl = (process.env.PROD_BASE_URL || 'https://learning.mecloudhub.com').replace(/\/$/, '');
const evidenceDir = 'docs/qa-evidence';
const templatePath = 'docs/manual-qa-evidence-template.md';
const apkPath = 'public/downloads/mecc-latest.apk';

const runGit = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const today = new Date().toISOString().slice(0, 10);
const commit = runGit(['rev-parse', '--short', 'HEAD']);
const apkHash = existsSync(apkPath)
  ? createHash('sha256').update(readFileSync(apkPath)).digest('hex')
  : '';

if (!existsSync(templatePath)) {
  throw new Error(`Missing QA evidence template: ${templatePath}`);
}

mkdirSync(evidenceDir, { recursive: true });

const template = readFileSync(templatePath, 'utf8');
const content = template
  .replace('- Release commit:', `- Release commit: ${commit}`)
  .replace('- Production URL:', `- Production URL: ${productionUrl}`)
  .replace('- QA date:', `- QA date: ${today}`)
  .replace('- Android APK SHA-256:', `- Android APK SHA-256: ${apkHash || 'Missing local APK'}`)
  .replace('| Production APK hash matches repository APK | Pass / Fail | Paste SHA-256 |', `| Production APK hash matches repository APK | Pass / Fail | ${apkHash || 'Missing local APK'} |`);

const outputPath = `${evidenceDir}/${today}-${commit}.md`;

if (existsSync(outputPath) && process.env.OVERWRITE_QA_EVIDENCE !== '1') {
  throw new Error(`Evidence file already exists: ${outputPath}. Set OVERWRITE_QA_EVIDENCE=1 to replace it.`);
}

writeFileSync(outputPath, content);
console.log(`Created manual QA evidence file: ${outputPath}`);
console.log('Generated QA evidence files are local-only and gitignored by default.');
