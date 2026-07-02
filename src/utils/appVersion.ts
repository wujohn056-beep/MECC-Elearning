export const CLIENT_APP_VERSIONS: Record<string, string> = {
    ios: '1.1',
    android: '1.0.7',
    web: '1.0.7'
};

export const getCurrentClientAppVersion = (platform = 'web') => {
    return CLIENT_APP_VERSIONS[platform] || CLIENT_APP_VERSIONS.web;
};

export const isVersionOutdated = (current: string, latest: string) => {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i += 1) {
        const currentPart = currentParts[i] || 0;
        const latestPart = latestParts[i] || 0;
        if (currentPart < latestPart) return true;
        if (currentPart > latestPart) return false;
    }

    return false;
};
