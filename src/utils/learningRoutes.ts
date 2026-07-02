type LearningRouteTarget =
    | { type: 'campaign'; campaignId?: string }
    | { type: 'task'; taskId?: string }
    | { type: 'recording'; recordingId?: string };

export const buildLearningRoute = (target: LearningRouteTarget): string => {
    const params = new URLSearchParams();

    if (target.type === 'campaign' && target.campaignId) {
        params.set('campaignLearnId', target.campaignId);
    }

    if (target.type === 'task' && target.taskId) {
        params.set('taskId', target.taskId);
    }

    if (target.type === 'recording' && target.recordingId) {
        params.set('recordingId', target.recordingId);
    }

    const query = params.toString();
    return query ? `/hub?${query}` : '/hub';
};
