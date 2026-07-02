import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw, Save, Smartphone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { CLIENT_APP_VERSIONS, getCurrentClientAppVersion } from '../../utils/appVersion';
import { DEFAULT_IOS_TESTFLIGHT_URL, getDefaultAndroidApkUrl } from '../../utils/appDownloadLinks';

interface AppReleaseConfig {
    android_latest: string;
    ios_latest: string;
    web_latest: string;
    min_required_version: string;
    android_apk_url: string;
    ios_testflight_url: string;
}

const DEFAULT_RELEASE_CONFIG: AppReleaseConfig = {
    android_latest: CLIENT_APP_VERSIONS.android,
    ios_latest: CLIENT_APP_VERSIONS.ios,
    web_latest: CLIENT_APP_VERSIONS.web,
    min_required_version: '',
    android_apk_url: '',
    ios_testflight_url: DEFAULT_IOS_TESTFLIGHT_URL
};

const normalizeReleaseConfig = (data: Partial<AppReleaseConfig> | null): AppReleaseConfig => ({
    android_latest: data?.android_latest || DEFAULT_RELEASE_CONFIG.android_latest,
    ios_latest: data?.ios_latest || DEFAULT_RELEASE_CONFIG.ios_latest,
    web_latest: data?.web_latest || DEFAULT_RELEASE_CONFIG.web_latest,
    min_required_version: data?.min_required_version || '',
    android_apk_url: data?.android_apk_url || '',
    ios_testflight_url: data?.ios_testflight_url || DEFAULT_RELEASE_CONFIG.ios_testflight_url
});

export default function AppReleaseManager() {
    const { t } = useTranslation();
    const { isSuperAdmin, profile } = useAuth();
    const [config, setConfig] = useState<AppReleaseConfig>(DEFAULT_RELEASE_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadConfig = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const snap = await getDoc(doc(db, 'system_config', 'app_versions'));
            setConfig(normalizeReleaseConfig(snap.exists() ? snap.data() as Partial<AppReleaseConfig> : null));
        } catch (err) {
            console.error('Error loading app release config:', err);
            setError(t('app_release.load_error', '无法读取当前 App 发布配置，请检查网络或 Firestore 权限。'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (isSuperAdmin) {
            loadConfig();
        }
    }, [isSuperAdmin, loadConfig]);

    if (!isSuperAdmin) {
        return <Navigate to="/admin" replace />;
    }

    const updateField = (field: keyof AppReleaseConfig, value: string) => {
        setConfig(prev => ({ ...prev, [field]: value.trim() }));
        setSuccess(null);
        setError(null);
    };

    const saveConfig = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await setDoc(doc(db, 'system_config', 'app_versions'), {
                ...config,
                android_latest: config.android_latest || getCurrentClientAppVersion('android'),
                ios_latest: config.ios_latest || getCurrentClientAppVersion('ios'),
                web_latest: config.web_latest || getCurrentClientAppVersion('web'),
                android_apk_url: config.android_apk_url,
                ios_testflight_url: config.ios_testflight_url || DEFAULT_IOS_TESTFLIGHT_URL,
                updatedAt: serverTimestamp(),
                updatedBy: profile?.crmId || 'super_admin'
            }, { merge: true });
            await loadConfig();
            setSuccess(t('app_release.save_success', 'App 发布配置已保存，旧版 App 将按最新版本号显示更新提醒。'));
        } catch (err) {
            console.error('Error saving app release config:', err);
            setError(t('app_release.save_error', '保存失败，请检查 Firestore 权限或稍后重试。'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[320px] flex items-center justify-center text-deep-teal">
                <Loader2 className="w-7 h-7 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 text-arabian-night">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-deep-teal/10 text-deep-teal text-xs font-black uppercase tracking-wide">
                        <Smartphone className="w-4 h-4" />
                        {t('app_release.badge', 'App Release')}
                    </div>
                    <h1 className="text-3xl font-black text-deep-teal mt-3">
                        {t('app_release.title', 'App 发布配置')}
                    </h1>
                    <p className="text-sm text-slate-500 mt-2 max-w-2xl">
                        {t('app_release.subtitle', '发布新 APK 后在这里同步最新版本号和下载链接，保证 Web 下载页与旧版 App 更新提醒保持一致。')}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={loadConfig}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                    >
                        <RefreshCw className="w-4 h-4" />
                        {t('common.refresh', '刷新')}
                    </button>
                    <button
                        type="button"
                        onClick={saveConfig}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-deep-teal text-white font-bold hover:bg-deep-teal/90 disabled:opacity-60 cursor-pointer"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {t('common.save', '保存')}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{success}</span>
                </div>
            )}

            <div className="grid lg:grid-cols-3 gap-4">
                <label className="space-y-2">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-wide">
                        {t('app_release.android_latest', 'Android 最新版本')}
                    </span>
                    <input
                        value={config.android_latest}
                        onChange={event => updateField('android_latest', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-deep-teal/30"
                        placeholder={getCurrentClientAppVersion('android')}
                    />
                </label>
                <label className="space-y-2">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-wide">
                        {t('app_release.ios_latest', 'iOS 最新版本')}
                    </span>
                    <input
                        value={config.ios_latest}
                        onChange={event => updateField('ios_latest', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-deep-teal/30"
                        placeholder={getCurrentClientAppVersion('ios')}
                    />
                </label>
                <label className="space-y-2">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-wide">
                        {t('app_release.web_latest', 'Web 最新版本')}
                    </span>
                    <input
                        value={config.web_latest}
                        onChange={event => updateField('web_latest', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-deep-teal/30"
                        placeholder={getCurrentClientAppVersion('web')}
                    />
                </label>
            </div>

            <label className="block space-y-2">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wide">
                    {t('app_release.min_required_version', '最低可用版本')}
                </span>
                <input
                    value={config.min_required_version}
                    onChange={event => updateField('min_required_version', event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-deep-teal/30"
                    placeholder={t('app_release.min_required_placeholder', '留空表示不强制更新')}
                />
                <p className="text-xs text-slate-500">
                    {t('app_release.min_required_hint', '只有确实需要拦截旧版本时再填写；普通发版只更新最新版本号即可。')}
                </p>
            </label>

            <div className="grid lg:grid-cols-2 gap-4">
                <label className="space-y-2">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-wide">
                        {t('app_release.android_url', 'Android APK 下载链接')}
                    </span>
                    <input
                        value={config.android_apk_url}
                        onChange={event => updateField('android_apk_url', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-deep-teal/30"
                        placeholder={getDefaultAndroidApkUrl()}
                    />
                </label>
                <label className="space-y-2">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-wide">
                        {t('app_release.ios_url', 'iOS TestFlight 链接')}
                    </span>
                    <input
                        value={config.ios_testflight_url}
                        onChange={event => updateField('ios_testflight_url', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-deep-teal/30"
                        placeholder={DEFAULT_IOS_TESTFLIGHT_URL}
                    />
                </label>
            </div>

            <div className="rounded-lg border border-desert-gold/30 bg-desert-gold/10 px-4 py-4 text-sm text-slate-700 leading-relaxed">
                <p className="font-bold text-deep-teal mb-1">{t('app_release.checklist_title', '发布后确认')}</p>
                <p>{t('app_release.checklist_body', '确认 APK 已部署到下载链接，Android 最新版本等于本次 APK versionName，并用旧版 App 打开一次学习中心验证更新提醒。')}</p>
                <a
                    href="/download"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-deep-teal font-bold hover:underline"
                >
                    {t('app_release.open_download', '打开下载页')}
                    <ExternalLink className="w-4 h-4" />
                </a>
            </div>
        </div>
    );
}
