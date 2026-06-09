import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { 
    ArrowLeft,
    Folder,
    ChevronRight,
    ChevronDown,
    FileText,
    Image as ImageIcon,
    Video as VideoIcon,
    Music,
    Play,
    Download,
    Search,
    X,
    Loader2,
    BookOpen,
    ExternalLink,
    Volume2
} from 'lucide-react';

interface ReferralCategory {
    id: string;
    name: string;
    parentId: string | null;
    sortOrder: number;
}

interface ReferralMaterial {
    id: string;
    categoryId: string | null;
    title: string;
    description?: string;
    type: 'document' | 'audio' | 'video' | 'image';
    url: string;
    sortOrder: number;
    visible: boolean;
}

// Inline Custom Audio Player matching project aesthetics
const MaterialAudioPlayer = ({ src }: { src: string }) => {
    const { t } = useTranslation();
    const audioRef = React.useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const speeds = [0.75, 1, 1.25, 1.5, 2];

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play().catch(err => console.error("Playback error:", err));
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const cycleSpeed = (e: React.MouseEvent) => {
        e.stopPropagation();
        const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
        const newRate = speeds[nextIdx];
        setPlaybackRate(newRate);
        if (audioRef.current) {
            audioRef.current.playbackRate = newRate;
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) setDuration(audioRef.current.duration);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const newTime = Number(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time) || !isFinite(time)) return "0:00";
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div 
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col w-full bg-slate-50/70 border border-slate-100 rounded-2xl p-2.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01),0_1px_3px_rgba(0,0,0,0.02)] select-none gap-0.5 mt-2 animate-in fade-in duration-300"
        >
            <audio 
                ref={audioRef} 
                src={src} 
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
            />
            <div className="flex items-center gap-2.5 w-full">
                <button 
                    onClick={togglePlay}
                    className="shrink-0 w-8 h-8 flex items-center justify-center bg-gradient-to-r from-deep-teal to-[#005f66] text-white rounded-full hover:scale-105 active:scale-95 transition-all shadow-sm focus:outline-none cursor-pointer border border-white/20"
                >
                    {isPlaying ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                        <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                </button>
                <div className="text-[9px] font-bold text-slate-400 shrink-0 w-7 text-right tracking-tight font-mono">
                    {formatTime(currentTime)}
                </div>
                <input 
                    type="range" 
                    min="0" 
                    max={duration || 100} 
                    step="0.1"
                    value={currentTime} 
                    onChange={handleSeek}
                    className="flex-1 h-1 bg-slate-200 rounded-full appearance-none focus:outline-none cursor-pointer"
                    style={{ accentColor: '#d4af37' }}
                />
                <div className="text-[9px] font-bold text-slate-400 shrink-0 w-7 tracking-tight font-mono">
                    {formatTime(duration)}
                </div>
                <button 
                    onClick={cycleSpeed}
                    className="shrink-0 text-[9px] font-black text-amber-700 bg-amber-50 hover:bg-amber-100 border border-desert-gold/25 rounded-md px-1.5 py-0.5 transition-all focus:outline-none active:scale-90 cursor-pointer shadow-sm"
                >
                    {playbackRate}x
                </button>
            </div>
        </div>
    );
};

// Main Component
export default function ReferralShowcase() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { profile } = useAuth();

    // Data lists
    const [categories, setCategories] = useState<ReferralCategory[]>([]);
    const [materials, setMaterials] = useState<ReferralMaterial[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI state
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeVideoItem, setActiveVideoItem] = useState<ReferralMaterial | null>(null);
    const [activeImageItem, setActiveImageItem] = useState<ReferralMaterial | null>(null);

    // Collapsed folders state (maps folderId to boolean indicating if collapsed)
    const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

    // Load Data
    useEffect(() => {
        setLoading(true);
        
        // 1. Fetch categories sorted by sortOrder
        const qCats = query(collection(db, 'referral_categories'), orderBy('sortOrder', 'asc'));
        const unsubCats = onSnapshot(qCats, (snapshot) => {
            const list: ReferralCategory[] = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                list.push({
                    id: docSnap.id,
                    name: data.name || '',
                    parentId: data.parentId || null,
                    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0
                });
            });
            setCategories(list);
        }, (err) => {
            console.error("Error fetching referral categories:", err);
        });

        // 2. Fetch materials
        const qMats = query(collection(db, 'referral_materials'), orderBy('sortOrder', 'asc'));
        const unsubMats = onSnapshot(qMats, (snapshot) => {
            const list: ReferralMaterial[] = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.visible !== false) {
                    list.push({
                        id: docSnap.id,
                        categoryId: data.categoryId || null,
                        title: data.title || '',
                        description: data.description || '',
                        type: data.type || 'document',
                        url: data.url || '',
                        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
                        visible: data.visible !== false
                    });
                }
            });
            setMaterials(list);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching referral materials:", err);
            setLoading(false);
        });

        return () => {
            unsubCats();
            unsubMats();
        };
    }, []);

    // Filtered lists
    const activeFolderMaterials = useMemo(() => {
        let baseList = materials;
        // 1. Filter by folderId if folder is selected
        if (currentFolderId) {
            baseList = baseList.filter(m => m.categoryId === currentFolderId);
        } else {
            // Root shows everything that's either root or folders (if no folder is selected, we filter based on query)
            // But let's follow PolicyShowcase design: if root selected, only show items with categoryId === null
            baseList = baseList.filter(m => m.categoryId === null);
        }
        
        // 2. Search query filter
        if (searchQuery.trim()) {
            const queryText = searchQuery.toLowerCase().trim();
            // If searching, we check the title or description across ALL materials, or just within this folder?
            // Usually, searching should scan globally/locally. Let's make it scan globally for a better search UX!
            return materials.filter(m => 
                m.title.toLowerCase().includes(queryText) || 
                (m.description || '').toLowerCase().includes(queryText)
            );
        }

        return baseList;
    }, [materials, currentFolderId, searchQuery]);

    // Categories in tree structure
    const categoryTree = useMemo(() => {
        const map: Record<string, ReferralCategory[]> = {};
        const roots: ReferralCategory[] = [];
        
        categories.forEach(c => {
            if (c.parentId) {
                if (!map[c.parentId]) map[c.parentId] = [];
                map[c.parentId].push(c);
            } else {
                roots.push(c);
            }
        });

        // Sort children
        Object.keys(map).forEach(pid => {
            map[pid].sort((a, b) => a.sortOrder - b.sortOrder);
        });
        roots.sort((a, b) => a.sortOrder - b.sortOrder);

        return { roots, map };
    }, [categories]);

    // Breadcrumbs pathway logic
    const breadcrumbs = useMemo(() => {
        const trail: { id: string | null; name: string }[] = [{ id: null, name: t('referral_showcase.root_directory', '全部素材') }];
        if (!currentFolderId) return trail;
        
        let current = categories.find(c => c.id === currentFolderId);
        const steps: { id: string; name: string }[] = [];
        while (current) {
            steps.unshift({ id: current.id, name: current.name });
            const parentId = current.parentId;
            current = parentId ? categories.find(c => c.id === parentId) : undefined;
        }
        return [...trail, ...steps];
    }, [currentFolderId, categories, t]);

    const toggleFolderCollapse = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setCollapsedFolders(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Recursive category node renderer for sidebar tree
    const renderCategoryNode = (category: ReferralCategory, level: number = 0) => {
        const hasChildren = categoryTree.map[category.id] && categoryTree.map[category.id].length > 0;
        const isCollapsed = collapsedFolders[category.id] || false;
        const isActive = currentFolderId === category.id;

        return (
            <div key={category.id} className="space-y-1">
                <div 
                    onClick={() => { setCurrentFolderId(category.id); setSearchQuery(''); }}
                    style={{ paddingLeft: `${level * 12 + 8}px` }}
                    className={`group flex items-center justify-between py-2.5 pr-2.5 rounded-xl cursor-pointer transition-all ${
                        isActive 
                            ? 'bg-gradient-to-r from-amber-500/10 to-rose-600/5 border-l-4 border-amber-500 text-amber-700 font-extrabold shadow-sm'
                            : 'border-l-4 border-transparent hover:bg-slate-100/60 text-slate-600 hover:text-slate-900 font-bold'
                    }`}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        {hasChildren ? (
                            <button 
                                onClick={(e) => toggleFolderCollapse(e, category.id)}
                                className="p-0.5 hover:bg-slate-200 rounded-md transition-colors shrink-0 text-slate-400 group-hover:text-slate-600 cursor-pointer"
                            >
                                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                        ) : (
                            <span className="w-4 shrink-0"></span>
                        )}
                        <Folder className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-amber-500 fill-amber-500/15' : 'text-amber-400 group-hover:text-amber-500'
                        }`} />
                        <span className="text-xs truncate">{category.name}</span>
                    </div>
                </div>

                {hasChildren && !isCollapsed && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        {categoryTree.map[category.id].map(child => renderCategoryNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Top Navigation / Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/hub')}
                        className="p-2.5 bg-white hover:bg-slate-50 rounded-xl border border-gray-200/50 shadow-sm transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
                        title={t('learning_hub.back_to_hub', '返回学习中心')}
                    >
                        <ArrowLeft className="h-5 w-5 text-deep-teal" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-rose-600 tracking-tight">
                            {t('referral_showcase.title', '推荐业务素材专区')}
                        </h1>
                        <p className="text-arabian-night/60 text-xs mt-1">
                            {t('referral_showcase.subtitle', '推荐业务宣传话术、流程指南、海报物料及优秀录音案例')}
                        </p>
                    </div>
                </div>

                {/* Search input in header */}
                <div className="relative w-full sm:w-72 md:w-80 shrink-0 shadow-sm">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder={t('referral_showcase.search_placeholder', '全局搜素材标题或内容描述...')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 text-xs rounded-2xl border border-gray-200/70 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white/80 font-bold"
                    />
                </div>
            </div>

            {/* Main Showcase Layout */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                
                {/* 1. Left Sidebar: Tree Categories Folder list */}
                <div className="glass-panel p-4 border border-white/60 rounded-3xl h-[650px] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3 shrink-0">
                        <h3 className="text-sm font-black text-deep-teal flex items-center gap-1.5 select-none">
                            <Folder className="w-4.5 h-4.5 text-amber-500 fill-amber-500/10" />
                            {t('referral_showcase.categories_dir', '分类目录目录')}
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-none">
                        {/* Root item */}
                        <div 
                            onClick={() => { setCurrentFolderId(null); setSearchQuery(''); }}
                            className={`group flex items-center gap-2 py-2.5 px-3 rounded-xl cursor-pointer transition-all border-l-4 ${
                                currentFolderId === null 
                                    ? 'bg-gradient-to-r from-amber-500/10 to-rose-600/5 border-amber-500 text-amber-700 font-extrabold shadow-sm'
                                    : 'border-transparent hover:bg-slate-100/60 text-slate-600 hover:text-slate-900 font-bold'
                            }`}
                        >
                            <span className="w-4 shrink-0"></span>
                            <span className="text-xs">📂 {t('referral_showcase.all_materials', '全部根目录素材')}</span>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                            </div>
                        ) : categoryTree.roots.length === 0 ? (
                            <p className="text-[11px] text-center text-slate-400 py-10">{t('referral_showcase.no_folders', '暂无文件夹')}</p>
                        ) : (
                            categoryTree.roots.map(root => renderCategoryNode(root))
                        )}
                    </div>
                </div>

                {/* 2. Right Content Grid */}
                <div className="md:col-span-3 space-y-4">
                    {/* Breadcrumbs trail */}
                    <div className="bg-white/50 border border-white p-3.5 rounded-2xl flex items-center flex-wrap gap-2.5 text-xs text-slate-500 font-bold shadow-sm">
                        {breadcrumbs.map((crumb, idx) => (
                            <React.Fragment key={crumb.id || 'root'}>
                                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                <button
                                    onClick={() => { setCurrentFolderId(crumb.id); setSearchQuery(''); }}
                                    className={`hover:text-amber-500 transition-colors flex items-center gap-1 cursor-pointer ${
                                        idx === breadcrumbs.length - 1 
                                            ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-rose-600 font-black text-sm' 
                                            : ''
                                    }`}
                                >
                                    {crumb.id === null ? '🏠 ' : '📁 '}
                                    {crumb.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Materials Grid */}
                    {loading ? (
                        <div className="flex justify-center py-32">
                            <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
                        </div>
                    ) : activeFolderMaterials.length === 0 ? (
                        <div className="bg-white/40 border border-white/60 rounded-3xl p-16 text-center max-w-md mx-auto shadow-sm">
                            <Folder className="h-14 w-14 mx-auto mb-4 text-slate-300" />
                            <h4 className="text-lg font-black text-slate-700 mb-1">{t('referral_showcase.empty_title', '该文件夹下没有素材')}</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                {searchQuery ? t('referral_showcase.search_empty', '没有找到符合您搜索要求的素材资源。') : t('referral_showcase.empty_desc', '运营人员目前尚未在此目录下发布推荐政策资料或宣导视频。')}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in slide-in-from-bottom-3 duration-500">
                            {activeFolderMaterials.map(item => {
                                const isDoc = item.type === 'document';
                                const isAudio = item.type === 'audio';
                                const isVideo = item.type === 'video';
                                const isImage = item.type === 'image';

                                return (
                                    <div 
                                        key={item.id}
                                        onClick={() => {
                                            if (isVideo) setActiveVideoItem(item);
                                            else if (isImage) setActiveImageItem(item);
                                            else if (isDoc) window.open(item.url, '_blank');
                                        }}
                                        className="group cursor-pointer glass-panel rounded-2xl border border-white/60 bg-white/65 hover:bg-white hover:border-amber-500/30 hover:-translate-y-1.5 shadow-sm hover:shadow-lg flex flex-col transition-all duration-500 overflow-hidden"
                                    >
                                        {/* Card Top Preview */}
                                        <div className="relative aspect-video w-full bg-slate-950 overflow-hidden flex items-center justify-center border-b border-white/10 shrink-0">
                                            {isImage ? (
                                                <img 
                                                    src={item.url} 
                                                    alt={item.title} 
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                            ) : isVideo ? (
                                                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-rose-950/80 flex items-center justify-center">
                                                    <VideoIcon className="h-8 w-8 text-rose-500/80 group-hover:scale-110 transition-transform" />
                                                    <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors z-10 flex items-center justify-center">
                                                        <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center transform group-hover:scale-110 transition-all shadow-md">
                                                            <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : isAudio ? (
                                                <div className="absolute inset-0 bg-gradient-to-br from-[#0c2240] to-emerald-950/80 flex flex-col items-center justify-center gap-1.5">
                                                    <Music className="h-8 w-8 text-emerald-400 group-hover:scale-110 transition-transform" />
                                                    <Volume2 className="w-3.5 h-3.5 text-emerald-400/40 animate-pulse" />
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-blue-950/80 flex flex-col items-center justify-center gap-1.5 p-4 text-center">
                                                    <FileText className="h-8 w-8 text-blue-400" />
                                                </div>
                                            )}

                                            {/* Type Badge */}
                                            <span className="absolute top-2.5 right-2.5 bg-black/55 backdrop-blur-md text-white text-[9px] font-black tracking-wide px-2.5 py-0.5 rounded-full border border-white/10 shadow-sm z-20 select-none">
                                                {isDoc ? t('referral_showcase.badge_doc', '📄 文档') : isAudio ? t('referral_showcase.badge_audio', '🎧 音频') : isVideo ? t('referral_showcase.badge_video', '🎥 视频') : t('referral_showcase.badge_image', '🖼️ 图片')}
                                            </span>
                                        </div>

                                        {/* Card Text Content */}
                                        <div className="p-4 flex-1 flex flex-col justify-between bg-white/30">
                                            <div className="space-y-1">
                                                <h4 className="font-black text-sm text-slate-800 line-clamp-1 group-hover:text-amber-600 transition-colors">
                                                    {item.title}
                                                </h4>
                                                {item.description && (
                                                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-medium">
                                                        {item.description}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Embed Audio Player inline inside Audio card */}
                                            {isAudio && (
                                                <MaterialAudioPlayer src={item.url} />
                                            )}

                                            {/* Footer action link */}
                                            {!isAudio && (
                                                <div className="flex items-center justify-end mt-4 pt-2.5 border-t border-slate-100">
                                                    <span className="text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-0.5 select-none">
                                                        {isDoc ? t('referral_showcase.action_read', '打开阅读') : isVideo ? t('referral_showcase.action_play', '播放视频') : t('referral_showcase.action_view_image', '查看大图')} →
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Video Modal Previewer */}
            {activeVideoItem && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
                    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 dark:border-slate-800/60 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative">
                        {/* Close button */}
                        <button 
                            onClick={() => setActiveVideoItem(null)}
                            className="absolute top-4 right-4 z-50 p-2 bg-black/10 hover:bg-black/25 text-slate-700 dark:text-white rounded-full transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div className="p-6 border-b border-gray-100 pr-16">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                🎥 {t('referral_showcase.badge_video', '宣导视频')}
                            </span>
                            <h3 className="text-lg font-black text-slate-800 mt-1">{activeVideoItem.title}</h3>
                        </div>

                        <div className="flex-1 overflow-auto bg-black flex items-center justify-center min-h-[350px]">
                            <video 
                                src={activeVideoItem.url} 
                                controls 
                                autoPlay
                                className="max-w-full max-h-[60vh] rounded-xl object-contain bg-black shadow-2xl"
                            />
                        </div>

                        <div className="p-4 bg-slate-50 flex justify-end">
                            <button 
                                onClick={() => setActiveVideoItem(null)}
                                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded-xl font-bold transition-all text-xs cursor-pointer"
                            >
                                {t('common.close', '关闭')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Modal Lightbox */}
            {activeImageItem && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
                    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 dark:border-slate-800/60 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative">
                        {/* Close button */}
                        <button 
                            onClick={() => setActiveImageItem(null)}
                            className="absolute top-4 right-4 z-50 p-2 bg-black/10 hover:bg-black/25 text-slate-700 dark:text-white rounded-full transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="p-6 border-b border-gray-100 pr-16">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20">
                                🖼️ {t('referral_showcase.badge_image', '推荐海报')}
                            </span>
                            <h3 className="text-lg font-black text-slate-800 mt-1">{activeImageItem.title}</h3>
                        </div>

                        <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center min-h-[350px] relative group">
                            <img 
                                src={activeImageItem.url} 
                                alt={activeImageItem.title} 
                                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-2xl"
                            />
                            <a 
                                href={activeImageItem.url} 
                                download 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute bottom-6 bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-md px-6 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 cursor-pointer"
                            >
                                <Download className="w-4 h-4" />
                                {t('referral_showcase.download_origin', '下载原图海报')}
                            </a>
                        </div>

                        <div className="p-4 bg-slate-50 flex justify-end">
                            <button 
                                onClick={() => setActiveImageItem(null)}
                                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded-xl font-bold transition-all text-xs cursor-pointer"
                            >
                                {t('common.close', '关闭')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
