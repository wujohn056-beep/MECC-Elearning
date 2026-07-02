import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/release-verify.yml';
const source = readFileSync(workflowPath, 'utf8');
const lines = source.split('\n');
const errors = [];

const has = (needle) => source.includes(needle);
const lineNumber = (needle) => lines.findIndex((line) => line.includes(needle));
const envNumber = (name) => {
  const match = source.match(new RegExp(`${name}:\\s*['"]?(\\d+)['"]?`));
  return match ? Number(match[1]) : 0;
};
const requireContains = (description, needle) => {
  if (!has(needle)) errors.push(`${description}: missing ${needle}`);
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
requireContains('release checkout', 'uses: actions/checkout@v4');
requireContains('release node setup', 'uses: actions/setup-node@v4');
requireContains('release npm install', 'run: npm ci');
requireContains('release verification command', 'run: npm run verify:release');

requireContains('production smoke job', 'smoke-production:');
requireContains('production smoke depends on release verification', 'needs: verify-release');
requireContains('production smoke skips pull requests', "if: github.event_name != 'pull_request'");
requireContains('production smoke builds shell before smoke', 'Build current shell for smoke comparison');
requireContains('production smoke build command', 'run: npm run build');
requireContains('production smoke waits for deploy', 'Wait for production deploy');
requireContains('production smoke retry count env', 'PROD_SMOKE_RETRIES');
requireContains('production smoke retry delay env', 'PROD_SMOKE_RETRY_DELAY_MS');
requireContains('production smoke command', 'run: npm run smoke:prod');

if (envNumber('PROD_SMOKE_RETRIES') < 8) {
  errors.push(`production smoke retry count is too low: ${envNumber('PROD_SMOKE_RETRIES') || 'missing'}`);
}
if (envNumber('PROD_SMOKE_RETRY_DELAY_MS') < 20000) {
  errors.push(`production smoke retry delay is too low: ${envNumber('PROD_SMOKE_RETRY_DELAY_MS') || 'missing'}`);
}

requireOrder('release job must run before production smoke job', 'verify-release:', 'smoke-production:');
requireOrder('release command must run before production smoke job', 'run: npm run verify:release', 'smoke-production:');
requireOrder('production smoke must install dependencies before build', 'run: npm ci', 'Build current shell for smoke comparison');
requireOrder('production smoke must build before waiting for deploy', 'Build current shell for smoke comparison', 'Wait for production deploy');
requireOrder('production smoke retry env must be set before smoke command', 'PROD_SMOKE_RETRIES', 'run: npm run smoke:prod');
requireOrder('production smoke must wait before smoke command', 'Wait for production deploy', 'run: npm run smoke:prod');

if (errors.length > 0) {
  console.error('Release workflow verification failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Release workflow verified.');
