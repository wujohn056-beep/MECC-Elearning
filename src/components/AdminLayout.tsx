import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';

export default function AdminLayout() {
    const { t } = useTranslation();
    const { logout, hasPermission, hasAnyAdminPermission } = useAuth();
    const location = useLocation();

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

    return (
        <div 
            className="h-screen flex overflow-hidden font-sans text-arabian-night bg-cover bg-center bg-fixed"
            style={{ backgroundImage: "url('/images/app-bg.jpg')" }}
        >
            {/* Subtle glass overlay for readability */}
            <div className="fixed inset-0 bg-white/50 backdrop-blur-sm pointer-events-none z-0"></div>

            <aside className="w-64 flex-shrink-0 bg-deep-teal/95 backdrop-blur-md text-white shadow-xl flex flex-col z-10 border-r border-white/20">
                <div className="p-6 border-b border-white/10 flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-desert-gold flex items-center justify-center font-bold text-deep-teal">
                        A
                    </div>
                    <h2 className="text-xl font-bold tracking-wide">{t('admin_menu.title')}</h2>
                </div>
                <nav className="flex-1 p-4 flex flex-col gap-2">
                    <Link to="/admin" className={getLinkClass('/admin', true)}>{t('admin_menu.dashboard')}</Link>
                    {hasPermission('manageCategories') && (
                        <Link to="/admin/categories" className={getLinkClass('/admin/categories')}>{t('admin_menu.categories')}</Link>
                    )}
                    {hasPermission('manageRecordings') && (
                        <Link to="/admin/recordings" className={getLinkClass('/admin/recordings')}>{t('admin_menu.uploads')}</Link>
                    )}
                    {hasPermission('manageUsers') && (
                        <Link to="/admin/users" className={getLinkClass('/admin/users')}>{t('admin_menu.users')}</Link>
                    )}
                </nav>
                <div className="p-4 border-t border-white/10 space-y-2">
                    <Link to="/hub" className="flex items-center justify-center w-full py-2 bg-white/10 hover:bg-desert-gold hover:text-deep-teal rounded-lg transition-colors font-semibold text-sm">
                        {t('admin_menu.return_hub')}
                    </Link>
                    <button onClick={logout} className="flex items-center justify-center gap-2 w-full py-2 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 rounded-lg transition-colors font-semibold text-sm">
                        <LogOut className="w-4 h-4" />
                        {t('common.logout') || 'Logout'}
                    </button>
                </div>
            </aside>
            <main className="flex-1 p-8 overflow-auto relative z-10">
                <div className="max-w-6xl mx-auto bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 p-8 min-h-[80vh]">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
