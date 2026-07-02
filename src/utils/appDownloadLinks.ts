export const DEFAULT_IOS_TESTFLIGHT_URL = 'https://testflight.apple.com/join/s2t21vU5';
export const DEFAULT_ANDROID_APK_PATH = '/downloads/mecc-latest.apk';

export const getDefaultAndroidApkUrl = () => {
    if (typeof window === 'undefined') return DEFAULT_ANDROID_APK_PATH;
    return `${window.location.origin}${DEFAULT_ANDROID_APK_PATH}`;
};

export const resolveAppDownloadUrl = (
    platform: string,
    config?: { ios_testflight_url?: string; android_apk_url?: string } | null
) => {
    if (platform === 'ios') {
        return config?.ios_testflight_url || DEFAULT_IOS_TESTFLIGHT_URL;
    }

    return config?.android_apk_url || getDefaultAndroidApkUrl();
};
