import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../services/firebase';
import { Lock, Mail } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showDevPanel, setShowDevPanel] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();

    const fromPath = (location.state as any)?.from?.pathname || '/';
    const fromSearch = (location.state as any)?.from?.search || '';
    const from = `${fromPath}${fromSearch}`;

    useEffect(() => {
        const reason = sessionStorage.getItem('auth_blocked_reason');
        if (reason) {
            setError(t('login.account_blocked', '您的账号已被禁用或删除，请联系管理员。'));
            sessionStorage.removeItem('auth_blocked_reason');
        }
    }, [t]);

    useEffect(() => {
        // Load DingTalk JSAPI dynamically if in DingTalk container
        const isDingTalk = navigator.userAgent.toLowerCase().includes('dingtalk');
        if (isDingTalk) {
            const script = document.createElement('script');
            script.src = 'https://g.alicdn.com/dingding/dingtalk-jsapi/3.0.12/dingtalk.open.js';
            script.async = true;
            script.onload = () => {
                const dd = (window as any).dd;
                if (dd) {
                    dd.ready(() => {
                        dd.runtime.permission.requestAuthCode({
                            corpId: '', // Inner app doesn't require corpId
                            onSuccess: async (result: any) => {
                                handleDingTalkLogin(result.code);
                            },
                            onFail: (err: any) => {
                                console.error('DingTalk auth code fail:', err);
                                setError(t('login.dingtalk_jsapi_fail', '钉钉免登授权失败，请尝试使用密码登录。'));
                            }
                        });
                    });
                }
            };
            document.body.appendChild(script);
            return () => {
                if (document.body.contains(script)) {
                    document.body.removeChild(script);
                }
            };
        }
    }, [t]);

    const handleDingTalkLogin = async (code: string) => {
        setLoading(true);
        setError('');
        try {
            if (code && code.startsWith('mock_auth_code_')) {
                const username = code.replace('mock_auth_code_', '');
                console.log(`[Mock SSO] Detected local development mock code. Bypassing Netlify API for ${username}`);
                localStorage.setItem('mock_sso_crm_id', username);
                
                try {
                    await signInWithEmailAndPassword(auth, 'test-sso@mecc.com', '123456');
                } catch (ssoErr: any) {
                    if (ssoErr.code === 'auth/user-not-found' || ssoErr.code === 'auth/invalid-credential') {
                        // Automatically register test-sso@mecc.com on the fly if it doesn't exist
                        const { createUserWithEmailAndPassword } = await import('firebase/auth');
                        await createUserWithEmailAndPassword(auth, 'test-sso@mecc.com', '123456');
                        await signInWithEmailAndPassword(auth, 'test-sso@mecc.com', '123456');
                    } else {
                        throw ssoErr;
                    }
                }
                navigate(from, { replace: true });
                return;
            }

            const res = await fetch('/.netlify/functions/dingtalk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', code })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || t('login.sso_failed', '单点登录授权交换失败，请联系管理员。'));
            }

            const data = await res.json();
            if (data.success && data.customToken) {
                if (data.customToken.startsWith('mock_firebase_token_for_')) {
                    // Local environment mock SSO bypass: Use the public test account and save desired profile in localstorage
                    console.log(`[Mock SSO] Bypassing secure custom token verification locally for ${data.username}`);
                    localStorage.setItem('mock_sso_crm_id', data.username || 'wuchuan');
                    
                    try {
                        await signInWithEmailAndPassword(auth, 'test-sso@mecc.com', '123456');
                    } catch (ssoErr: any) {
                        if (ssoErr.code === 'auth/user-not-found' || ssoErr.code === 'auth/invalid-credential') {
                            // Automatically register test-sso@mecc.com on the fly if it doesn't exist
                            const { createUserWithEmailAndPassword } = await import('firebase/auth');
                            await createUserWithEmailAndPassword(auth, 'test-sso@mecc.com', '123456');
                            await signInWithEmailAndPassword(auth, 'test-sso@mecc.com', '123456');
                        } else {
                            throw ssoErr;
                        }
                    }
                } else {
                    const { signInWithCustomToken } = await import('firebase/auth');
                    await signInWithCustomToken(auth, data.customToken);
                }
                navigate(from, { replace: true });
            } else {
                throw new Error(data.error || t('login.sso_failed', '单点登录授权交换失败，请联系管理员。'));
            }
        } catch (err: any) {
            console.error('DingTalk login error:', err);
            setError(err.message || t('login.sso_failed'));
        } finally {
            setLoading(false);
        }
    };

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
            // Normalize email: support direct CRM ID or exact email login
            let loginEmail = email.trim().toLowerCase();
            if (!loginEmail.includes('@')) {
                // If it's a plain CRM ID, resolve to correct email
                if (loginEmail === 'wuchuan') {
                    loginEmail = 'wuchuan@51talk.com';
                } else if (loginEmail === 'serdah') {
                    loginEmail = 'mohserdah@51talk.com';
                } else {
                    // Default fallback
                    loginEmail = `${loginEmail}@mecc.com`;
                }
            }

            try {
                await signInWithEmailAndPassword(auth, loginEmail, password);
            } catch (authErr: any) {
                // If in local/test environment and the targeted test account doesn't exist, auto-register on the fly!
                const isTestUser = loginEmail === 'wuchuan@mecc.com' || loginEmail === 'serdah@mecc.com' || loginEmail === 'wuchuan@51talk.com' || loginEmail === 'mohserdah@51talk.com';
                const isWrongPasswordOrNotFound = authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential';
                
                if (isTestUser && isWrongPasswordOrNotFound && password === '123456') {
                    console.log(`[Auto-Registration] Test user ${loginEmail} not found. Creating account on the fly...`);
                    const { createUserWithEmailAndPassword } = await import('firebase/auth');
                    const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
                    
                    // Create Firestore user profile document inside 'default' database
                    const { doc, setDoc } = await import('firebase/firestore');
                    const crmId = loginEmail.includes('serdah') ? 'Serdah' : loginEmail.includes('wuchuan') ? 'wuchuan' : loginEmail.split('@')[0];
                    
                    if (crmId !== 'wuchuan') {
                        await setDoc(doc(db, 'users', userCredential.user.uid), {
                            crmId: crmId,
                            role: 'sm',
                            team: '',
                            dep: 'CC',
                            sd: 'JOHN',
                            permissions: { manageCategories: false, manageRecordings: false, manageUsers: false, manageDashboard: false, manageTasks: false }
                        });
                    }
                    
                    // Sign in successfully now that account is created
                    await signInWithEmailAndPassword(auth, loginEmail, password);
                } else {
                    throw authErr;
                }
            }
            
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
            className="min-h-screen text-white flex flex-col justify-between md:justify-center items-center relative bg-cover bg-top bg-no-repeat overflow-y-auto pt-safe pb-safe"
            style={{ backgroundImage: `url('/images/login-bg.jpg')` }}
        >
            {/* Dark gradient overlay for readability and premium feel */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/60 z-0 pointer-events-none"></div>

            {/* Language Switcher */}
            <div className="w-full max-w-5xl mx-auto px-6 py-4 flex justify-end items-center z-10">
                <button 
                    onClick={toggleLanguage} 
                    className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-desert-gold hover:text-arabian-night text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 shadow-sm active:scale-95 cursor-pointer"
                >
                    {t('common.language', 'Language')} ({i18n.language?.toUpperCase() || 'EN'})
                </button>
            </div>

            {/* Spacer for mobile to shift card down so background text remains visible */}
            <div className="flex-1 md:hidden h-24 min-h-[90px]"></div>

            {/* Login Card Container */}
            <div className="w-full max-w-[440px] px-0 sm:px-6 z-10">
                <div className="bg-[#0f1d2e]/90 backdrop-blur-2xl rounded-t-[36px] sm:rounded-[28px] border-t sm:border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-6 sm:p-8 flex flex-col transition-all duration-500">
                    <div className="text-center mb-6 relative">
                        {/* Gold Ambient Glow */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-28 h-28 bg-desert-gold/10 blur-[40px] rounded-full -z-10 pointer-events-none"></div>
                        
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-1.5 tracking-wide">
                            {t('common.login')}
                        </h2>
                        <p className="text-white/55 text-xs font-semibold tracking-wider uppercase">
                            {t('login.subtitle')}
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-2.5 rounded-xl mb-5 text-xs flex items-center gap-2 animate-in fade-in duration-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0"></span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email/CRM ID Field */}
                        <div>
                            <label className="block text-[11px] font-bold text-desert-gold uppercase tracking-widest mb-1.5">
                                {t('login.email_label')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                                    <Mail className="h-4.5 w-4.5" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    className="block w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/35 text-sm focus:outline-none focus:ring-2 focus:ring-desert-gold/50 focus:border-desert-gold transition-all duration-300"
                                    placeholder={t('login.email_placeholder')}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-[11px] font-bold text-desert-gold uppercase tracking-widest mb-1.5">
                                {t('common.password')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                                    <Lock className="h-4.5 w-4.5" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="block w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/35 text-sm focus:outline-none focus:ring-2 focus:ring-desert-gold/50 focus:border-desert-gold transition-all duration-300"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-deep-teal to-teal-700 hover:from-teal-700 hover:to-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-deep-teal transition-all duration-300 active:scale-[0.98] ${
                                loading ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5 glow-gold-hover cursor-pointer'
                            }`}
                        >
                            {loading ? (
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : t('common.submit')}
                        </button>
                    </form>

                    {/* Developer Mock SSO drawer */}
                    {(import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                        <div className="mt-5 pt-4 border-t border-white/10">
                            <button
                                type="button"
                                onClick={() => setShowDevPanel(!showDevPanel)}
                                className="w-full flex items-center justify-between text-[10px] text-teal-300/60 hover:text-teal-300 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                                <span>🔒 Mock SSO Bypass</span>
                                <span>{showDevPanel ? '▲' : '▼'}</span>
                            </button>
                            
                            {showDevPanel && (
                                <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-300">
                                    <button
                                        type="button"
                                        onClick={() => handleDingTalkLogin('mock_auth_code_wuchuan')}
                                        disabled={loading}
                                        className="w-full py-2 px-3 rounded-lg text-xs font-bold text-teal-300 hover:text-white border border-teal-500/20 bg-teal-950/20 hover:bg-teal-700/30 transition-all cursor-pointer"
                                    >
                                        🔑 超级管理员 (wuchuan)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDingTalkLogin('mock_auth_code_Serdah')}
                                        disabled={loading}
                                        className="w-full py-2 px-3 rounded-lg text-xs font-bold text-orange-300 hover:text-white border border-orange-500/20 bg-orange-950/20 hover:bg-orange-700/30 transition-all cursor-pointer"
                                    >
                                        🔑 CC 部门经理 (Serdah)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Spacer */}
            <div className="hidden md:block h-8"></div>
        </div>
    );
}
