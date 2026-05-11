import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { auth } from '../services/firebase';
import { Lock, Mail } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();

    const from = (location.state as any)?.from?.pathname || '/';

    const toggleLanguage = () => {
        const nextLang = i18n.language === 'en' ? 'zh' : i18n.language === 'zh' ? 'ar' : 'en';
        i18n.changeLanguage(nextLang);
        document.documentElement.dir = nextLang === 'ar' ? 'rtl' : 'ltr';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Append @mecc.com if it's a CRM ID without domain
            const loginEmail = email.includes('@') ? email : `${email}@mecc.com`;
            await signInWithEmailAndPassword(auth, loginEmail, password);
            navigate(from, { replace: true });
        } catch (err) {
            setError(t('login.login_fail'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div 
            className="min-h-screen text-arabian-night flex items-center justify-center p-4 relative bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url('/images/login-bg.jpg')` }}
        >
            <div className="absolute inset-0 bg-black/10"></div> {/* Subtle overlay to ensure text readability */}
            
            <button 
                onClick={toggleLanguage} 
                className="absolute top-6 right-6 z-10 bg-white/20 backdrop-blur-md border border-white/30 hover:bg-desert-gold hover:text-white text-white px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm"
            >
                {t('common.language', 'Language')} ({i18n.language?.toUpperCase() || 'EN'})
            </button>
            <div className="relative z-10 max-w-[420px] w-full bg-white/10 backdrop-blur-md rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6 sm:p-8 border border-white/20 mt-[22vh] sm:mt-[25vh]">
                <div className="text-center mb-4 sm:mb-6">
                    <img src="/logo.png" alt="ME Cloud Academy" className="h-16 mx-auto mb-4 object-contain drop-shadow-md hover:scale-105 transition-transform duration-300" />
                    <h2 className="text-2xl font-extrabold text-deep-teal mb-1">{t('common.login')}</h2>
                    <p className="text-arabian-night/60 text-sm font-medium">{t('login.subtitle')}</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm flex items-center">
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-deep-teal mb-1.5">
                            {t('login.email_label')}
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-arabian-night/40" />
                            </div>
                            <input
                                type="text"
                                required
                                className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-desert-gold focus:border-transparent transition-all bg-white/50 backdrop-blur-sm"
                                placeholder={t('login.email_placeholder')}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-deep-teal mb-1.5">
                            {t('common.password')}
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-arabian-night/40" />
                            </div>
                            <input
                                type="password"
                                required
                                className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-desert-gold focus:border-transparent transition-all bg-white/50 backdrop-blur-sm"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-deep-teal to-teal-700 hover:from-teal-700 hover:to-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-deep-teal transition-all ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'
                            }`}
                    >
                        {loading ? t('common.loading') : t('common.submit')}
                    </button>
                </form>
            </div>
        </div>
    );
}
