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

const extractLearningUrl = (markdown) => {
  const match = markdown?.match(/dingtalk:\/\/dingtalkclient\/page\/link\?url=([^)]+)/);
  assert(match, 'Expected DingTalk markdown to include a deep link URL');
  return decodeURIComponent(match[1]);
};

const task = await invoke({
  action: 'notifyTask',
  title: 'Mock Task',
  assignerName: 'Manager',
  assigneeIds: ['learner-one', 'learner-ar'],
  taskId: 'task-123',
  deadline: '2026-07-03 10:00'
});

assert(task.isMockDingTalk === true, 'Task verification must run in mock DingTalk mode');
assert(task.isMockFirebase === true, 'Task verification must run in mock Firebase mode');
assert(task.mockPayload?.markdownEn?.includes('taskId%3Dtask-123'), 'Task DingTalk markdown must deep-link to task learning page');
assert(task.mockPayload?.markdownZh?.includes('taskId%3Dtask-123'), 'Task Chinese DingTalk markdown must deep-link to task learning page');
assert(task.mockPayload?.markdownAr?.includes('taskId%3Dtask-123'), 'Task Arabic DingTalk markdown must deep-link to task learning page');
assert(extractLearningUrl(task.mockPayload?.markdownEn) === 'https://learning.mecloudhub.com/hub?taskId=task-123', 'Task English DingTalk link must resolve exactly to the task learning page');
assert(extractLearningUrl(task.mockPayload?.markdownZh) === 'https://learning.mecloudhub.com/hub?taskId=task-123', 'Task Chinese DingTalk link must resolve exactly to the task learning page');
assert(extractLearningUrl(task.mockPayload?.markdownAr) === 'https://learning.mecloudhub.com/hub?taskId=task-123', 'Task Arabic DingTalk link must resolve exactly to the task learning page');
assert(task.recipientsArCount === 1, 'Task mock verification must route Arabic learners to Arabic DingTalk recipients');
assert(task.mockPayload?.fcm?.localized?.ar?.title === '📋 مهمة تعلم جديدة', 'Task FCM payload must include Arabic title copy');
assert(task.mockPayload?.fcm?.data?.type === 'task', 'Task FCM payload must include type=task');
assert(task.mockPayload?.fcm?.data?.taskId === 'task-123', 'Task FCM payload must include taskId');

const campaign = await invoke({
  action: 'notifyCampaign',
  title: 'Mock Challenge',
  bannerTitle: 'Certificate',
  creatorName: 'Leader',
  assigneeIds: ['learner-one', 'learner-ar'],
  campaignId: 'campaign-456',
  endDate: '2026-07-04 10:00'
});

assert(campaign.isMockDingTalk === true, 'Campaign verification must run in mock DingTalk mode');
assert(campaign.isMockFirebase === true, 'Campaign verification must run in mock Firebase mode');
assert(campaign.mockPayload?.markdownEn?.includes('campaignLearnId%3Dcampaign-456'), 'Campaign DingTalk markdown must deep-link to campaign learning page');
assert(campaign.mockPayload?.markdownZh?.includes('campaignLearnId%3Dcampaign-456'), 'Campaign Chinese DingTalk markdown must deep-link to campaign learning page');
assert(campaign.mockPayload?.markdownAr?.includes('campaignLearnId%3Dcampaign-456'), 'Campaign Arabic DingTalk markdown must deep-link to campaign learning page');
assert(extractLearningUrl(campaign.mockPayload?.markdownEn) === 'https://learning.mecloudhub.com/hub?campaignLearnId=campaign-456', 'Campaign English DingTalk link must resolve exactly to the campaign learning page');
assert(extractLearningUrl(campaign.mockPayload?.markdownZh) === 'https://learning.mecloudhub.com/hub?campaignLearnId=campaign-456', 'Campaign Chinese DingTalk link must resolve exactly to the campaign learning page');
assert(extractLearningUrl(campaign.mockPayload?.markdownAr) === 'https://learning.mecloudhub.com/hub?campaignLearnId=campaign-456', 'Campaign Arabic DingTalk link must resolve exactly to the campaign learning page');
assert(campaign.recipientsArCount === 1, 'Campaign mock verification must route Arabic learners to Arabic DingTalk recipients');
assert(campaign.mockPayload?.fcm?.localized?.ar?.title === '🏆 تحدي شهادة جديد', 'Campaign FCM payload must include Arabic title copy');
assert(campaign.mockPayload?.fcm?.data?.type === 'campaign', 'Campaign FCM payload must include type=campaign');
assert(campaign.mockPayload?.fcm?.data?.campaignId === 'campaign-456', 'Campaign FCM payload must include campaignId');

const material = await invoke({
  action: 'notifyMaterial',
  targetType: 'app',
  recordingId: 'recording-789',
  title: 'Mock Recording',
  displayId: 'RD0789',
  lecturerName: 'Coach',
  categoryName: 'Expertise',
  description: 'Mock material push verification'
});

assert(material.success === true, 'Material App push verification must succeed in mock Firebase mode');
assert(material.mockPayload?.tokens?.length === 2, 'Material App push mock payload must include mock FCM tokens');
assert(material.mockPayload?.data?.type === 'recording', 'Material App push FCM payload must include type=recording');
assert(material.mockPayload?.data?.recordingId === 'recording-789', 'Material App push FCM payload must include recordingId');
assert(material.mockPayload?.data?.displayId === 'RD0789', 'Material App push FCM payload must include displayId');
assert(material.mockPayload?.title?.includes('ME云学堂'), 'Material App push mock payload must include notification title');
assert(material.mockPayload?.body?.includes('Mock Recording'), 'Material App push mock payload must include recording title');

const policy = await invoke({
  action: 'notifyPolicy',
  targetType: 'app',
  policyId: 'policy-321',
  title: 'Mock Policy',
  description: 'Mock policy push verification',
  type: 'document',
  targetTeam: 'all',
  section: 'policy'
});

assert(policy.success === true, 'Policy App push verification must succeed in mock Firebase mode');
assert(policy.mockPayload?.tokens?.length === 2, 'Policy App push mock payload must include mock FCM tokens');
assert(policy.mockPayload?.data?.type === 'policy', 'Policy App push FCM payload must include type=policy');
assert(policy.mockPayload?.data?.policyId === 'policy-321', 'Policy App push FCM payload must include policyId');
assert(policy.mockPayload?.title?.includes('新运营政策'), 'Policy App push mock payload must include policy notification title');
assert(policy.mockPayload?.body?.includes('Mock Policy'), 'Policy App push mock payload must include policy title');

const brand = await invoke({
  action: 'notifyPolicy',
  targetType: 'app',
  policyId: 'brand-654',
  title: 'Mock Brand Material',
  description: 'Mock brand push verification',
  type: 'poster',
  targetTeam: 'all',
  section: 'brand'
});

assert(brand.success === true, 'Brand App push verification must succeed in mock Firebase mode');
assert(brand.mockPayload?.data?.type === 'brand', 'Brand App push FCM payload must include type=brand');
assert(brand.mockPayload?.data?.policyId === 'brand-654', 'Brand App push FCM payload must include policyId');
assert(brand.mockPayload?.title?.includes('新品牌物料'), 'Brand App push mock payload must include brand notification title');

console.log('DingTalk and FCM push payload behavior verified.');
