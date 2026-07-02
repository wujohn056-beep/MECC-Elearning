export type TaskRecordingGroupCategory = {
    id: string;
    name: string;
};

export type TaskRecordingGroupRecording = {
    id: string;
    categoryId?: string;
    categoryName?: string;
};

export type TaskRecordingGroup = {
    key: string;
    name: string;
    recordingIds: string[];
};

export const getTaskRecordingGroups = (
    taskRecordingIds: string[],
    recordings: TaskRecordingGroupRecording[],
    categories: TaskRecordingGroupCategory[],
    uncategorizedName: string
): TaskRecordingGroup[] => {
    const groups: (TaskRecordingGroup & { categoryOrder: number; firstSeen: number })[] = [];
    const groupIndex = new Map<string, number>();
    const recordingById = new Map(recordings.map(recording => [recording.id, recording]));
    const categoryById = new Map(categories.map(category => [category.id, category]));
    const categoryOrderById = new Map(categories.map((category, index) => [category.id, index]));
    const categoryOrderByName = new Map<string, number>();

    categories.forEach((category, index) => {
        const normalizedName = (category.name || '').trim().toLowerCase();
        if (normalizedName && !categoryOrderByName.has(normalizedName)) {
            categoryOrderByName.set(normalizedName, index);
        }
    });

    taskRecordingIds.forEach((recordingId, recordingIndex) => {
        const recording = recordingById.get(recordingId);
        if (!recording) return;

        const rawCategoryName = recording.categoryName || '';
        const normalizedRawName = rawCategoryName.trim().toLowerCase();
        const matchedCategoryByName = normalizedRawName
            ? categories.find(category => category.name.trim().toLowerCase() === normalizedRawName)
            : undefined;
        const category = recording.categoryId ? categoryById.get(recording.categoryId) : matchedCategoryByName;
        const categoryName = category?.name || recording.categoryName || uncategorizedName;
        const groupKey = category?.id || recording.categoryId || `name:${categoryName}`;
        const normalizedName = (categoryName || '').trim().toLowerCase();
        const categoryOrder = recording.categoryId && categoryOrderById.has(recording.categoryId)
            ? categoryOrderById.get(recording.categoryId)!
            : categoryOrderByName.get(normalizedName) ?? Number.MAX_SAFE_INTEGER;

        if (!groupIndex.has(groupKey)) {
            groupIndex.set(groupKey, groups.length);
            groups.push({
                key: groupKey,
                name: categoryName,
                recordingIds: [],
                categoryOrder,
                firstSeen: recordingIndex
            });
        }

        groups[groupIndex.get(groupKey)!].recordingIds.push(recordingId);
    });

    return groups
        .sort((a, b) => {
            if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder;
            return a.firstSeen - b.firstSeen;
        })
        .map(({ key, name, recordingIds }) => ({ key, name, recordingIds }));
};
