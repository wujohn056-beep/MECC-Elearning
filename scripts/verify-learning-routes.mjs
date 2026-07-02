import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import vm from 'node:vm';

const source = readFileSync('src/utils/learningRoutes.ts', 'utf8');
const compiled = transformSync(source, {
  loader: 'ts',
  format: 'cjs',
  target: 'es2022'
}).code;

const sandbox = {
  exports: {},
  module: { exports: {} },
  URLSearchParams
};
vm.runInNewContext(compiled, sandbox);

const { buildLearningRoute, buildLearningSearchParams } = sandbox.module.exports;
const assertRoute = (actual, expected) => {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
};

assertRoute(buildLearningRoute({ type: 'campaign', campaignId: 'campaign-1' }), '/hub?campaignLearnId=campaign-1');
assertRoute(buildLearningRoute({ type: 'task', taskId: 'task-1' }), '/hub?taskId=task-1');
assertRoute(buildLearningRoute({ type: 'recording', recordingId: 'recording-1' }), '/hub?recordingId=recording-1');
assertRoute(buildLearningRoute({ type: 'campaign' }), '/hub');
assertRoute(buildLearningRoute({ type: 'task' }), '/hub');
assertRoute(buildLearningRoute({ type: 'recording' }), '/hub');
assertRoute(
  buildLearningRoute({ type: 'campaign', campaignId: 'campaign-2' }, 'publicTab=team&taskId=old-task&recordingId=old-rec&campaignId=old-campaign&scope=team&smId=sm-1'),
  '/hub?scope=team&smId=sm-1&campaignLearnId=campaign-2'
);
assertRoute(
  buildLearningRoute({ type: 'task', taskId: 'task-2' }, 'campaignLearnId=old-campaign&publicTab=public&recordingId=old-rec'),
  '/hub?taskId=task-2'
);
assertRoute(
  buildLearningRoute({ type: 'recording', recordingId: 'recording-2' }, 'campaignLearnId=old-campaign&taskId=old-task&publicTab=team'),
  '/hub?recordingId=recording-2'
);

const params = buildLearningSearchParams(
  { type: 'campaign', campaignId: 'campaign-3' },
  new URLSearchParams('taskId=old-task&scope=team&smId=sm-1')
);
assertRoute(params.toString(), 'scope=team&smId=sm-1&campaignLearnId=campaign-3');

console.log('Learning route behavior verified.');
