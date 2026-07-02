type CampaignConditions = {
    category?: string;
    requiredMinutes?: number;
    requiredTaskIds?: string[];
};

type CampaignLike = {
    conditions?: CampaignConditions;
};

type RecordingLike = {
    id: string;
};

export const getCampaignRequiredRecordings = <T extends RecordingLike>(
    campaign: CampaignLike | null | undefined,
    recordings: T[]
) => {
    if (!campaign?.conditions) return [];

    if (campaign.conditions.category) {
        return recordings.filter(recording =>
            (recording as T & { categoryId?: string }).categoryId === campaign.conditions?.category &&
            (!campaign.conditions?.requiredTaskIds ||
                campaign.conditions.requiredTaskIds.length === 0 ||
                campaign.conditions.requiredTaskIds.includes(recording.id))
        );
    }

    if (campaign.conditions.requiredTaskIds) {
        return recordings.filter(recording => campaign.conditions?.requiredTaskIds?.includes(recording.id));
    }

    return [];
};

export const calculateCampaignProgress = (
    campaign: CampaignLike | null | undefined,
    requiredRecordings: RecordingLike[],
    completedRecordingIds: string[]
) => {
    if (!campaign?.conditions) {
        return { completed: false, percent: 0, progressValue: 0, requiredValue: 0, mode: 'none' as const };
    }

    if (campaign.conditions.category) {
        const requiredRecordingIds = new Set(requiredRecordings.map(recording => recording.id));
        const completedInCampaign = Array.from(new Set(
            completedRecordingIds.filter(id => requiredRecordingIds.has(id))
        ));
        const progressMins = completedInCampaign.length * 12;
        const requiredMins = campaign.conditions.requiredMinutes || 120;

        return {
            completed: progressMins >= requiredMins,
            percent: Math.min(100, Math.round((progressMins / requiredMins) * 100)),
            progressValue: progressMins,
            requiredValue: requiredMins,
            mode: 'minutes' as const
        };
    }

    const requiredIds = campaign.conditions.requiredTaskIds || [];
    const completedTasks = Array.from(new Set(completedRecordingIds.filter(id => requiredIds.includes(id))));

    return {
        completed: requiredIds.length > 0 && completedTasks.length === requiredIds.length,
        percent: requiredIds.length > 0 ? Math.min(100, Math.round((completedTasks.length / requiredIds.length) * 100)) : 0,
        progressValue: completedTasks.length,
        requiredValue: requiredIds.length,
        mode: 'courses' as const
    };
};
