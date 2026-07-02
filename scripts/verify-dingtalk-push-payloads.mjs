import { handler } from '../netlify/functions/dingtalk.js';

const invoke = async (body) => {
  const response = await handler({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const parsed = JSON.parse(response.body || '{}');
  if (response.statusCode !== 200) {
    throw new Error(`Expected 200, got ${response.statusCode}: ${response.body}`);
  }
  return parsed;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const task = await invoke({
  action: 'notifyTask',
  title: 'Mock Task',
  assignerName: 'Manager',
  assigneeIds: ['learner-one'],
  taskId: 'task-123',
  deadline: '2026-07-03 10:00'
});

assert(task.isMockDingTalk === true, 'Task verification must run in mock DingTalk mode');
assert(task.isMockFirebase === true, 'Task verification must run in mock Firebase mode');
assert(task.mockPayload?.markdownEn?.includes('taskId%3Dtask-123'), 'Task DingTalk markdown must deep-link to task learning page');
assert(task.mockPayload?.markdownZh?.includes('taskId%3Dtask-123'), 'Task Chinese DingTalk markdown must deep-link to task learning page');
assert(task.mockPayload?.fcm?.data?.type === 'task', 'Task FCM payload must include type=task');
assert(task.mockPayload?.fcm?.data?.taskId === 'task-123', 'Task FCM payload must include taskId');

const campaign = await invoke({
  action: 'notifyCampaign',
  title: 'Mock Challenge',
  bannerTitle: 'Certificate',
  creatorName: 'Leader',
  assigneeIds: ['learner-one'],
  campaignId: 'campaign-456',
  endDate: '2026-07-04 10:00'
});

assert(campaign.isMockDingTalk === true, 'Campaign verification must run in mock DingTalk mode');
assert(campaign.isMockFirebase === true, 'Campaign verification must run in mock Firebase mode');
assert(campaign.mockPayload?.markdownEn?.includes('campaignLearnId%3Dcampaign-456'), 'Campaign DingTalk markdown must deep-link to campaign learning page');
assert(campaign.mockPayload?.markdownZh?.includes('campaignLearnId%3Dcampaign-456'), 'Campaign Chinese DingTalk markdown must deep-link to campaign learning page');
assert(campaign.mockPayload?.fcm?.data?.type === 'campaign', 'Campaign FCM payload must include type=campaign');
assert(campaign.mockPayload?.fcm?.data?.campaignId === 'campaign-456', 'Campaign FCM payload must include campaignId');

console.log('DingTalk and FCM push payload behavior verified.');
