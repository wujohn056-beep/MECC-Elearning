import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { 
    FileText, 
    Image as ImageIcon, 
    Video as VideoIcon, 
    Sparkles, 
    Play, 
    Download, 
    BookOpen, 
    X, 
    ArrowLeft,
    EyeOff
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface PolicyItem {
    id: string;
    title: string;
    description?: string;
    type: 'document' | 'poster' | 'video';
    url: string;
    thumbnailUrl?: string;
    businessType: 'kid' | 'adult' | 'ss' | 'leader' | 'all';
    sortOrder: number;
    visible: boolean;
    createdAt?: any;
    updatedAt?: any;
}

const PolicyPreviewModal = ({ policy, onClose }: { policy: any, onClose: () => void }) => {
    const { t } = useTranslation();
    const isVideo = policy.type === 'video';
    const isPoster = policy.type === 'poster';

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 dark:border-slate-800/60 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative">
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 bg-black/10 hover:bg-black/25 dark:bg-white/10 dark:hover:bg-white/20 text-arabian-night dark:text-white rounded-full transition-colors cursor-pointer"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Modal Header */}
                <div className="p-6 border-b border-gray-100 dark:border-slate-800/80 pr-16 bg-white/50 dark:bg-slate-950/20">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-desert-gold/15 text-[#a88216] border border-desert-gold/20 select-none">
                            {policy.type === 'document' ? '📄 文档政策' : policy.type === 'poster' ? '🖼️ 激励海报' : '🎥 宣导视频'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-deep-teal/10 text-deep-teal font-bold rounded-full">
                            {policy.businessType === 'all' ? '全部业务线' : policy.businessType === 'kid' ? '青少' : policy.businessType === 'adult' ? '成人' : policy.businessType === 'ss' ? 'SS 业务' : 'Leader 学院'}
                        </span>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white leading-snug">{policy.title}</h3>
                    {policy.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">{policy.description}</p>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center min-h-[350px]">
                    {isPoster ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 relative group">
                            <img 
                                src={policy.url} 
                                alt={policy.title} 
                                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-2xl"
                            />
                            <a 
                                href={policy.url} 
                                download 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute bottom-6 bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-md px-6 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95"
                            >
                                <Download className="w-4 h-4" />
                                下载原图海报
                            </a>
                        </div>
                    ) : isVideo ? (
                        <div className="w-full h-full flex items-center justify-center p-4">
                            <video 
                                src={policy.url} 
                                controls 
                                autoPlay
                                className="max-w-full max-h-[60vh] rounded-xl object-contain bg-black shadow-2xl border border-white/5"
                            />
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-900 text-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <FileText className="w-10 h-10 text-blue-500" />
                            </div>
                            <div className="space-y-2 max-w-md">
                                <h4 className="text-white font-bold text-lg">运营文档政策资料</h4>
                                <p className="text-slate-400 text-xs leading-relaxed">该政策为正式发布文档（通常为PDF或专用政策公告网页）。点击下方按钮打开并仔细研读政策细则。</p>
                            </div>
                            <a 
                                href={policy.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="bg-gradient-to-r from-deep-teal to-[#005f66] hover:shadow-[0_4px_15px_rgba(0,109,119,0.3)] text-white px-8 py-3.5 rounded-xl font-extrabold shadow-md flex items-center gap-2 hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer border border-white/10"
                            >
                                <BookOpen className="w-5 h-5 text-desert-gold" />
                                打开政策文档
                            </a>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-gray-100 dark:border-slate-800/80 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all text-xs cursor-pointer"
                    >
                        关闭窗口
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function PoliciesShowcase() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { profile, isLeader } = useAuth();
    const isNative = Capacitor.isNativePlatform();

    const [policies, setPolicies] = useState<PolicyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activePolicyItem, setActivePolicyItem] = useState<PolicyItem | null>(null);

    // Business type tabs configuration
    const allowedTabs = React.useMemo(() => {
        const tabs: { type: 'kid' | 'adult' | 'ss' | 'leader'; label: string; gradient: string }[] = [];
        
        if (profile?.role === 'super_admin') {
            tabs.push({ type: 'kid', label: t('common.type_kid', '青少业务'), gradient: 'from-blue-500 to-blue-600' });
            tabs.push({ type: 'adult', label: t('common.type_adult', '成人业务'), gradient: 'from-purple-500 to-purple-600' });
            tabs.push({ type: 'ss', label: t('common.type_ss', 'SS 业务'), gradient: 'from-orange-500 to-amber-600' });
            tabs.push({ type: 'leader', label: t('common.type_leader', 'Leader 学院'), gradient: 'from-teal-600 to-emerald-600' });
            return tabs;
        }

        if (profile?.dep === 'SS') {
            tabs.push({ type: 'ss', label: t('common.type_ss', 'SS 业务'), gradient: 'from-orange-500 to-amber-600' });
            if (isLeader) {
                tabs.push({ type: 'leader', label: t('common.type_leader', 'Leader 学院'), gradient: 'from-teal-600 to-emerald-600' });
            }
            return tabs;
        }

        tabs.push({ type: 'kid', label: t('common.type_kid', '青少业务'), gradient: 'from-blue-500 to-blue-600' });
        tabs.push({ type: 'adult', label: t('common.type_adult', '成人业务'), gradient: 'from-purple-500 to-purple-600' });
        if (isLeader) {
            tabs.push({ type: 'leader', label: t('common.type_leader', 'Leader 学院'), gradient: 'from-teal-600 to-emerald-600' });
        }
        return tabs;
    }, [profile, isLeader, t]);

    const [businessType, setBusinessType] = useState<'kid' | 'adult' | 'ss' | 'leader'>(() => {
        if (profile?.dep === 'SS') return 'ss';
        return 'kid';
    });

    useEffect(() => {
        if (allowedTabs.length > 0 && !allowedTabs.some(t => t.type === businessType)) {
            setBusinessType(allowedTabs[0].type);
        }
    }, [allowedTabs, businessType]);

    // Real-time policies listener
    useEffect(() => {
        setLoading(true);
        const q = query(
            collection(db, 'policies'),
            orderBy('sortOrder', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: PolicyItem[] = [];
            snapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                if (data.visible !== false) {
                    list.push({ id: docSnapshot.id, ...data } as PolicyItem);
                }
            });
            setPolicies(list);
            setLoading(false);
        }, (error) => {
            console.error("Error loading policies in Showcase:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const filteredPolicies = policies.filter(
        p => p.businessType === 'all' || p.businessType === businessType
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header section with back button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/hub')}
                        className="p-2.5 bg-white/80 hover:bg-white rounded-xl border border-gray-200/50 shadow-sm transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
                        title={t('learning_hub.back_to_courses', '返回全部课程')}
                    >
                        <ArrowLeft className="h-5 w-5 text-deep-teal" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-deep-teal to-teal-800 tracking-tight">
                            {t('learning_hub.operations_policies_title', '运营政策与激励展示')}
                        </h1>
                        <p className="text-arabian-night/60 text-sm mt-1">
                            {t('learning_hub.operations_policies_desc', '最新销售激励方案与运营规范，一键掌握')}
                        </p>
                    </div>
                </div>

                {/* Scoped business tabs inside header */}
                {allowedTabs.length > 1 && (
                    <div className="p-1 rounded-full flex items-center bg-white/70 backdrop-blur-md border border-white/50 shadow-sm w-full sm:w-auto overflow-x-auto whitespace-nowrap scrollbar-none">
                        {allowedTabs.map(tab => (
                            <button
                                key={tab.type}
                                onClick={() => setBusinessType(tab.type)}
                                className={`px-5 py-2 rounded-full font-extrabold transition-all duration-300 text-xs sm:text-sm select-none cursor-pointer ${
                                    businessType === tab.type 
                                        ? `bg-gradient-to-r ${tab.gradient} text-white shadow-md shadow-slate-900/10 scale-[1.02] transform`
                                        : 'text-arabian-night/65 hover:text-arabian-night hover:bg-white/40'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Showcase Grid of all policies */}
            {loading ? (
                <div className="flex justify-center py-24">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-desert-gold"></div>
                </div>
            ) : filteredPolicies.length === 0 ? (
                <div className="p-12 rounded-3xl border border-white/60 bg-white/40 text-center shadow-sm">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-20 text-deep-teal" />
                    <h3 className="text-lg font-bold text-deep-teal mb-1">{t('learning_hub.no_policies_showcase', '暂无本业务线相关的运营政策')}</h3>
                    <p className="text-sm text-arabian-night/50">请切换业务线或联系运营管理团队上传发布新的资料物料。</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                    {filteredPolicies.map(policy => {
                        const isVideo = policy.type === 'video';
                        const isPoster = policy.type === 'poster';

                        return (
                            <div 
                                key={policy.id}
                                onClick={() => setActivePolicyItem(policy)}
                                className="group cursor-pointer glass-panel rounded-2xl border border-white/60 bg-white/60 hover:bg-white hover:border-desert-gold/30 hover:-translate-y-1.5 shadow-sm hover:shadow-lg flex flex-col transition-all duration-500 overflow-hidden"
                            >
                                {/* Preview Area */}
                                <div className="relative aspect-video w-full bg-slate-900 overflow-hidden flex items-center justify-center border-b border-white/10 shrink-0">
                                    {isPoster ? (
                                        <img 
                                            src={policy.url} 
                                            alt={policy.title} 
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    ) : isVideo ? (
                                        <>
                                            {policy.thumbnailUrl ? (
                                                <img 
                                                    src={policy.thumbnailUrl} 
                                                    alt={policy.title} 
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 to-red-950/80 flex items-center justify-center">
                                                    <VideoIcon className="h-10 w-10 text-red-500/80 group-hover:scale-110 transition-transform" />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/45 transition-colors z-10 flex items-center justify-center">
                                                <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center transform group-hover:scale-110 transition-all shadow-md">
                                                    <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 bg-gradient-to-br from-[#0c2240] to-blue-900/80 flex flex-col items-center justify-center gap-1.5 p-4 text-center">
                                            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                                                <FileText className="h-5 w-5 text-blue-400" />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Format Tag */}
                                    <span className="absolute top-2.5 right-2.5 bg-black/45 backdrop-blur-md text-white text-[9px] font-black tracking-wide px-2.5 py-0.5 rounded-full border border-white/10 shadow-sm z-20 select-none">
                                        {policy.type === 'document' ? '📄 文档' : policy.type === 'poster' ? '🖼️ 海报' : '🎥 视频'}
                                    </span>
                                </div>

                                {/* Text Info */}
                                <div className="p-4 flex-1 flex flex-col justify-between bg-white/40">
                                    <div>
                                        <h4 className="font-black text-sm text-slate-800 line-clamp-1 group-hover:text-desert-gold transition-colors">
                                            {policy.title}
                                        </h4>
                                        {policy.description && (
                                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                                {policy.description}
                                            </p>
                                        )}
                                    </div>
                                    
                                    {/* Action footer */}
                                    <div className="flex items-center justify-between mt-3.5 pt-2.5 border-t border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400">
                                            排序: {policy.sortOrder}
                                        </span>
                                        <span className="text-[11px] font-bold text-desert-gold hover:underline flex items-center gap-0.5">
                                            {policy.type === 'document' ? '立即阅读' : policy.type === 'poster' ? '查看海报' : '播放视频'} →
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal previewer */}
            {activePolicyItem && (
                <PolicyPreviewModal
                    policy={activePolicyItem}
                    onClose={() => setActivePolicyItem(null)}
                />
            )}
        </div>
    );
}
