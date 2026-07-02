export const CLIENT_APP_VERSIONS: Record<string, string> = {
    ios: '1.1',
    android: '1.0.7',
    web: '1.0.7'
};

export const getCurrentClientAppVersion = (platform = 'web') => {
    return CLIENT_APP_VERSIONS[platform] || CLIENT_APP_VERSIONS.web;
};

export const compareVersions = (left: string, right: string) => {
    const leftParts = left.split('.').map(Number);
    const rightParts = right.split('.').map(Number);

    for (let i = 0; i < Math.max(leftParts.length, rightParts.length); i += 1) {
        const leftPart = leftParts[i] || 0;
        const rightPart = rightParts[i] || 0;
        if (leftPart < rightPart) return -1;
        if (leftPart > rightPart) return 1;
    }

    return 0;
};

export const isVersionOutdated = (current: string, latest: string) => {
    return compareVersions(current, latest) < 0;
};

export const getLatestClientAppVersion = (
    platform = 'web',
    remoteConfig?: { ios_latest?: string; android_latest?: string; web_latest?: string } | null
) => {
    const bundledLatest = getCurrentClientAppVersion(platform);
    const remoteLatest = platform === 'ios'
        ? remoteConfig?.ios_latest
        : platform === 'android'
            ? remoteConfig?.android_latest
            : remoteConfig?.web_latest;

    if (!remoteLatest) return bundledLatest;
    return compareVersions(remoteLatest, bundledLatest) >= 0 ? remoteLatest : bundledLatest;
};
