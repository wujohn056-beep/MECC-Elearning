export const getEffectiveUserId = (
    user: { uid?: string } | null | undefined,
    profile: { realUid?: string } | null | undefined
) => {
    return profile?.realUid || user?.uid || '';
};
