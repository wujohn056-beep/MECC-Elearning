import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Key, AlertCircle, CheckCircle, ChevronDown, X, Compass, CheckSquare, BarChart2, Settings, BookOpen, ArrowDownToLine, Download } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { updatePassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Capacitor } from '@capacitor/core';

const ChangePasswordModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (newPassword !== confirmPassword) {
            setError(t('common.password_mismatch'));
            return;
        }

        if (newPassword.length < 6) {
            setError(t('common.password_length'));
            return;
        }

        try {
            setLoading(true);
            if (user) {
                await updatePassword(user, newPassword);
                setSuccess(true);
                setTimeout(() => {
                    onClose();
                    setSuccess(false);
                    setNewPassword('');
                    setConfirmPassword('');
                }, 2000);
            }
        } catch (err: any) {
            if (err.code === 'auth/requires-recent-login') {
                setError(t('common.reauth_needed'));
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-lg font-bold text-deep-teal flex items-center gap-2">
                        <Key className="w-5 h-5 text-desert-gold" />
                        {t('common.change_password')}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-arabian-night/70 mb-1">{t('common.new_password')}</label>
                        <input 
                            type="password" 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent text-sm outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-arabian-night/70 mb-1">{t('common.confirm_password')}</label>
                        <input 
                            type="password" 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent text-sm outline-none"
                            required
                        />
                    </div>
                    {error && (
                        <p className="text-xs text-red-500 flex items-start gap-1">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </p>
                    )}
                    {success && (
                        <p className="text-sm text-green-600 flex items-center gap-1 font-bold">
                            <CheckCircle className="w-4 h-4" /> {t('common.password_success')}
                        </p>
                    )}
                    <div className="pt-2">
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full py-2.5 bg-deep-teal text-white rounded-xl font-bold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : t('common.update_password')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function AppLayout() {
    const { t, i18n } = useTranslation();
    const { logout, isSuperAdmin, isLeader, profile, user, hasAnyAdminPermission, canAccessTasks, canAccessDashboard } = useAuth();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);

    const isTrainingUser = profile?.identity === 'Training Dep' || 
        (profile?.team || '').toLowerCase().includes('training');

    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [updateConfig, setUpdateConfig] = useState<any>(null);
    const [isForceUpdate, setIsForceUpdate] = useState(false);
    const [showWebBanner, setShowWebBanner] = useState(false);

    // 1. Mobile Web Smart Banner Effect
    useEffect(() => {
        if (Capacitor.isNativePlatform() || isTrainingUser) return;
        const ua = navigator.userAgent.toLowerCase();
        const isMobile = /iphone|ipad|ipod|android/i.test(ua);
        const isBannerDismissed = localStorage.getItem('hide-web-download-banner') === 'true';
        
        if (isMobile && !isBannerDismissed) {
            setShowWebBanner(true);
        }
    }, [isTrainingUser]);

    // 2. App-Side Version Checker Effect
    const CURRENT_APP_VERSION = '1.0.0'; // Hardcoded baseline version code for current client packaging

    useEffect(() => {
        if (!Capacitor.isNativePlatform() || isTrainingUser) return;

        const checkAppVersion = async () => {
            try {
                const { doc, getDoc } = await import('firebase/firestore');
                const docSnap = await getDoc(doc(db, 'system_config', 'app_versions'));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const platform = Capacitor.getPlatform(); // 'ios' or 'android'
                    const latestVersion = platform === 'ios' ? data.ios_latest : data.android_latest;
                    
                    const parseVersion = (v: string) => v.split('.').map(Number);
                    const isOutdated = (current: string, latest: string) => {
                        const cur = parseVersion(current);
                        const lat = parseVersion(latest);
                        for (let i = 0; i < Math.max(cur.length, lat.length); i++) {
                            const c = cur[i] || 0;
                            const l = lat[i] || 0;
                            if (c < l) return true;
                            if (c > l) return false;
                        }
                        return false;
                    };

                    if (latestVersion && isOutdated(CURRENT_APP_VERSION, latestVersion)) {
                        const forceUpdate = data.min_required_version && isOutdated(CURRENT_APP_VERSION, data.min_required_version);
                        setUpdateConfig(data);
                        setIsForceUpdate(!!forceUpdate);
                        setShowUpdateModal(true);
                    }
                }
            } catch (err) {
                console.error("Error checking app version:", err);
            }
        };

        const timer = setTimeout(checkAppVersion, 3000);
        return () => clearTimeout(timer);
    }, [isTrainingUser]);

    const [appTheme, setAppTheme] = useState<'oasis' | 'dusk' | 'dark'>(() => {
        return (localStorage.getItem('app-theme') as 'oasis' | 'dusk' | 'dark') || 'oasis';
    });

    const cycleTheme = () => {
        setAppTheme(prev => {
            const next = prev === 'oasis' ? 'dusk' : prev === 'dusk' ? 'dark' : 'oasis';
            localStorage.setItem('app-theme', next);
            window.dispatchEvent(new Event('app-theme-changed'));
            return next;
        });
    };

    useEffect(() => {
        if (appTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        document.documentElement.setAttribute('data-theme', appTheme);
    }, [appTheme]);

    useEffect(() => {
        const syncTheme = () => {
            const stored = (localStorage.getItem('app-theme') as 'oasis' | 'dusk' | 'dark') || 'oasis';
            setAppTheme(stored);
        };
        window.addEventListener('app-theme-changed', syncTheme);
        return () => window.removeEventListener('app-theme-changed', syncTheme);
    }, []);
    const menuRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();

    const toggleLanguage = () => {
        const nextLang = i18n.language === 'en' ? 'ar' : (i18n.language === 'ar' ? 'zh' : 'en');
        i18n.changeLanguage(nextLang);
    };

    // Keep document direction updated for RTL support
    useEffect(() => {
        document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    }, [i18n.language]);

    // Dynamically update document title and share preview meta tags unconditionally in English to satisfy social platform card standards
    useEffect(() => {
        document.title = "ME Cloud Academy - Premium Sales Recordings";

        const updateMeta = (selector: string, attr: string, value: string) => {
            const el = document.querySelector(selector);
            if (el) {
                el.setAttribute(attr, value);
            }
        };
        updateMeta('meta[name="description"]', 'content', 'ME Cloud Academy premium sales recordings library. Review excellent recordings to boost professional growth!');
        updateMeta('meta[property="og:title"]', 'content', 'ME Cloud Academy - Premium Sales Recordings');
        updateMeta('meta[property="og:description"]', 'content', 'Review excellent recordings to boost professional growth! Click the link to enter your dedicated Cloud Academy and start learning.');
    }, []);

    // Push Notifications Click Handler
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let actionListener: any = null;

        const setupActionListener = async () => {
            try {
                const { PushNotifications } = await import('@capacitor/push-notifications');

                actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                    console.log('[Native Push] Notification action clicked:', action);
                    const notification = action.notification;
                    const data = notification.data;

                    if (data) {
                        const type = data.type;
                        if (type === 'recording' && data.recordingId) {
                            console.log('[Native Push] Navigating to recording:', data.recordingId);
                            navigate(`/hub?recordingId=${data.recordingId}`);
                        } else if (type === 'task' && data.taskId) {
                            console.log('[Native Push] Navigating to task:', data.taskId);
                            navigate(`/hub?taskId=${data.taskId}`);
                        } else if (type === 'task') {
                            console.log('[Native Push] Navigating to tasks list');
                            navigate('/account');
                        }
                    }
                });
            } catch (err) {
                console.error('[Native Push] Error setting up click listener:', err);
            }
        };

        setupActionListener();

        return () => {
            if (actionListener && typeof actionListener.remove === 'function') {
                actionListener.remove();
            }
        };
    }, [navigate]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Daily Login Tracking
    useEffect(() => {
        const trackDailyLogin = async () => {
            if (user && profile && profile.role !== 'super_admin') {
                try {
                    const today = new Date().toISOString().split('T')[0];
                    const currentPlatform = Capacitor.getPlatform();
                    
                    // Update user profile document with version telemetry
                    const userRef = doc(db, 'users', user.uid);
                    await setDoc(userRef, {
                        lastActiveAt: serverTimestamp(),
                        appVersion: '1.0.4',
                        platform: currentPlatform
                    }, { merge: true });

                    // Daily login activity log
                    const logRef = doc(db, 'user_activity_logs', `${user.uid}_${today}`);
                    await setDoc(logRef, {
                        userId: user.uid,
                        crmId: profile.crmId || '',
                        name: (profile as any).name || profile.crmId || '',
                        role: profile.role || 'user',
                        sd: profile.sd || '',
                        sm: profile.sm || '',
                        tl: profile.tl || '',
                        team: profile.team || '',
                        date: today,
                        lastLoginAt: serverTimestamp(),
                        appVersion: '1.0.4',
                        platform: currentPlatform
                    }, { merge: true });
                } catch (error) {
                    console.error("Failed to track login", error);
                }
            }
        };
        trackDailyLogin();
    }, [user, profile]);

    const isNative = Capacitor.isNativePlatform();

    const getNavLinkClass = (path: string) => {
        const isActive = location.pathname.startsWith(path);
        return `text-sm sm:text-base font-bold transition-all border-b-[3px] pb-1 px-1 ${
            isActive 
                ? 'text-deep-teal border-deep-teal' 
                : 'text-arabian-night/60 border-transparent hover:text-desert-gold hover:border-desert-gold/30'
        }`;
    };

    const getBottomTabClass = (path: string) => {
        return "flex flex-col items-center justify-center flex-1 h-full select-none cursor-pointer";
    };

    return (
        <div 
            className={`min-h-screen transition-colors duration-500 relative bg-cover bg-center bg-fixed ${
                appTheme === 'dark' ? 'text-slate-100 bg-slate-950' : 'text-arabian-night'
            }`}
            style={{ 
                backgroundImage: `url(${
                    appTheme === 'dusk' 
                        ? '/images/app-bg-dusk.png' 
                        : appTheme === 'dark' 
                            ? '/images/app-bg-dark.png' 
                            : '/images/app-bg.png'
                })` 
            }}
        >
            {/* Subtle glass overlay for the entire app background */}
            <div className={`fixed inset-0 pointer-events-none z-0 transition-colors duration-500 ${
                appTheme === 'dark' 
                    ? 'bg-slate-950/60 backdrop-blur-[0.5px]' 
                    : appTheme === 'dusk'
                        ? 'bg-orange-950/10 backdrop-blur-[1px]'
                        : 'bg-white/15 backdrop-blur-[1px]'
            }`}></div>
            
            <div className="relative z-10 flex flex-col min-h-screen">
                {/* Mobile Web Smart Banner */}
                {!isTrainingUser && showWebBanner && (
                    <div className="bg-gradient-to-r from-deep-teal to-blue-900 text-white px-4 py-3 flex items-center justify-between shadow-lg relative animate-in slide-in-from-top duration-300 z-[99] border-b border-white/10 shrink-0">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-lg">📱</span>
                            <p className="text-xs font-semibold truncate">
                                下载 MECC 移动客户端，享受更流畅的学习体验与消息提醒！
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => {
                                    navigate('/download');
                                }}
                                className="bg-desert-gold hover:bg-desert-gold/90 text-slate-900 text-[11px] font-black px-3 py-1.5 rounded-lg shadow transition-all cursor-pointer"
                            >
                                立即去下载
                            </button>
                            <button 
                                onClick={() => {
                                    localStorage.setItem('hide-web-download-banner', 'true');
                                    setShowWebBanner(false);
                                }}
                                className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Navigation Bar */}
                <nav className="glass-panel sticky top-0 z-50 p-4 pt-safe flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="" className="h-9 sm:h-11 object-contain drop-shadow-md" />
                        <h1 className="text-2xl font-extrabold text-gradient-gold tracking-wide hidden sm:block">
                            {t('navbar.title')}
                        </h1>
                    </div>
                    <div className="flex gap-4 sm:gap-6 items-center pt-1">
                        {/* Only show nav links on desktop web */}
                        {!isNative && (
                            <div className="hidden md:flex gap-4 sm:gap-6 items-center">
                                <Link to="/hub" className={getNavLinkClass('/hub')}>{t('navbar.learning_hub')}</Link>
                                <Link to="/policies" className={getNavLinkClass('/policies')}>{t('navbar.operations_policies')}</Link>
                                {canAccessTasks && (
                                    <Link to="/team-tasks" className={getNavLinkClass('/team-tasks')}>{t('navbar.team_tasks')}</Link>
                                )}
                                {(canAccessDashboard && !isSuperAdmin) && (
                                    <Link to="/dashboard" className={getNavLinkClass('/dashboard')}>{t('navbar.dashboard', '数据看板')}</Link>
                                )}
                                <Link to="/account" className={getNavLinkClass('/account')}>{t('navbar.personal_center')}</Link>
                                {(isSuperAdmin || hasAnyAdminPermission) && (
                                    <Link to={isSuperAdmin ? "/admin" : "/admin/users"} className={getNavLinkClass('/admin')}>{t('navbar.admin_dashboard', '管理后台')}</Link>
                                )}
                            </div>
                        )}
                        
                        {/* Theme Toggle Switcher */}
                        <button
                            onClick={cycleTheme}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm transition-all duration-300 active:scale-95 cursor-pointer ${
                                appTheme === 'dark'
                                    ? 'bg-slate-900/60 border-slate-700/50 text-amber-400 hover:bg-slate-800'
                                    : appTheme === 'dusk'
                                        ? 'bg-orange-950/15 border-orange-200/30 text-orange-500 hover:bg-orange-100/40'
                                        : 'bg-deep-teal/10 border-deep-teal/15 text-deep-teal hover:bg-deep-teal/20'
                            }`}
                            title={t('navbar.toggle_theme', '切换视觉主题')}
                        >
                            <span className="text-sm">
                                {appTheme === 'oasis' ? '🌴' : appTheme === 'dusk' ? '🌅' : '🌌'}
                            </span>
                            <span className="text-xs font-black hidden sm:inline">
                                {appTheme === 'oasis' 
                                    ? t('theme.oasis', '约旦绿洲') 
                                    : appTheme === 'dusk' 
                                        ? t('theme.dusk', '佩特拉暮色') 
                                        : t('theme.dark', '阿拉伯星空')}
                            </span>
                        </button>

                        <NotificationBell />
                        
                        {isNative ? (
                            <button 
                                onClick={toggleLanguage} 
                                className="bg-deep-teal/10 hover:bg-deep-teal/20 text-deep-teal text-xs font-extrabold px-3 py-1.5 rounded-full border border-deep-teal/15 shadow-sm active:scale-95 transition-all"
                            >
                                {i18n.language.toUpperCase()}
                            </button>
                        ) : (
                            <button onClick={toggleLanguage} className="hidden md:block bg-deep-teal/10 hover:bg-deep-teal/20 text-deep-teal px-4 py-2 rounded-full text-sm font-semibold transition-colors shadow-sm">
                                {t('common.language')} ({i18n.language.toUpperCase()})
                            </button>
                        )}

                        {/* User Dropdown Menu */}
                        <div className="relative ml-1 sm:ml-2" ref={menuRef}>
                            <button 
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-1.5 sm:gap-2 bg-white/60 hover:bg-white border border-gray-200 px-2 sm:px-3 py-1.5 rounded-full transition-colors shadow-sm"
                            >
                                <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-deep-teal text-white shadow-sm shrink-0">
                                    {profile?.avatarUrl ? (
                                        <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-3.5 h-3.5" />
                                    )}
                                </div>
                                <span className="text-sm font-bold text-arabian-night hidden md:block max-w-[80px] truncate">
                                    {profile?.crmId || 'User'}
                                </span>
                                <ChevronDown className="w-3.5 h-3.5 text-arabian-night/50" />
                            </button>

                            {showUserMenu && (
                                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 border-b border-gray-50 bg-gradient-to-br from-gray-50 to-white">
                                        <div className="flex items-center gap-3 mb-3">
                                            <Link 
                                                to="/account"
                                                onClick={() => setShowUserMenu(false)}
                                                className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-desert-gold to-yellow-600 text-white shadow-sm shrink-0 border-2 border-white hover:opacity-85 transition-opacity"
                                                title={t('navbar.personal_center', '个人学习中心')}
                                            >
                                                {profile?.avatarUrl ? (
                                                    <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <User className="w-6 h-6" />
                                                )}
                                            </Link>
                                            <div className="min-w-0">
                                                <p className="font-extrabold text-arabian-night truncate text-base">{profile?.crmId}</p>
                                                <span className="text-[10px] font-bold text-desert-gold uppercase bg-desert-gold/10 px-2 py-0.5 rounded-full border border-desert-gold/20 inline-block mt-0.5">
                                                    {profile?.role}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 bg-white p-3 rounded-xl border border-gray-100 shadow-sm mt-2">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-arabian-night/40 uppercase">SD</span>
                                                <span className="font-semibold text-arabian-night">{profile?.sd || '-'}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-arabian-night/40 uppercase">SM</span>
                                                <span className="font-semibold text-arabian-night">{profile?.sm || '-'}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-arabian-night/40 uppercase">Team</span>
                                                <span className="font-semibold text-arabian-night truncate max-w-[120px]" title={profile?.team}>{profile?.team ? profile.team.replace('小组', ` ${t('common.team')}`) : '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Link 
                                        to="/account"
                                        onClick={() => setShowUserMenu(false)}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-arabian-night/80 hover:bg-gray-50 hover:text-deep-teal transition-colors"
                                    >
                                        <User className="w-4 h-4 text-desert-gold" />
                                        {t('navbar.personal_center', '个人学习中心')}
                                    </Link>
                                    {!isTrainingUser && (
                                        <Link 
                                            to="/download"
                                            onClick={() => setShowUserMenu(false)}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-arabian-night/80 hover:bg-gray-50 hover:text-deep-teal transition-colors"
                                        >
                                            <Download className="w-4 h-4 text-desert-gold" />
                                            {t('navbar.download_app', '下载APP')}
                                        </Link>
                                    )}
                                    <button 
                                        onClick={() => {
                                            setShowUserMenu(false);
                                            setShowPasswordModal(true);
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-arabian-night/80 hover:bg-gray-50 hover:text-deep-teal transition-colors"
                                    >
                                        <Key className="w-4 h-4 text-desert-gold" />
                                        {t('common.change_password')}
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setShowUserMenu(false);
                                            logout();
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors border-t border-gray-50"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        {t('common.logout')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </nav>
                
                {/* Main Content */}
                <main className={`flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 mt-4 ${isNative ? 'pb-24' : 'pb-12'}`}>
                    <Outlet />
                </main>

                {/* Bottom Tab Bar for native mobile platforms */}
                {isNative && (
                    <div 
                        className="fixed left-4 right-4 mx-auto max-w-md bg-white/90 backdrop-blur-2xl border border-white/60 z-50 shadow-[0_12px_35px_rgba(0,0,0,0.1)] rounded-2xl flex justify-around items-center px-2"
                        style={{ 
                            bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))', 
                            height: '62px'
                        }}
                    >
                        <Link to="/hub" className={getBottomTabClass('/hub')}>
                            <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                                location.pathname.startsWith('/hub') 
                                    ? 'bg-deep-teal/10 text-deep-teal scale-105' 
                                    : 'text-arabian-night/50'
                            }`}>
                                <Compass className="w-5 h-5" />
                            </div>
                            <span className={`text-[9px] tracking-tight mt-0.5 font-bold transition-colors ${
                                location.pathname.startsWith('/hub') ? 'text-deep-teal' : 'text-arabian-night/45'
                            }`}>{t('navbar.learning_hub')}</span>
                        </Link>

                        {canAccessTasks && (
                            <Link to="/team-tasks" className={getBottomTabClass('/team-tasks')}>
                                <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                                    location.pathname.startsWith('/team-tasks') 
                                        ? 'bg-deep-teal/10 text-deep-teal scale-105' 
                                        : 'text-arabian-night/50'
                                }`}>
                                    <CheckSquare className="w-5 h-5" />
                                </div>
                                <span className={`text-[9px] tracking-tight mt-0.5 font-bold transition-colors ${
                                    location.pathname.startsWith('/team-tasks') ? 'text-deep-teal' : 'text-arabian-night/45'
                                }`}>{t('navbar.team_tasks')}</span>
                            </Link>
                        )}

                        {(canAccessDashboard && !isSuperAdmin) && (
                            <Link to="/dashboard" className={getBottomTabClass('/dashboard')}>
                                <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                                    location.pathname.startsWith('/dashboard') 
                                        ? 'bg-deep-teal/10 text-deep-teal scale-105' 
                                        : 'text-arabian-night/50'
                                }`}>
                                    <BarChart2 className="w-5 h-5" />
                                </div>
                                <span className={`text-[9px] tracking-tight mt-0.5 font-bold transition-colors ${
                                    location.pathname.startsWith('/dashboard') ? 'text-deep-teal' : 'text-arabian-night/45'
                                }`}>{t('navbar.dashboard', '数据看板')}</span>
                            </Link>
                        )}

                        <Link to="/account" className={getBottomTabClass('/account')}>
                            <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                                location.pathname.startsWith('/account') 
                                    ? 'bg-deep-teal/10 text-deep-teal scale-105' 
                                    : 'text-arabian-night/50'
                            }`}>
                                <User className="w-5 h-5" />
                            </div>
                            <span className={`text-[9px] tracking-tight mt-0.5 font-bold transition-colors ${
                                location.pathname.startsWith('/account') ? 'text-deep-teal' : 'text-arabian-night/45'
                            }`}>{t('navbar.personal_center')}</span>
                        </Link>

                        {(isSuperAdmin || hasAnyAdminPermission) && (
                            <Link to={isSuperAdmin ? "/admin" : "/admin/users"} className={getBottomTabClass('/admin')}>
                                <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                                    location.pathname.startsWith('/admin') 
                                        ? 'bg-deep-teal/10 text-deep-teal scale-105' 
                                        : 'text-arabian-night/50'
                                }`}>
                                    <Settings className="w-5 h-5" />
                                </div>
                                <span className={`text-[9px] tracking-tight mt-0.5 font-bold transition-colors ${
                                    location.pathname.startsWith('/admin') ? 'text-deep-teal' : 'text-arabian-night/45'
                                }`}>{t('navbar.admin_dashboard', '管理后台')}</span>
                            </Link>
                        )}
                    </div>
                )}

                {/* Global Modals */}
                <ChangePasswordModal 
                    isOpen={showPasswordModal} 
                    onClose={() => setShowPasswordModal(false)} 
                />

                {/* In-App Version Update Dialog */}
                {!isTrainingUser && showUpdateModal && updateConfig && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex justify-center items-center p-6">
                        <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center space-y-6 animate-in zoom-in-95 duration-200">
                            <div className="inline-flex p-4 rounded-full bg-desert-gold/10 text-desert-gold animate-bounce">
                                <ArrowDownToLine className="w-8 h-8" />
                            </div>
                            
                            <div className="space-y-2">
                                <h3 className="text-lg font-black text-white">{t('update_modal.title', '发现新版本 !')}</h3>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    {t('update_modal.subtitle', '为了保证功能正常使用，请及时更新到最新版。')}
                                </p>
                            </div>

                            {/* Localized Update Notes */}
                            <div className="text-left bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2 max-h-32 overflow-y-auto">
                                <h4 className="text-xs font-extrabold text-slate-300">{t('update_modal.notes_title', '更新内容：')}</h4>
                                <p className="text-slate-400 text-[11px] leading-relaxed whitespace-pre-line">
                                    {i18n.language === 'en' 
                                        ? (updateConfig.update_notes_en || 'Bug fixes and performance improvements.')
                                        : i18n.language === 'ar'
                                            ? (updateConfig.update_notes_ar || 'إصلاح الأخطاء وتحسين الأداء.')
                                            : (updateConfig.update_notes_zh || '修复已知问题，提升使用体验。')
                                    }
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                                <a
                                    href={Capacitor.getPlatform() === 'ios' 
                                        ? (updateConfig.ios_testflight_url || 'https://testflight.apple.com/join/xxxxxx') 
                                        : (updateConfig.android_apk_url || `${window.location.origin}/downloads/mecc-latest.apk`)
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3 bg-desert-gold text-slate-900 font-extrabold rounded-xl text-sm hover:bg-desert-gold/90 transition-colors shadow-lg shadow-desert-gold/10 flex justify-center items-center gap-1.5 cursor-pointer"
                                >
                                    <Download className="w-4 h-4" /> {t('update_modal.btn_update', '立即更新')}
                                </a>
                                {!isForceUpdate && (
                                    <button
                                        onClick={() => setShowUpdateModal(false)}
                                        className="w-full py-2.5 bg-white/5 text-slate-400 font-semibold rounded-xl text-xs hover:bg-white/10 transition-colors cursor-pointer"
                                    >
                                        {t('update_modal.btn_later', '稍后提醒')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
