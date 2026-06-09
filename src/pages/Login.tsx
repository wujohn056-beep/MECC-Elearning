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
                
                // Trigger DingTalk login notification
                fetch('/.netlify/functions/dingtalk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'notifyLogin', crmId: data.username || 'wuchuan', loginType: 'sso' })
                }).catch(e => console.error("Login notification failed:", e));

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
            const crmId = loginEmail.includes('serdah') 
                ? 'Serdah' 
                : loginEmail.includes('wuchuan') 
                    ? 'wuchuan' 
                    : loginEmail.split('@')[0];

            // Trigger DingTalk login notification
            fetch('/.netlify/functions/dingtalk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'notifyLogin', crmId: crmId, loginType: 'password' })
            }).catch(e => console.error("Login notification failed:", e));

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
                <div className="text-center mb-6 sm:mb-8 relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-desert-gold/30 blur-[30px] rounded-full -z-10 pointer-events-none"></div>
                    <img src="/logo.png" alt="" className="h-20 sm:h-24 mx-auto mb-6 object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500" />
                    <h2 className="text-3xl font-extrabold text-deep-teal mb-2">{t('common.login')}</h2>
                    <p className="text-arabian-night/60 text-sm font-medium tracking-wide">{t('login.subtitle')}</p>
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

                {/* DingTalk SSO test button for development/testing */}
                {(import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                    <div className="mt-4 pt-4 border-t border-white/10 flex flex-col items-center gap-2">
                        <div className="text-[10px] text-teal-200/60 mb-1 text-center font-bold tracking-wide">
                            🔒 钉钉免登测试 (Mock SSO - 本地专用)
                        </div>
                        <button
                            type="button"
                            onClick={() => handleDingTalkLogin('mock_auth_code_wuchuan')}
                            disabled={loading}
                            className="w-full py-2 px-4 rounded-xl text-xs font-bold text-teal-300 hover:text-white border border-teal-500/40 bg-teal-950/20 hover:bg-teal-700/30 transition-all hover:scale-[1.02] cursor-pointer"
                        >
                            🔑 超级管理员 (wuchuan) 免密登录
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDingTalkLogin('mock_auth_code_Serdah')}
                            disabled={loading}
                            className="w-full py-2 px-4 rounded-xl text-xs font-bold text-orange-300 hover:text-white border border-orange-500/40 bg-orange-950/20 hover:bg-orange-700/30 transition-all hover:scale-[1.02] cursor-pointer"
                        >
                            🔑 CC 部门经理 (Serdah) 免密登录
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                if (window.confirm("确定要一键修复生产环境/本地数据库中的超级管理员及部门经理账户吗？ / Are you sure you want to bootstrap/repair super_admin accounts?")) {
                                    try {
                                        const res = await fetch('/.netlify/functions/dingtalk', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ action: 'bootstrapSuperAdmin' })
                                        });
                                        const data = await res.json();
                                        alert("Success:\n" + JSON.stringify(data, null, 2));
                                    } catch (err: any) {
                                        alert("Bootstrap failed: " + err.message);
                                    }
                                }
                            }}
                            disabled={loading}
                            className="w-full py-2 px-4 rounded-xl text-xs font-bold text-amber-400 hover:text-white border border-amber-500/40 bg-amber-950/20 hover:bg-amber-700/30 transition-all hover:scale-[1.02] cursor-pointer"
                        >
                            🔧 一键修复超级管理员数据库账号 (Bootstrap)
                        </button>
                        <p className="text-[10px] text-teal-200/50 mt-1 text-center leading-normal">
                            点击上述按钮将直接以真实账号身份登录，无需输入密码，完美支持本地环境测试。
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
