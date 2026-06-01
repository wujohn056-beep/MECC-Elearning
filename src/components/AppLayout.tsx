import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Key, AlertCircle, CheckCircle, ChevronDown, X } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { updatePassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

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
    const menuRef = useRef<HTMLDivElement>(null);
    const location = useLocation();

    const toggleLanguage = () => {
        const nextLang = i18n.language === 'en' ? 'ar' : (i18n.language === 'ar' ? 'zh' : 'en');
        i18n.changeLanguage(nextLang);
    };

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
                        lastLoginAt: serverTimestamp()
                    }, { merge: true });
                } catch (error) {
                    console.error("Failed to track login", error);
                }
            }
        };
        trackDailyLogin();
    }, [user, profile]);

    const getNavLinkClass = (path: string) => {
        const isActive = location.pathname.startsWith(path);
        return `text-sm sm:text-base font-bold transition-all border-b-[3px] pb-1 px-1 ${
            isActive 
                ? 'text-deep-teal border-deep-teal' 
                : 'text-arabian-night/60 border-transparent hover:text-desert-gold hover:border-desert-gold/30'
        }`;
    };

    return (
        <div 
            className="min-h-screen text-arabian-night transition-colors duration-300 relative bg-cover bg-center bg-fixed"
            style={{ backgroundImage: "url('/images/app-bg.jpg')" }}
        >
            {/* Subtle glass overlay for the entire app background */}
            <div className="fixed inset-0 bg-white/40 backdrop-blur-[4px] pointer-events-none z-0"></div>
            
            <div className="relative z-10">
                {/* Navigation Bar */}
            <nav className="glass-panel sticky top-0 z-50 p-4 pt-safe flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="" className="h-9 sm:h-11 object-contain drop-shadow-md" />
                    <h1 className="text-2xl font-extrabold text-gradient-gold tracking-wide hidden sm:block">
                        {t('navbar.title')}
                    </h1>
                </div>
                <div className="flex gap-4 sm:gap-6 items-center pt-1">
                    <Link to="/hub" className={getNavLinkClass('/hub')}>{t('navbar.learning_hub')}</Link>
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
                    
                    <NotificationBell />
                    
                    <button onClick={toggleLanguage} className="hidden md:block bg-deep-teal/10 hover:bg-deep-teal/20 text-deep-teal px-4 py-2 rounded-full text-sm font-semibold transition-colors shadow-sm">
                        {t('common.language')} ({i18n.language.toUpperCase()})
                    </button>

                    {/* User Dropdown Menu */}
                    <div className="relative ml-1 sm:ml-2" ref={menuRef}>
                        <button 
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center gap-1.5 sm:gap-2 bg-white/60 hover:bg-white border border-gray-200 px-2 sm:px-3 py-1.5 rounded-full transition-colors shadow-sm"
                        >
                            <div className="w-6 h-6 bg-deep-teal text-white rounded-full flex items-center justify-center">
                                <User className="w-3.5 h-3.5" />
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
                                        <div className="w-12 h-12 bg-gradient-to-br from-desert-gold to-yellow-600 rounded-full flex items-center justify-center text-white shadow-sm shrink-0 border-2 border-white">
                                            <User className="w-6 h-6" />
                                        </div>
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
            <main className="max-w-7xl mx-auto p-4 sm:p-6 mt-4">
                <Outlet />
            </main>

            {/* Global Modals */}
            <ChangePasswordModal 
                isOpen={showPasswordModal} 
                onClose={() => setShowPasswordModal(false)} 
            />
            </div>
        </div>
    );
}
