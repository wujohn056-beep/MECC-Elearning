import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import vm from 'node:vm';

const source = readFileSync('src/utils/taskRecordingGroups.ts', 'utf8');
const compiled = transformSync(source, {
  loader: 'ts',
  format: 'cjs',
  target: 'es2022'
}).code;

const sandbox = {
  exports: {},
  module: { exports: {} }
};
vm.runInNewContext(compiled, sandbox);

const { getTaskRecordingGroups } = sandbox.module.exports;
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const categories = [
  { id: 'cat-expertise', name: 'Expertise and Compliance Guidance' },
  { id: 'cat-app', name: '51talk APP&WhatsAPP Introduction' },
  { id: 'cat-first-call', name: 'first call' }
];

const recordings = [
  { id: 'r-app-1', categoryId: 'cat-app' },
  { id: 'r-first-1', categoryId: 'cat-first-call' },
  { id: 'r-expertise-1', categoryId: 'cat-expertise' },
  { id: 'r-legacy-name-match', categoryName: 'first call' },
  { id: 'r-uncategorized' }
];

const taskRecordingIds = [
  'r-first-1',
  'r-uncategorized',
  'r-app-1',
  'r-expertise-1',
  'r-legacy-name-match'
];

const groups = getTaskRecordingGroups(taskRecordingIds, recordings, categories, 'Uncategorized');

assert(groups.length === 4, `Expected 4 groups, got ${groups.length}`);
assert(groups[0].name === 'Expertise and Compliance Guidance', `Expected first configured category first, got ${groups[0].name}`);
assert(groups[1].name === '51talk APP&WhatsAPP Introduction', `Expected second configured category second, got ${groups[1].name}`);
assert(groups[2].name === 'first call', `Expected third configured category third, got ${groups[2].name}`);
assert(groups[3].name === 'Uncategorized', `Expected uncategorized fallback last, got ${groups[3].name}`);
assert(groups[2].recordingIds.join(',') === 'r-first-1,r-legacy-name-match', 'Expected same-category recordings to keep task order');

console.log('Task recording group behavior verified.');
