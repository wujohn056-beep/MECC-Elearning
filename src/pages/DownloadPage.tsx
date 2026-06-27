import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Smartphone, Download, AlertTriangle, ArrowLeft, ArrowDownToLine, Loader2 } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';
import QRCode from 'qrcode';

export default function DownloadPage() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    
    const [testflightUrl, setTestflightUrl] = useState('https://testflight.apple.com/join/xxxxxx');
    const [apkUrl, setApkUrl] = useState('https://learning.mecloudhub.com/downloads/mecc-latest.apk');
    const [iosQrCode, setIosQrCode] = useState('');
    const [androidQrCode, setAndroidQrCode] = useState('');
    const [loading, setLoading] = useState(true);

    const isTrainingUser = profile?.identity === 'Training Dep' || 
        (profile?.team || '').toLowerCase().includes('training');

    // 1. Fetch URLs from Firestore
    useEffect(() => {
        const fetchUrls = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'system_config', 'app_versions'));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.ios_testflight_url) setTestflightUrl(data.ios_testflight_url);
                    if (data.android_apk_url) {
                        setApkUrl(data.android_apk_url);
                    } else {
                        setApkUrl(`${window.location.origin}/downloads/mecc-latest.apk`);
                    }
                } else {
                    setApkUrl(`${window.location.origin}/downloads/mecc-latest.apk`);
                }
            } catch (err) {
                console.error("Error loading download URLs:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchUrls();
    }, []);

    // 2. Generate QR codes
    useEffect(() => {
        if (!loading) {
            QRCode.toDataURL(testflightUrl, { width: 180, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
                .then(url => setIosQrCode(url))
                .catch(err => console.error("Error generating iOS QR:", err));

            QRCode.toDataURL(apkUrl, { width: 180, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
                .then(url => setAndroidQrCode(url))
                .catch(err => console.error("Error generating Android QR:", err));
        }
    }, [testflightUrl, apkUrl, loading]);

    // Handle access block for Training Department - redirect immediately to hub
    if (isTrainingUser) {
        return <Navigate to="/hub" replace />;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
                <Loader2 className="w-8 h-8 text-desert-gold animate-spin" />
                <p className="text-slate-400 text-sm mt-3">加载中...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
            {/* Background decorative glows */}
            <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -z-10 animate-pulse delay-700"></div>

            <div className="max-w-4xl w-full space-y-8">
                {/* Header */}
                <div className="text-center space-y-3">
                    <div className="inline-flex p-3 rounded-2xl bg-white/5 border border-white/10 text-desert-gold shadow-lg">
                        <Smartphone className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                        下载 MECC 移动客户端
                    </h1>
                    <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
                        在移动设备上畅享流畅学习，即时获取学习提醒与勋章通知。
                    </p>
                </div>

                {/* Cards Grid */}
                <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                    {/* iOS App */}
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col items-center justify-between text-center space-y-6 shadow-xl relative group hover:border-blue-500/30 transition-all duration-300">
                        <div className="absolute top-4 right-4 bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-blue-500/20">
                            iOS 测试版
                        </div>
                        <div className="space-y-2 pt-4">
                            <h3 className="text-lg font-extrabold text-white">Apple TestFlight</h3>
                            <p className="text-slate-400 text-xs px-4">
                                使用苹果官方测试平台加入内测。如未安装 TestFlight App，系统会自动提示引导下载。
                            </p>
                        </div>
                        {iosQrCode ? (
                            <div className="p-3 bg-white rounded-2xl shadow-inner border border-white/10">
                                <img src={iosQrCode} alt="iOS QR Code" className="w-36 h-36 select-none" />
                            </div>
                        ) : (
                            <div className="w-36 h-36 bg-white/5 rounded-2xl flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                            </div>
                        )}
                        <a
                            href={testflightUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 transition-all font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
                        >
                            <Download className="w-4 h-4" /> 开启 iOS 测试
                        </a>
                    </div>

                    {/* Android App */}
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col items-center justify-between text-center space-y-6 shadow-xl relative group hover:border-emerald-500/30 transition-all duration-300">
                        <div className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-emerald-500/20">
                            Android 直下
                        </div>
                        <div className="space-y-2 pt-4">
                            <h3 className="text-lg font-extrabold text-white">安卓 APK 下载</h3>
                            <p className="text-slate-400 text-xs px-4">
                                直接扫码下载安装最新版 APK。如在微信/钉钉中扫码，请根据提示在系统浏览器中打开。
                            </p>
                        </div>
                        {androidQrCode ? (
                            <div className="p-3 bg-white rounded-2xl shadow-inner border border-white/10">
                                <img src={androidQrCode} alt="Android QR Code" className="w-36 h-36 select-none" />
                            </div>
                        ) : (
                            <div className="w-36 h-36 bg-white/5 rounded-2xl flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                            </div>
                        )}
                        <a
                            href={apkUrl}
                            download="mecc-latest.apk"
                            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition-all font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                        >
                            <ArrowDownToLine className="w-4 h-4" /> 下载 Android APK
                        </a>
                    </div>
                </div>

                {/* Footer Back Link */}
                {user && (
                    <div className="text-center pt-4">
                        <button
                            onClick={() => navigate('/hub')}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> 返回学习中心 (Learning Hub)
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
