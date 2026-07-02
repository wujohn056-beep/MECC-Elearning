type LearningRouteTarget =
    | { type: 'campaign'; campaignId?: string }
    | { type: 'task'; taskId?: string }
    | { type: 'recording'; recordingId?: string };

const focusedRouteParams = ['campaignLearnId', 'taskId', 'recordingId', 'campaignId', 'publicTab'];

export const buildLearningSearchParams = (
    target: LearningRouteTarget,
    existingParams?: URLSearchParams | string
): URLSearchParams => {
    const params = new URLSearchParams(existingParams || '');

    focusedRouteParams.forEach(param => params.delete(param));

    if (target.type === 'campaign' && target.campaignId) {
        params.set('campaignLearnId', target.campaignId);
    }

    if (target.type === 'task' && target.taskId) {
        params.set('taskId', target.taskId);
    }

    if (target.type === 'recording' && target.recordingId) {
        params.set('recordingId', target.recordingId);
    }

    return params;
};

export const buildLearningRoute = (
    target: LearningRouteTarget,
    existingParams?: URLSearchParams | string
): string => {
    const params = buildLearningSearchParams(target, existingParams);

    const query = params.toString();
    return query ? `/hub?${query}` : '/hub';
};
