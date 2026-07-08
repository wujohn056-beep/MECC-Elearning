import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Menu, X } from 'lucide-react';

export default function AdminLayout() {
    const { t, i18n } = useTranslation();
    const { logout, hasPermission, hasAnyAdminPermission, isLeader, isSuperAdmin, profile } = useAuth();
    const location = useLocation();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Dynamically update document title based on selected language
    useEffect(() => {
        const appTitle = t('navbar.title', 'ME Cloud Academy');
        document.title = `${appTitle} - ${t('navbar.admin_dashboard', '管理后台')}`;
    }, [i18n.language, t]);

    const getLinkClass = (path: string, exact: boolean = false) => {
        const isActive = exact ? location.pathname === path : location.pathname.startsWith(path);
        return `px-4 py-3 rounded-lg transition-colors font-medium border-l-4 ${
            isActive 
                ? 'bg-white/20 border-desert-gold shadow-md font-bold' 
                : 'border-transparent hover:bg-white/10 hover:border-desert-gold/50 text-white/80 hover:text-white'
        }`;
    };

    if (!hasAnyAdminPermission) {
        return null;
    }

    if (!isSuperAdmin && (location.pathname === '/admin' || location.pathname === '/admin/')) {
        if (hasPermission('manageUsers')) {
            return <Navigate to="/admin/users" replace />;
        }
        if (hasPermission('managePolicies') || hasPermission('manageBrands')) {
            return <Navigate to="/admin/policies" replace />;
        }
        if (hasPermission('manageReferrals')) {
            return <Navigate to="/admin/referrals" replace />;
        }
        if (hasPermission('manageRecordings')) {
            return <Navigate to="/admin/recordings" replace />;
        }
        if (hasPermission('manageCategories')) {
            return <Navigate to="/admin/categories" replace />;
        }
        if (hasPermission('manageComments')) {
            return <Navigate to="/admin/comments" replace />;
        }
        if (hasPermission('manageBanners')) {
            return <Navigate to="/admin/banners" replace />;
        }
        return <Navigate to="/hub" replace />;
    }

    return (
        <div 
            className="h-screen flex flex-col md:flex-row overflow-hidden font-sans text-arabian-night bg-cover bg-center bg-fixed"
            style={{ backgroundImage: "url('/images/app-bg.jpg')" }}
        >
            {/* Subtle glass overlay for readability */}
            <div className="fixed inset-0 bg-white/50 backdrop-blur-sm pointer-events-none z-0"></div>

            {/* Mobile Top Header */}
            <header className="md:hidden w-full bg-deep-teal text-white flex items-center justify-between px-4 pb-3.5 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-20 shadow-md shrink-0 border-b border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                    <button 
                        onClick={() => setIsDrawerOpen(true)}
                        className="p-1.5 rounded-lg hover:bg-white/10 active:scale-95 transition-all text-white focus:outline-none cursor-pointer shrink-0"
                        aria-label="Open menu"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="w-8 h-8 rounded bg-desert-gold flex items-center justify-center font-bold text-deep-teal shrink-0 hidden xs:flex">
                        A
                    </div>
                    <h2 className="text-lg font-bold tracking-wide truncate">{t('admin_menu.title')}</h2>
                </div>
                <span className="text-[10px] bg-white/15 px-2.5 py-1 rounded-full font-bold border border-white/10 tracking-wider shrink-0">
                    {profile?.role?.toUpperCase()}
                </span>
            </header>

            {/* Sidebar drawer */}
            <aside 
                className={`fixed md:relative inset-y-0 left-0 w-64 bg-deep-teal/95 backdrop-blur-md text-white shadow-2xl md:shadow-xl flex flex-col z-30 border-r border-white/20 transition-transform duration-300 md:transform-none ${
                    isDrawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                }`}
            >
                <div className="px-6 pb-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] md:pt-6 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-desert-gold flex items-center justify-center font-bold text-deep-teal">
                            A
                        </div>
                        <h2 className="text-xl font-bold tracking-wide">{t('admin_menu.title')}</h2>
                    </div>
                    <button 
                        onClick={() => setIsDrawerOpen(false)}
                        className="md:hidden p-1.5 rounded-lg hover:bg-white/10 active:scale-95 transition-all text-white/85 hover:text-white focus:outline-none cursor-pointer"
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
                    {isSuperAdmin && (
                        <Link to="/admin" onClick={() => setIsDrawerOpen(false)} className={getLinkClass('/admin', true)}>{t('admin_menu.dashboard')}</Link>
                    )}
                    {hasPermission('manageCategories') && (
                        <Link to="/admin/categories" onClick={() => setIsDrawerOpen(false)} className={getLinkClass('/admin/categories')}>{t('admin_menu.categories')}</Link>
                    )}
                    {hasPermission('manageRecordings') && (
                        <Link to="/admin/recordings" onClick={() => setIsDrawerOpen(false)} className={getLinkClass('/admin/recordings')}>{t('admin_menu.uploads')}</Link>
                    )}
                    {hasPermission('manageUsers') && (
                        <Link to="/admin/users" onClick={() => setIsDrawerOpen(false)} className={getLinkClass('/admin/users')}>{t('admin_menu.users')}</Link>
                    )}
                    {hasPermission('manageComments') && (
                        <Link to="/admin/comments" onClick={() => setIsDrawerOpen(false)} className={getLinkClass('/admin/comments')}>{t('admin_menu.comments', '互动审核')}</Link>
                    )}
                    {hasPermission('managePolicies') && (
                        <Link to="/admin/policies" onClick={() => setIsDrawerOpen(false)} className={getLinkClass('/admin/policies')}>{t('admin_menu.policies', '运营政策')}</Link>
                    )}
                    {hasPermission('managePolicies') && (
                        <Link to="/admin/tools" onClick={() => setIsDrawerOpen(false)} className={getLinkClass('/admin/tools')}>{t('admin_menu.daily_tools', '日常工具')}</Link>
                    )}
                    {hasPermission('manageReferrals') && (
                        <Link to="/admin/referrals" onClick={() => setIsDrawerOpen(false)} className={getLinkClass('/admin/referrals')}>{t('admin_menu.referrals', '推荐素材管理')}</Link>
                    )}
                    {hasPermission('manageBrands') && (
                        <Link to="/admin/brands" onClick={() => setIsDrawerOpen(false)} className={getLinkClass('/admin/brands')}>{t('admin_menu.brands', '品牌运营')}</Link>
                    )}
                    {hasPermission('manageBanners') && (
                        <Link to="/admin/banners" onClick={() => setIsDrawerOpen(false)} className={getLinkClass('/admin/banners')}>{t('admin_menu.banners', 'Banner 管理')}</Link>
                    )}
                    {isSuperAdmin && (
                        <Link to="/admin/app-release" onClick={() => setIsDrawerOpen(false)} className={getLinkClass('/admin/app-release')}>{t('admin_menu.app_release', 'App 发布')}</Link>
                    )}
                </nav>
                <div className="px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] md:pb-4 border-t border-white/10 space-y-2">
                    <Link to="/hub" onClick={() => setIsDrawerOpen(false)} className="flex items-center justify-center w-full py-2 bg-white/10 hover:bg-desert-gold hover:text-deep-teal rounded-lg transition-colors font-semibold text-sm">
                        {t('admin_menu.return_hub')}
                    </Link>
                    <button 
                        onClick={() => {
                            setIsDrawerOpen(false);
                            logout();
                        }} 
                        className="flex items-center justify-center gap-2 w-full py-2 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 rounded-lg transition-colors font-semibold text-sm cursor-pointer"
                    >
                        <LogOut className="w-4 h-4" />
                        {t('common.logout') || 'Logout'}
                    </button>
                </div>
            </aside>

            {/* Sidebar backdrop overlay for mobile */}
            {isDrawerOpen && (
                <div 
                    onClick={() => setIsDrawerOpen(false)}
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 md:hidden animate-in fade-in duration-300"
                />
            )}

            <main className="flex-1 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:p-8 overflow-auto relative z-10">
                <div className="max-w-6xl mx-auto bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 p-4 sm:p-8 min-h-[80vh]">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
