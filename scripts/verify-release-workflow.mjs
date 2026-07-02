import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/release-verify.yml';
const source = readFileSync(workflowPath, 'utf8');
const packageSource = readFileSync('package.json', 'utf8');
const lines = source.split('\n');
const errors = [];

const has = (needle) => source.includes(needle);
const lineNumber = (needle) => lines.findIndex((line) => line.includes(needle));
const jobSource = (jobName) => {
  const marker = `\n  ${jobName}:`;
  const start = source.indexOf(marker);
  if (start === -1) return '';
  const rest = source.slice(start + marker.length);
  const nextJob = rest.search(/\n  [a-zA-Z0-9_-]+:\n/);
  return source.slice(start, nextJob === -1 ? undefined : start + marker.length + nextJob);
};
const releaseJobSource = jobSource('verify-release');
const smokeJobSource = jobSource('smoke-production');
const envNumber = (name) => {
  const match = source.match(new RegExp(`${name}:\\s*['"]?(\\d+)['"]?`));
  return match ? Number(match[1]) : 0;
};
const requireContains = (description, needle) => {
  if (!has(needle)) errors.push(`${description}: missing ${needle}`);
};
const requireJobContains = (job, description, needle) => {
  const jobText = job === 'release' ? releaseJobSource : smokeJobSource;
  if (!jobText.includes(needle)) errors.push(`${description}: missing ${needle}`);
};
const jobLineNumber = (job, needle) => {
  const jobText = job === 'release' ? releaseJobSource : smokeJobSource;
  return jobText.split('\n').findIndex((line) => line.includes(needle));
};
const requireJobOrder = (job, description, before, after) => {
  const beforeLine = jobLineNumber(job, before);
  const afterLine = jobLineNumber(job, after);
  if (beforeLine === -1 || afterLine === -1 || beforeLine >= afterLine) {
    errors.push(`${description}: expected "${before}" before "${after}"`);
  }
};
const requireOrder = (description, before, after) => {
  const beforeLine = lineNumber(before);
  const afterLine = lineNumber(after);
  if (beforeLine === -1 || afterLine === -1 || beforeLine >= afterLine) {
    errors.push(`${description}: expected "${before}" before "${after}"`);
  }
};

requireContains('workflow name', 'name: Release Verification');
requireContains('push trigger', 'push:');
requireContains('main branch trigger', '- main');
requireContains('pull request trigger', 'pull_request:');
requireContains('manual trigger', 'workflow_dispatch:');

requireContains('release job', 'verify-release:');
requireJobContains('release', 'release checkout', 'uses: actions/checkout@v4');
requireJobContains('release', 'release node setup', 'uses: actions/setup-node@v4');
requireJobContains('release', 'release npm install', 'run: npm ci');
requireJobContains('release', 'release verification command', 'run: npm run verify:release');

requireContains('production smoke job', 'smoke-production:');
requireJobContains('smoke', 'production smoke checkout', 'uses: actions/checkout@v4');
requireJobContains('smoke', 'production smoke node setup', 'uses: actions/setup-node@v4');
requireJobContains('smoke', 'production smoke npm install', 'run: npm ci');
requireJobContains('smoke', 'production smoke depends on release verification', 'needs: verify-release');
requireJobContains('smoke', 'production smoke skips pull requests', "if: github.event_name != 'pull_request'");
requireJobContains('smoke', 'production smoke waits for deploy', 'Wait for production deploy');
requireJobContains('smoke', 'production smoke retry count env', 'PROD_SMOKE_RETRIES');
requireJobContains('smoke', 'production smoke retry delay env', 'PROD_SMOKE_RETRY_DELAY_MS');
requireJobContains('smoke', 'production smoke command', 'run: npm run smoke:prod');
if (!packageSource.includes('"smoke:prod": "npm run build && node scripts/smoke-production.mjs"')) {
  errors.push('production smoke command must build current shell before comparing production');
}

if (envNumber('PROD_SMOKE_RETRIES') < 8) {
  errors.push(`production smoke retry count is too low: ${envNumber('PROD_SMOKE_RETRIES') || 'missing'}`);
}
if (envNumber('PROD_SMOKE_RETRY_DELAY_MS') < 20000) {
  errors.push(`production smoke retry delay is too low: ${envNumber('PROD_SMOKE_RETRY_DELAY_MS') || 'missing'}`);
}

requireOrder('release job must run before production smoke job', 'verify-release:', 'smoke-production:');
requireOrder('release command must run before production smoke job', 'run: npm run verify:release', 'smoke-production:');
requireJobOrder('release', 'release job must install before verification', 'run: npm ci', 'run: npm run verify:release');
requireJobOrder('smoke', 'production smoke job must install before waiting', 'run: npm ci', 'Wait for production deploy');
requireJobOrder('smoke', 'production smoke job must wait before smoke command', 'Wait for production deploy', 'run: npm run smoke:prod');
requireJobOrder('smoke', 'production smoke retry env must be set before smoke command', 'PROD_SMOKE_RETRIES', 'run: npm run smoke:prod');
requireJobOrder('smoke', 'production smoke retry delay env must be set before smoke command', 'PROD_SMOKE_RETRY_DELAY_MS', 'run: npm run smoke:prod');

if (errors.length > 0) {
  console.error('Release workflow verification failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Release workflow verified.');
