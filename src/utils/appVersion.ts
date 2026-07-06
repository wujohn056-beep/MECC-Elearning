export const CLIENT_APP_VERSIONS: Record<string, string> = {
    ios: '1.1',
    android: '1.0.7',
    web: '1.0.7'
};

export const CLIENT_APP_BUILDS: Record<string, number> = {
    ios: 8,
    android: 7,
    web: 0
};

export interface AppVersionRemoteConfig {
    ios_latest?: string;
    android_latest?: string;
    web_latest?: string;
    ios_latest_build?: string | number;
    android_latest_build?: string | number;
    web_latest_build?: string | number;
}

const isNativeReleasePlatform = (platform = 'web') => platform === 'ios' || platform === 'android';

const parseBuildNumber = (value: string | number | undefined | null) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export const getCurrentClientAppVersion = (platform = 'web') => {
    return CLIENT_APP_VERSIONS[platform] || CLIENT_APP_VERSIONS.web;
};

export const getCurrentClientAppBuild = (platform = 'web') => {
    return CLIENT_APP_BUILDS[platform] ?? CLIENT_APP_BUILDS.web;
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

const getRemoteLatestVersion = (
    platform = 'web',
    remoteConfig?: AppVersionRemoteConfig | null
) => {
    return platform === 'ios'
        ? remoteConfig?.ios_latest
        : platform === 'android'
            ? remoteConfig?.android_latest
            : remoteConfig?.web_latest;
};

const getRemoteLatestBuild = (
    platform = 'web',
    remoteConfig?: AppVersionRemoteConfig | null
) => {
    const remoteBuild = platform === 'ios'
        ? remoteConfig?.ios_latest_build
        : platform === 'android'
            ? remoteConfig?.android_latest_build
            : remoteConfig?.web_latest_build;
    return parseBuildNumber(remoteBuild);
};

export const getLatestClientAppVersion = (
    platform = 'web',
    remoteConfig?: AppVersionRemoteConfig | null
) => {
    const bundledLatest = getCurrentClientAppVersion(platform);
    const remoteLatest = getRemoteLatestVersion(platform, remoteConfig);

    if (!remoteLatest) return bundledLatest;
    return compareVersions(remoteLatest, bundledLatest) >= 0 ? remoteLatest : bundledLatest;
};

export const getLatestClientAppBuild = (
    platform = 'web',
    remoteConfig?: AppVersionRemoteConfig | null
) => {
    const bundledVersion = getCurrentClientAppVersion(platform);
    const bundledBuild = getCurrentClientAppBuild(platform);
    const remoteVersion = getRemoteLatestVersion(platform, remoteConfig);
    const remoteBuild = getRemoteLatestBuild(platform, remoteConfig);

    if (!isNativeReleasePlatform(platform)) return 0;
    if (!remoteVersion) return bundledBuild;

    const versionComparison = compareVersions(remoteVersion, bundledVersion);
    if (versionComparison > 0) return remoteBuild;
    if (versionComparison < 0) return bundledBuild;
    return Math.max(remoteBuild, bundledBuild);
};

export const isClientReleaseOutdated = (
    platform = 'web',
    currentVersion: string,
    latestVersion: string,
    currentBuild: string | number = getCurrentClientAppBuild(platform),
    latestBuild: string | number = 0
) => {
    const versionComparison = compareVersions(currentVersion, latestVersion);
    if (versionComparison !== 0) return versionComparison < 0;
    if (!isNativeReleasePlatform(platform)) return false;
    return parseBuildNumber(currentBuild) < parseBuildNumber(latestBuild);
};

export const isClientAppOutdated = (
    platform = 'web',
    currentVersion = getCurrentClientAppVersion(platform),
    remoteConfig?: AppVersionRemoteConfig | null,
    currentBuild: string | number = getCurrentClientAppBuild(platform)
) => {
    const latestVersion = getLatestClientAppVersion(platform, remoteConfig);
    const latestBuild = getLatestClientAppBuild(platform, remoteConfig);
    return isClientReleaseOutdated(platform, currentVersion, latestVersion, currentBuild, latestBuild);
};

export const formatClientRelease = (
    platform = 'web',
    version = getCurrentClientAppVersion(platform),
    build: string | number = getCurrentClientAppBuild(platform)
) => {
    const parsedBuild = parseBuildNumber(build);
    if (!isNativeReleasePlatform(platform) || parsedBuild <= 0) return version;
    return `${version} (${parsedBuild})`;
};
