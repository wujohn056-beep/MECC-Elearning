import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth, getUserTeam } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { 
    FileText, 
    Image as ImageIcon, 
    Video as VideoIcon, 
    Play, 
    Download, 
    BookOpen, 
    X, 
    ArrowLeft,
    Folder,
    ChevronRight,
    Search
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface PolicyItem {
    id: string;
    title: string;
    description?: string;
    type: 'document' | 'poster' | 'video';
    url: string;
    thumbnailUrl?: string;
    targetTeam: 'KCC' | 'GCC' | 'Adult' | 'SS' | 'all';
    directoryId: string | null;
    sortOrder: number;
    visible: boolean;
    createdAt?: any;
    updatedAt?: any;
}

interface PolicyDirectory {
    id: string;
    name: string;
    parentId: string | null;
    targetTeam: 'KCC' | 'GCC' | 'Adult' | 'SS' | 'all';
    sortOrder: number;
}

// Fallback mapper for legacy policies that still use businessType
function mapBusinessTypeToTeam(bt: string): 'KCC' | 'GCC' | 'Adult' | 'SS' | 'all' {
    const type = String(bt || '').toLowerCase();
    if (type === 'kid') return 'KCC';
    if (type === 'adult') return 'Adult';
    if (type === 'ss') return 'SS';
    return 'all';
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
                            {policy.type === 'document' ? t('policy_showcase.doc_policy', '📄 文档政策') : policy.type === 'poster' ? t('policy_showcase.poster_incentive', '🖼️ 激励海报') : t('policy_showcase.video_promo', '🎥 宣导视频')}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-deep-teal/10 text-deep-teal font-bold rounded-full">
                            {policy.targetTeam === 'all' ? t('policy_showcase.visible_to_all', '全部可见') : t('policy_showcase.team_exclusive', '{{team}} 团队专属', { team: policy.targetTeam })}
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
                                {t('policy_showcase.download_poster', '下载原图海报')}
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
                                <h4 className="text-white font-bold text-lg">{t('policy_showcase.doc_material_title', '运营文档政策资料')}</h4>
                                <p className="text-slate-400 text-xs leading-relaxed">{t('policy_showcase.doc_material_desc', '该政策为正式发布文档（通常为PDF或专用政策公告网页）。点击下方按钮打开并仔细研读政策细则。')}</p>
                            </div>
                            <a 
                                href={policy.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="bg-gradient-to-r from-deep-teal to-[#005f66] hover:shadow-[0_4px_15px_rgba(0,109,119,0.3)] text-white px-8 py-3.5 rounded-xl font-extrabold shadow-md flex items-center gap-2 hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer border border-white/10"
                            >
                                <BookOpen className="w-5 h-5 text-desert-gold" />
                                {t('policy_showcase.open_doc', '打开政策文档')}
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
                        {t('policy_showcase.close_window', '关闭窗口')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function PoliciesShowcase() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { profile, userTeam } = useAuth();
    const isSuperAdmin = profile?.role === 'super_admin' || profile?.policyScope === 'all';

    // State
    const [policies, setPolicies] = useState<PolicyItem[]>([]);
    const [directories, setDirectories] = useState<PolicyDirectory[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Directory explorer state
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [activePolicyItem, setActivePolicyItem] = useState<PolicyItem | null>(null);

    // Selected tab for super admin viewing preview: defaults to the user's derived team or 'all'
    const [selectedTeamTab, setSelectedTeamTab] = useState<'all' | 'KCC' | 'GCC' | 'Adult' | 'SS'>(() => {
        const team = userTeam !== 'other' ? userTeam : 'all';
        return team as any;
    });

    const activeTeam = useMemo(() => {
        if (isSuperAdmin) return selectedTeamTab;
        return userTeam !== 'other' ? userTeam : 'KCC';
    }, [isSuperAdmin, selectedTeamTab, userTeam]);

    // Load policies & directories
    useEffect(() => {
        setLoading(true);
        
        // 1. Fetch policies
        const qPolicies = query(collection(db, 'policies'), orderBy('sortOrder', 'asc'));
        const unsubPolicies = onSnapshot(qPolicies, (snapshot) => {
            const list: PolicyItem[] = [];
            snapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                if (data.visible !== false) {
                    list.push({
                        id: docSnapshot.id,
                        title: data.title || '',
                        description: data.description || '',
                        type: data.type || 'document',
                        url: data.url || '',
                        thumbnailUrl: data.thumbnailUrl || '',
                        targetTeam: data.targetTeam || mapBusinessTypeToTeam(data.businessType || 'all'),
                        directoryId: data.directoryId || null,
                        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
                        visible: data.visible !== false
                    });
                }
            });
            setPolicies(list);
            setLoading(false);
        }, (error) => {
            console.error("Error loading policies:", error);
            setLoading(false);
        });

        // 2. Fetch directories
        const qDirs = query(collection(db, 'policy_directories'), orderBy('sortOrder', 'asc'));
        const unsubDirs = onSnapshot(qDirs, (snapshot) => {
            const list: PolicyDirectory[] = [];
            snapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                list.push({
                    id: docSnapshot.id,
                    name: data.name || '',
                    parentId: data.parentId || null,
                    targetTeam: data.targetTeam || 'all',
                    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0
                });
            });
            setDirectories(list);
        }, (error) => {
            console.error("Error loading directories:", error);
        });

        return () => {
            unsubPolicies();
            unsubDirs();
        };
    }, []);

    // Reset folder path context if tab changes (for super admins)
    useEffect(() => {
        setCurrentFolderId(null);
    }, [activeTeam]);

    // Scoped list filtering: targetTeam must match activeTeam or be 'all'
    const visiblePolicies = useMemo(() => {
        if (activeTeam === 'all') return policies;
        return policies.filter(p => p.targetTeam === 'all' || p.targetTeam === activeTeam);
    }, [policies, activeTeam]);

    const visibleDirectories = useMemo(() => {
        if (activeTeam === 'all') return directories;
        return directories.filter(d => d.targetTeam === 'all' || d.targetTeam === activeTeam);
    }, [directories, activeTeam]);

    // Current level contents
    const foldersInCurrentLevel = useMemo(() => {
        return visibleDirectories.filter(d => d.parentId === currentFolderId);
    }, [visibleDirectories, currentFolderId]);

    const policiesInCurrentLevel = useMemo(() => {
        return visiblePolicies.filter(p => p.directoryId === currentFolderId);
    }, [visiblePolicies, currentFolderId]);

    // Breadcrumbs pathway logic
    const breadcrumbs = useMemo(() => {
        const trail: { id: string | null; name: string }[] = [{ id: null, name: t('policy_showcase.root_directory', '根目录') }];
        if (!currentFolderId) return trail;
        
        let current = visibleDirectories.find(d => d.id === currentFolderId);
        const steps: { id: string; name: string }[] = [];
        while (current) {
            steps.unshift({ id: current.id, name: current.name });
            const parentId = current.parentId;
            current = parentId ? visibleDirectories.find(d => d.id === parentId) : undefined;
        }
        return [...trail, ...steps];
    }, [currentFolderId, visibleDirectories, t]);

    const getTeamLabel = (team: string) => {
        switch (team) {
            case 'all': return t('common.all_business_option', '全部业务线');
            case 'KCC': return t('common.team_kcc_clean', 'KCC 青少');
            case 'GCC': return t('common.team_gcc_clean', 'GCC 专区');
            case 'Adult': return t('common.team_adult_clean', 'ACC 成人');
            case 'SS': return t('common.team_ss_clean', 'SS 团队');
            default: return team;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header layout */}
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
                            {t('policy_showcase.title', '运营政策与激励中心')}
                        </h1>
                        <p className="text-arabian-night/60 text-sm mt-1">
                            {!isSuperAdmin ? t('policy_showcase.subtitle_user', '{{team}} 专属政策与方案浏览', { team: getTeamLabel(activeTeam) }) : t('policy_showcase.subtitle_admin', '管理权限：全局政策多中心预览')}
                        </p>
                    </div>
                </div>

                {/* Preview tab switcher for Super Admin / All Scoped Admin */}
                {isSuperAdmin && (
                    <div className="p-1 rounded-full flex bg-white/70 backdrop-blur-md border border-white/50 shadow-sm overflow-x-auto whitespace-nowrap scrollbar-none w-full sm:w-auto">
                        {(['all', 'KCC', 'GCC', 'Adult', 'SS'] as const).map(team => (
                            <button
                                key={team}
                                onClick={() => setSelectedTeamTab(team)}
                                className={`px-4 py-2 rounded-full font-extrabold text-xs transition-all duration-300 cursor-pointer ${
                                    selectedTeamTab === team 
                                        ? 'bg-gradient-to-r from-deep-teal to-teal-800 text-white shadow'
                                        : 'text-arabian-night/65 hover:text-arabian-night hover:bg-white/40'
                                }`}
                            >
                                👁️ {getTeamLabel(team)}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Breadcrumb path navigation */}
            <div className="bg-white/45 backdrop-blur-md border border-white/60 p-3.5 rounded-2xl flex items-center flex-wrap gap-2.5 text-xs text-slate-500 font-bold select-none shadow-sm">
                {breadcrumbs.map((crumb, idx) => (
                    <React.Fragment key={crumb.id || 'root'}>
                        {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        <button
                            onClick={() => setCurrentFolderId(crumb.id)}
                            className={`hover:text-desert-gold transition-colors flex items-center gap-1 cursor-pointer ${
                                idx === breadcrumbs.length - 1 
                                    ? 'text-deep-teal font-black text-sm' 
                                    : ''
                            }`}
                        >
                            {crumb.id === null ? '🏠 ' : '📁 '}
                            {crumb.name}
                        </button>
                    </React.Fragment>
                ))}
            </div>

            {/* Directory explorer area */}
            {loading ? (
                <div className="flex justify-center py-24">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-desert-gold"></div>
                </div>
            ) : (foldersInCurrentLevel.length === 0 && policiesInCurrentLevel.length === 0) ? (
                <div className="p-16 rounded-3xl border border-white/60 bg-white/40 text-center shadow-sm max-w-md mx-auto">
                    <Folder className="h-14 w-14 mx-auto mb-4 opacity-25 text-deep-teal" />
                    <h3 className="text-lg font-bold text-deep-teal mb-1">
                        {t('policy_showcase.empty_dir_title', '本目录暂无内容')}
                    </h3>
                    <p className="text-xs text-arabian-night/50">
                        {t('policy_showcase.empty_dir_desc', '运营管理员尚未在此级目录内发布相关的政策、海报或宣导视频。')}
                    </p>
                    {currentFolderId !== null && (
                        <button 
                            onClick={() => {
                                const parent = visibleDirectories.find(d => d.id === currentFolderId);
                                setCurrentFolderId(parent ? parent.parentId : null);
                            }}
                            className="mt-5 text-xs bg-white border border-gray-200 px-4 py-2 rounded-xl text-deep-teal font-extrabold hover:border-desert-gold/30 hover:scale-105 transition-all shadow-sm cursor-pointer"
                        >
                            {t('policy_showcase.back_parent', '返回上一级')}
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                    
                    {/* Folders grid */}
                    {foldersInCurrentLevel.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 select-none">{t('policy_showcase.directories_title', '文件夹目录 ({{count}})', { count: foldersInCurrentLevel.length })}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {foldersInCurrentLevel.map(folder => (
                                    <div 
                                        key={folder.id}
                                        onClick={() => setCurrentFolderId(folder.id)}
                                        className="group cursor-pointer p-4 rounded-2xl border border-white/70 bg-white/50 hover:bg-white hover:border-desert-gold/30 hover:-translate-y-1 hover:shadow-md flex items-center gap-3.5 transition-all duration-300"
                                    >
                                        <div className="p-3 bg-amber-500/10 rounded-xl group-hover:bg-amber-500/20 transition-all shrink-0">
                                            <Folder className="w-6 h-6 text-amber-500 fill-amber-500/20 group-hover:scale-110 transition-transform" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-sm text-slate-800 truncate group-hover:text-desert-gold transition-colors">{folder.name}</h4>
                                            <span className="text-[10px] text-slate-400 font-semibold">{t('policy_showcase.open_folder', '打开文件夹')} →</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Files grid */}
                    {policiesInCurrentLevel.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 select-none">{t('policy_showcase.files_title', '政策文件与激励 ({{count}})', { count: policiesInCurrentLevel.length })}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {policiesInCurrentLevel.map(policy => {
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
                                                    {policy.type === 'document' ? t('policy_showcase.type_doc_badge', '📄 文档') : policy.type === 'poster' ? t('policy_showcase.type_poster_badge', '🖼️ 海报') : t('policy_showcase.type_video_badge', '🎥 视频')}
                                                </span>
                                            </div>

                                            {/* Text Info */}
                                            <div className="p-4 flex-1 flex flex-col justify-between bg-white/40">
                                                <div>
                                                    <h4 className="font-black text-sm text-slate-800 line-clamp-1 group-hover:text-desert-gold transition-colors">
                                                        {policy.title}
                                                    </h4>
                                                    {policy.description && (
                                                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed font-medium">
                                                            {policy.description}
                                                        </p>
                                                    )}
                                                </div>
                                                
                                                {/* Action footer */}
                                                <div className="flex items-center justify-between mt-3.5 pt-2.5 border-t border-slate-100">
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        {policy.targetTeam === 'all' ? t('policy_showcase.visible_to_all', '全部可见') : getTeamLabel(policy.targetTeam)}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-desert-gold hover:underline flex items-center gap-0.5">
                                                        {policy.type === 'document' ? t('policy_showcase.action_read', '立即阅读') : policy.type === 'poster' ? t('policy_showcase.action_view_poster', '查看海报') : t('policy_showcase.action_play_video', '播放视频')} →
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
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
