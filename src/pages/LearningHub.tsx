import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, getDoc, setDoc, increment } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { PlayCircle, Clock, User, Search, Moon, Heart, Headphones, Trophy, Play, X, ChevronDown, ChevronUp, Share2, FileText, BookOpen } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface Recording {
    id: string;
    title: string;
    description: string;
    lecturerName?: string;
    audioUrl: string;
    avatarUrl?: string;
    categoryId?: string;
    createdAt: any;
    likes?: string[];
    displayId?: string;
    playCount?: number;
}

interface Category {
    id: string;
    name: string;
}

const CustomAudioPlayer = ({ src, onEnded, disableSeek = false }: { src: string, onEnded: (duration: number) => void, disableSeek?: boolean }) => {
    const { t } = useTranslation();
    const audioRef = React.useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const speeds = [0.75, 1, 1.5];

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    };

    const cycleSpeed = () => {
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
        if (disableSeek) return;
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
        <div className="flex flex-col w-full gap-1 pt-1 pb-1">
            <audio 
                ref={audioRef} 
                src={src} 
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => {
                    setIsPlaying(false);
                    onEnded(duration);
                }}
                className="hidden"
            />
            <div className="flex items-center gap-2 w-full px-1">
                <button 
                    onClick={togglePlay}
                    className="shrink-0 w-7 h-7 flex items-center justify-center bg-deep-teal text-white rounded-full hover:bg-teal-700 transition-colors shadow-sm focus:outline-none"
                >
                    {isPlaying ? (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                        <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                </button>
                <div className="text-[10px] font-bold text-arabian-night/60 shrink-0 w-7 text-right tracking-tighter">
                    {formatTime(currentTime)}
                </div>
                <input 
                    type="range" 
                    min="0" 
                    max={duration || 100} 
                    step="0.1"
                    value={currentTime} 
                    onChange={handleSeek}
                    className={`flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none focus:outline-none ${disableSeek ? 'cursor-not-allowed opacity-70 pointer-events-none' : 'cursor-pointer'}`}
                    style={{ accentColor: '#d4af37' }}
                    readOnly={disableSeek}
                />
                <div className="text-[10px] font-bold text-arabian-night/60 shrink-0 w-7 tracking-tighter">
                    {formatTime(duration)}
                </div>
                <button 
                    onClick={cycleSpeed}
                    title={t('common.playback_speed', 'Playback Speed')}
                    className="shrink-0 text-[10px] font-extrabold text-desert-gold bg-desert-gold/10 hover:bg-desert-gold/20 border border-desert-gold/30 rounded-md px-1.5 py-0.5 transition-colors ml-1 focus:outline-none"
                >
                    {playbackRate}x
                </button>
            </div>
        </div>
    );
};

const isVideoUrl = (url: string) => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.mp4') || 
           cleanUrl.endsWith('.webm') || 
           cleanUrl.endsWith('.mov') || 
           cleanUrl.endsWith('.m4v') ||
           cleanUrl.endsWith('.ogg') ||
           cleanUrl.endsWith('.avi') ||
           cleanUrl.endsWith('.mkv');
};

const isDocUrl = (url: string) => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.pdf') || 
           cleanUrl.endsWith('.doc') || 
           cleanUrl.endsWith('.docx') || 
           cleanUrl.endsWith('.xls') || 
           cleanUrl.endsWith('.xlsx') ||
           cleanUrl.endsWith('.ppt') ||
           cleanUrl.endsWith('.pptx') ||
           cleanUrl.endsWith('.txt') ||
           cleanUrl.endsWith('.zip') ||
           cleanUrl.endsWith('.rar');
};

// Recording Card Component
const RecordingCard = ({ 
    rec, 
    user, 
    favorites, 
    handleToggleFavorite, 
    handleToggleLike, 
    handleAudioEnded,
    onPlayVideo,
    onShare,
    disableSeek = false,
    className = ""
}: any) => {
    const { t } = useTranslation();
    const isLiked = rec.likes?.includes(user?.uid || '');
    const isFav = favorites.includes(rec.id);
    const isVideo = isVideoUrl(rec.audioUrl);
    const isDoc = isDocUrl(rec.audioUrl) || 
                  rec.categoryName?.toLowerCase() === 'doc' || 
                  rec.categoryName === '文档' || 
                  rec.categoryName === 'ss文档' || 
                  rec.categoryName?.toLowerCase() === 'document';

    return (
        <div className={`glass-panel rounded-xl hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group flex flex-col border border-white/60 overflow-hidden relative ${className}`}>
            {isDoc ? (
                /* Beautiful Document Cover in the list card */
                <a 
                    href={rec.audioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-24 bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 relative flex items-center justify-center cursor-pointer overflow-hidden border-b border-gray-100 group/doc shrink-0 animate-in fade-in"
                >
                    <div className="absolute inset-0 opacity-25 bg-[url('data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E')]"></div>
                    <div className="absolute inset-0 bg-black/10 group-hover/doc:bg-black/35 transition-colors duration-300 z-10"></div>
                    
                    {/* Centered Glassmorphic Read Button */}
                    <div className="flex flex-col items-center justify-center gap-1.5 z-20">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-lg transform group-hover/doc:scale-110 group-hover/doc:bg-white group-hover/doc:text-orange-600 transition-all duration-300">
                            <FileText className="w-5 h-5 text-white group-hover/doc:text-orange-600" />
                        </div>
                        <span className="text-[10px] text-white/90 font-black tracking-widest bg-black/25 px-2 py-0.5 rounded-full select-none">
                            {t('learning_hub.read_document', '阅读学习文档')}
                        </span>
                    </div>
                    
                    {/* Document Badge Tag */}
                    <span className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1 z-20 select-none">
                        📄 {t('learning_hub.doc_tag', '文档')}
                    </span>
                </a>
            ) : isVideo ? (
                /* Beautiful Video Thumbnail/Cover in the list card */
                <div 
                    onClick={() => onPlayVideo(rec, disableSeek)}
                    className="w-full aspect-video bg-gradient-to-br from-light-teal to-deep-teal relative flex items-center justify-center cursor-pointer overflow-hidden border-b border-gray-100 group/video shrink-0 animate-in fade-in"
                >
                    <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23d4af37\' fill-opacity=\'1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E')]"></div>
                    <div className="absolute inset-0 bg-black/10 group-hover/video:bg-black/30 transition-colors duration-300 z-10"></div>
                    
                    {/* Centered Glassmorphic Play Button */}
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-lg transform group-hover/video:scale-110 group-hover/video:bg-desert-gold group-hover/video:border-desert-gold/50 transition-all duration-300 z-20">
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </div>
                    
                    {/* Video Badge Tag */}
                    <span className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1 z-20 select-none">
                        🎥 {t('learning_hub.video_tag', '视频')}
                    </span>
                </div>
            ) : (
                /* Decorative Background Top for Audio */
                <div className="h-14 w-full bg-gradient-to-br from-light-teal to-deep-teal absolute top-0 left-0 z-0">
                    <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23d4af37\' fill-opacity=\'1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E')]"></div>
                </div>
            )}

            {/* Card Content with Restored Avatar */}
            <div className={`relative z-10 p-4 flex flex-col flex-1 ${(!isVideo && !isDoc) ? 'pt-5' : 'pt-3'}`}>
                {/* Circular Avatar & Category */}
                <div className="relative mb-2 flex items-end justify-between">
                    <div className="w-12 h-12 rounded-full border-[3px] border-white shadow-sm bg-white flex items-center justify-center overflow-hidden">
                        {rec.avatarUrl ? (
                            <img src={rec.avatarUrl} alt="Instructor" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-desert-gold to-yellow-600 flex items-center justify-center">
                                <User className="h-6 w-6 text-white/80" />
                            </div>
                        )}
                    </div>
                    <span className="text-[10px] bg-white text-desert-gold border border-desert-gold/30 px-2 py-0.5 rounded-full font-bold shadow-sm">
                        {rec.categoryName || t('common.uncategorized')}
                    </span>
                </div>
                
                <div className="flex-1">
                    <h4 className="font-bold text-base mb-0.5 group-hover:text-desert-gold transition-colors line-clamp-1 text-arabian-night">
                        {rec.displayId && <span className="text-desert-gold mr-1 text-xs font-bold">[{rec.displayId}]</span>}
                        {rec.title}
                    </h4>
                    {rec.lecturerName && (
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-desert-gold mb-1">
                            <User className="h-3 w-3" />
                            <span>{rec.lecturerName}</span>
                        </div>
                    )}
                    <p className="text-xs text-arabian-night/60 mb-2 line-clamp-2">
                        {rec.description}
                    </p>
                </div>

                <div className="mt-auto pt-2.5 border-t border-arabian-night/10">
                    <div className="flex justify-between items-center mb-2.5 text-[11px] font-semibold text-deep-teal">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{rec.createdAt?.toDate().toLocaleDateString() || t('common.just_now')}</span>
                            </div>
                            {rec.playCount !== undefined && (
                                <div className="flex items-center gap-1 text-desert-gold">
                                    <Headphones className="h-3 w-3" />
                                    <span>{rec.playCount}{t('common.times')}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleToggleFavorite(rec.id)}
                                className="flex items-center gap-1 transition-all outline-none bg-white p-1.5 rounded-full border border-gray-100 shadow-sm hover:shadow-md hover:border-red-200 active:scale-95"
                                title={t('common.favorite', '收藏')}
                            >
                                <Heart className={`h-4 w-4 transition-all duration-300 ${isFav ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-300 hover:text-red-400'}`} />
                            </button>
                            
                            <button 
                                onClick={() => handleToggleLike(rec.id, rec.likes)}
                                className="flex items-center gap-1 transition-all outline-none bg-white px-2 py-0.5 rounded-full border border-gray-100 shadow-sm hover:shadow-md hover:border-desert-gold/30 active:scale-95"
                            >
                                <Moon className={`h-3.5 w-3.5 transition-all duration-300 ${isLiked ? 'fill-desert-gold text-desert-gold scale-110' : 'text-arabian-night/40 group-hover/btn:text-desert-gold'}`} />
                                <span className={`${isLiked ? 'text-desert-gold' : 'text-arabian-night/50'} font-bold text-xs`}>
                                    {rec.likes?.length || 0}
                                </span>
                            </button>

                            <button 
                                onClick={() => onShare && onShare(rec)}
                                className="flex items-center gap-1 transition-all outline-none bg-white p-1.5 rounded-full border border-gray-100 shadow-sm hover:shadow-md hover:border-desert-gold/30 active:scale-95"
                                title={t('common.share', '分享')}
                            >
                                <Share2 className="h-4 w-4 text-arabian-night/40 hover:text-desert-gold transition-all" />
                            </button>
                        </div>
                    </div>
                    
                    {!isVideo && !isDoc && (
                        <CustomAudioPlayer 
                            src={rec.audioUrl} 
                            onEnded={(duration) => handleAudioEnded(rec, duration)} 
                            disableSeek={disableSeek}
                        />
                    )}
                    
                    {isDoc && (
                        <a
                            href={rec.audioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2.5 w-full bg-gradient-to-r from-deep-teal to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                        >
                            <BookOpen className="w-4 h-4" />
                            {t('learning_hub.open_document_btn', '打开并阅读文档')}
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

const VideoPlayerModal = ({ rec, disableSeek, onClose, onEnded }: any) => {
    const { t } = useTranslation();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const lastTimeRef = React.useRef(0);

    const handleTimeUpdate = () => {
        if (disableSeek && videoRef.current) {
            if (videoRef.current.currentTime > lastTimeRef.current + 1.5) {
                videoRef.current.currentTime = lastTimeRef.current;
            } else {
                lastTimeRef.current = videoRef.current.currentTime;
            }
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
            {/* Modal Container */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 max-h-[90vh] relative">
                {/* Modal Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-desert-gold/10 text-yellow-800 border border-desert-gold/20 px-2 py-0.5 rounded-full font-bold">
                            🎥 {rec.categoryName || t('common.uncategorized')}
                        </span>
                        {rec.displayId && <span className="text-desert-gold text-xs font-extrabold">[{rec.displayId}]</span>}
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-700 outline-none"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Video Playback viewport */}
                <div className="bg-black flex-1 flex items-center justify-center relative overflow-hidden min-h-[300px] md:min-h-[400px]">
                    <video
                        ref={videoRef}
                        src={rec.audioUrl}
                        className="w-full max-h-[60vh] object-contain"
                        controls
                        autoPlay
                        controlsList={disableSeek ? "nodownload nofullscreen noremoteplayback" : "nodownload"}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={() => {
                            onEnded(videoRef.current?.duration || 0);
                        }}
                        preload="metadata"
                    />
                </div>

                {/* Details view */}
                <div className="p-6 bg-white overflow-y-auto">
                    <h3 className="text-lg font-extrabold text-arabian-night mb-2">
                        {rec.title}
                    </h3>
                    
                    {rec.lecturerName && (
                        <div className="flex items-center gap-1.5 text-sm font-bold text-desert-gold mb-3">
                            <User className="h-4 w-4" />
                            <span>{rec.lecturerName}</span>
                        </div>
                    )}
                    
                    <p className="text-sm text-arabian-night/70 leading-relaxed border-t border-gray-100 pt-3">
                        {rec.description}
                    </p>
                </div>
            </div>
        </div>
    );
};

const SharePosterModal = ({ rec, onClose }: any) => {
    const { t } = useTranslation();
    const posterRef = React.useRef<HTMLDivElement>(null);
    const [isCopying, setIsCopying] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isCopyingImage, setIsCopyingImage] = useState(false);

    const [avatarDataUrl, setAvatarDataUrl] = useState<string>('');
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [loadingResources, setLoadingResources] = useState(true);

    const shareUrl = `${window.location.origin}${window.location.pathname}?recordingId=${rec.id}`;

    const handleCopyLink = async () => {
        setIsCopying(true);
        try {
            await navigator.clipboard.writeText(shareUrl);
            alert(t('learning_hub.copy_link_success', '链接已成功复制到剪贴板！'));
        } catch (err) {
            console.error('Failed to copy', err);
        } finally {
            setIsCopying(false);
        }
    };

    const handleDownloadPoster = async () => {
        if (!posterRef.current) return;
        setIsDownloading(true);
        try {
            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(posterRef.current, {
                quality: 0.95,
                pixelRatio: 2,
                cacheBust: true,
            });
            const link = document.createElement('a');
            link.download = `ME_Share_Poster_${rec.displayId || 'Course'}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("Error generating poster image", error);
            alert(t('learning_hub.download_poster_fail', '海报生成失败，请重试。'));
        } finally {
            setIsDownloading(false);
        }
    };

    const handleCopyPoster = async () => {
        if (!posterRef.current) return;
        setIsCopyingImage(true);
        try {
            const { toBlob } = await import('html-to-image');
            const blob = await toBlob(posterRef.current, {
                quality: 0.95,
                pixelRatio: 2,
                cacheBust: true,
            });
            if (blob) {
                await navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob })
                ]);
                alert(t('learning_hub.copy_poster_success', '海报图片已成功复制到剪贴板！'));
            }
        } catch (error) {
            console.error("Error copying poster image", error);
            alert(t('learning_hub.copy_poster_fail', '复制海报失败，请直接下载海报。'));
        } finally {
            setIsCopyingImage(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const fetchResources = async () => {
            if (isMounted) setLoadingResources(true);
            
            // 1. Generate QR Code locally as a Base64 Data URL (CORS-free, 100% resilient)
            try {
                const QRCode = (await import('qrcode')).default;
                const base64 = await QRCode.toDataURL(shareUrl, {
                    width: 150,
                    margin: 1,
                    color: {
                        dark: '#000000',
                        light: '#ffffff',
                    }
                });
                if (isMounted) setQrDataUrl(base64);
            } catch (e) {
                console.error("Failed to generate local QR code:", e);
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`;
                if (isMounted) setQrDataUrl(qrUrl);
            }

            // 2. Fetch Avatar and convert to Base64 (CORS proxy fallback chain)
            if (rec.avatarUrl) {
                try {
                    // Try fetching through stable weserv.nl CORS proxy first to bypass Firebase Storage CORS block
                    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(rec.avatarUrl)}`;
                    const res = await fetch(proxyUrl);
                    if (!res.ok) throw new Error('Proxy fetch failed');
                    const blob = await res.blob();
                    const reader = new FileReader();
                    const p = new Promise<string>((resolve) => {
                        reader.onloadend = () => resolve(reader.result as string);
                    });
                    reader.readAsDataURL(blob);
                    const base64 = await p;
                    if (isMounted) setAvatarDataUrl(base64);
                } catch (e) {
                    console.warn("Failed to fetch avatar via proxy, trying direct fetch:", e);
                    try {
                        const res = await fetch(rec.avatarUrl, { mode: 'cors' });
                        if (!res.ok) throw new Error('Direct fetch failed');
                        const blob = await res.blob();
                        const reader = new FileReader();
                        const p = new Promise<string>((resolve) => {
                            reader.onloadend = () => resolve(reader.result as string);
                        });
                        reader.readAsDataURL(blob);
                        const base64 = await p;
                        if (isMounted) setAvatarDataUrl(base64);
                    } catch (err) {
                        console.error("All avatar fetches failed due to CORS or network:", err);
                        if (isMounted) setAvatarDataUrl('');
                    }
                }
            } else {
                if (isMounted) setAvatarDataUrl('');
            }
            
            if (isMounted) setLoadingResources(false);
        };

        fetchResources();
        return () => {
            isMounted = false;
        };
    }, [rec.avatarUrl, shareUrl]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
            {/* Modal Container */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300 max-h-[90vh] relative z-10">
                
                {/* Left Side: Poster Design Canvas */}
                <div className="bg-gray-100 p-8 flex items-center justify-center md:border-r border-gray-100 overflow-y-auto max-h-[50vh] md:max-h-none flex-1">
                    {/* The Poster DOM element target */}
                    <div 
                        ref={posterRef}
                        className="w-[320px] h-[480px] bg-gradient-to-br from-[#064e3b] via-[#022c22] to-[#0f172a] border border-desert-gold/30 rounded-2xl p-6 flex flex-col relative shadow-xl shrink-0 text-white overflow-hidden select-none font-sans"
                    >
                        {/* Shimmer loading overlay */}
                        {loadingResources && (
                            <div className="absolute inset-0 bg-black/45 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-pulse">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-desert-gold mb-2"></div>
                                <span className="text-[10px] text-desert-gold font-bold tracking-widest uppercase">
                                    {t('learning_hub.preparing_poster', '正在生成海报...')}
                                </span>
                            </div>
                        )}

                        {/* Golden Decorative Background Light */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-desert-gold/15 to-transparent rounded-bl-full pointer-events-none blur-xl"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-light-teal/20 to-transparent rounded-tr-full pointer-events-none blur-xl"></div>

                        {/* Top Header Branding */}
                        <div className="text-center border-b border-white/10 pb-3 relative z-10">
                            <h2 className="text-lg font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-desert-gold to-yellow-500 flex items-center justify-center gap-1">
                                🏆 ME CLOUD ACADEMY
                            </h2>
                            <span className="bg-desert-gold/15 text-desert-gold border border-desert-gold/30 text-[9px] px-2.5 py-0.5 rounded-full font-black tracking-wider uppercase inline-block mt-1">
                                {t('learning_hub.poster_badge', '精品销售实战录音')}
                            </span>
                        </div>

                        {/* Main Lecturer & Material Info */}
                        <div className="flex-1 flex flex-col justify-center items-center text-center mt-3 relative z-10">
                            {/* Lecturer Avatar */}
                            <div className="w-16 h-16 rounded-full border-3 border-white shadow-md overflow-hidden bg-white/10 flex items-center justify-center mb-2.5">
                                {avatarDataUrl ? (
                                    <img src={avatarDataUrl} alt="Lecturer" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-desert-gold to-yellow-600 flex items-center justify-center text-white text-xl font-bold">
                                        {rec.lecturerName ? rec.lecturerName.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                )}
                            </div>

                            {/* Lecturer Name */}
                            {rec.lecturerName && (
                                <div className="text-desert-gold font-bold text-xs flex items-center gap-1.5 mb-1 px-3 bg-white/5 py-1 rounded-full border border-white/5">
                                    <span>👤</span> {rec.lecturerName}
                                </div>
                            )}

                            {/* Course Display ID & Title */}
                            <div className="mt-1">
                                {rec.displayId && (
                                    <span className="text-desert-gold/90 text-xs font-black tracking-wide bg-desert-gold/10 border border-desert-gold/20 px-2 py-0.5 rounded-md">
                                        [{rec.displayId}]
                                    </span>
                                )}
                                <h3 className="text-white text-base font-black leading-snug tracking-tight mt-2 line-clamp-2 px-2">
                                    {rec.title}
                                </h3>
                            </div>

                            {/* Short Description */}
                            <p className="text-white/60 text-[11px] leading-relaxed mt-2.5 px-4 line-clamp-2 italic">
                                {rec.description || t('learning_hub.poster_default_desc', '优秀录音复盘，助推专业成长！')}
                            </p>
                        </div>

                        {/* Footer QR Block */}
                        <div className="border-t border-white/10 pt-3.5 mt-auto w-full flex items-center justify-between relative z-10">
                            <div className="flex-1 min-w-0 pr-2">
                                <h4 className="text-[11px] font-black text-desert-gold tracking-wide">
                                    {t('learning_hub.poster_branding', 'ME 云学堂 · 荣誉出品')}
                                </h4>
                                <p className="text-[9px] text-white/40 mt-0.5 leading-snug">
                                    {t('learning_hub.scan_to_learn', '扫描二维码或使用链接立即学习')}
                                </p>
                            </div>
                            <div className="w-16 h-16 bg-white p-1 rounded-xl shadow-lg flex items-center justify-center overflow-hidden shrink-0 border border-white/20">
                                {qrDataUrl ? (
                                    <img 
                                        src={qrDataUrl} 
                                        alt="QR Code" 
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center"></div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Options and Actions */}
                <div className="p-8 flex-1 flex flex-col justify-between max-h-[50vh] md:max-h-none overflow-y-auto">
                    {/* Header */}
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-extrabold text-deep-teal mb-1">
                                    {t('learning_hub.share_poster_title', '生成分享海报')}
                                </h3>
                                <p className="text-xs text-arabian-night/50 font-bold">
                                    {t('learning_hub.share_poster_desc', '生成高清晰度分享海报，并将专属直达链接发送给您的销售团队。')}
                                </p>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-700 outline-none shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Link Display Box */}
                        <div className="bg-gray-50 border border-gray-200/60 rounded-2xl p-4 mt-4">
                            <h4 className="text-xs font-extrabold text-deep-teal mb-2">
                                🔗 {t('learning_hub.exclusive_link', '专属学习链接')}
                            </h4>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    readOnly
                                    value={shareUrl}
                                    className="flex-1 bg-white border border-gray-200/80 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-arabian-night/70 select-all"
                                />
                                <button
                                    onClick={handleCopyLink}
                                    className="bg-deep-teal text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-teal-700 hover:shadow-md hover:shadow-teal-900/10 active:scale-95 transition-all shrink-0 cursor-pointer"
                                >
                                    {isCopying ? '...' : t('learning_hub.copy_link', '复制')}
                                </button>
                            </div>
                        </div>

                        {/* Share Synergy Tip Banner */}
                        <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3 items-start select-none">
                            <span className="text-amber-600 text-sm leading-none mt-0.5">💡</span>
                            <div className="flex-1">
                                <h5 className="text-xs font-black text-amber-700 mb-1">
                                    {t('learning_hub.share_synergy_tip_title', '如何完美分享给团队？')}
                                </h5>
                                <p className="text-[11px] text-amber-900/70 font-medium leading-relaxed">
                                    {t('learning_hub.share_synergy_tip_desc', '复制直达链接后，点击“复制海报图片”按钮。在微信/工作群聊天框中，先粘贴发送链接，再直接粘贴发送海报图片，即可完美呈现！')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-6 flex flex-col gap-2.5">
                        <button
                            onClick={handleDownloadPoster}
                            disabled={isDownloading || loadingResources}
                            className="bg-gradient-to-r from-desert-gold to-yellow-600 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg shadow-yellow-600/10 hover:shadow-yellow-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isDownloading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : '💾'}
                            {loadingResources ? t('learning_hub.preparing_poster', '正在生成海报...') : t('learning_hub.download_poster', '下载分享海报')}
                        </button>

                        <button
                            onClick={handleCopyPoster}
                            disabled={isCopyingImage || loadingResources}
                            className="bg-deep-teal hover:bg-teal-700 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg shadow-teal-700/10 hover:shadow-teal-700/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isCopyingImage ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : '✨'}
                            {loadingResources ? t('learning_hub.preparing_poster', '正在生成海报...') : t('learning_hub.copy_poster', '复制海报图片')}
                        </button>

                        <button
                            onClick={onClose}
                            className="bg-gray-100 hover:bg-gray-200 text-arabian-night/80 font-bold text-sm py-3 rounded-2xl transition-all cursor-pointer text-center"
                        >
                            {t('common.cancel', '取消')}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default function LearningHub() {
    const { t } = useTranslation();
    const { user, profile } = useAuth();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeTab, setActiveTab] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [sortType, setSortType] = useState<'latest' | 'popular'>('latest');
    const [businessType, setBusinessType] = useState<'kid' | 'adult' | 'ss'>('kid');
    const [displayCount, setDisplayCount] = useState(12);
    
    const [searchParams, setSearchParams] = useSearchParams();
    const taskId = searchParams.get('taskId');
    const targetRecordingId = searchParams.get('recordingId');
    const [taskRecordingIds, setTaskRecordingIds] = useState<string[]>([]);
    const [taskTitle, setTaskTitle] = useState<string>('');
    const [completedAudioIds, setCompletedAudioIds] = useState<string[]>([]);
    const [reflections, setReflections] = useState<Record<string, string>>({});
    const [isSubmittingTask, setIsSubmittingTask] = useState(false);
    const [isTaskCompleted, setIsTaskCompleted] = useState(false);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [selectedLecturer, setSelectedLecturer] = useState<string>('');
    const [showAllLecturers, setShowAllLecturers] = useState(false);
    
    // Leaderboard state
    const [allFavoritesCount, setAllFavoritesCount] = useState<Record<string, number>>({});
    const [leaderboardTab, setLeaderboardTab] = useState<'favorites' | 'likes'>('favorites');
    
    // Video Modal States
    const [activeVideoRecording, setActiveVideoRecording] = useState<Recording | null>(null);
    const [activeVideoDisableSeek, setActiveVideoDisableSeek] = useState(false);

    // Share Poster Modal State
    const [shareRecording, setShareRecording] = useState<Recording | null>(null);

    // Suggestions Autocomplete States
    const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
    const searchRef = React.useRef<HTMLDivElement>(null);

    // Filter recordings for suggestions (scoped by active businessType)
    const scopedRecordingsForSuggestions = React.useMemo(() => {
        return recordings.filter(rec => (rec.businessType || 'kid') === businessType);
    }, [recordings, businessType]);

    // Unique lecturer names matching the query
    const matchingLecturers = React.useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase().trim();
        const lecturers = Array.from(new Set(scopedRecordingsForSuggestions.map(rec => rec.lecturerName).filter(Boolean))) as string[];
        return lecturers
            .filter(name => name.toLowerCase().includes(query))
            .slice(0, 5);
    }, [scopedRecordingsForSuggestions, searchQuery]);

    // Recordings (titles) matching the query
    const matchingTitles = React.useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase().trim();
        return scopedRecordingsForSuggestions
            .filter(rec => 
                rec.title.toLowerCase().includes(query) ||
                (rec.displayId && rec.displayId.toLowerCase().includes(query))
            )
            .slice(0, 5);
    }, [scopedRecordingsForSuggestions, searchQuery]);

    const highlightMatch = (text: string, query: string) => {
        if (!query.trim()) return <span>{text}</span>;
        const index = text.toLowerCase().indexOf(query.toLowerCase().trim());
        if (index === -1) return <span>{text}</span>;
        
        const before = text.substring(0, index);
        const match = text.substring(index, index + query.trim().length);
        const after = text.substring(index + query.trim().length);
        
        return (
            <span>
                {before}
                <span className="text-desert-gold font-extrabold">{match}</span>
                {after}
            </span>
        );
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (profile?.dep === 'SS') {
            setBusinessType('ss');
        } else {
            setBusinessType('kid');
        }
        setActiveTab('all');
        setSelectedLecturer('');
    }, [profile]);

    useEffect(() => {
        if (taskId && user) {
            const fetchTaskInfo = async () => {
                try {
                    const taskDoc = await getDoc(doc(db, 'learning_tasks', taskId));
                    if (taskDoc.exists()) {
                        const data = taskDoc.data();
                        setTaskRecordingIds(data.recordingIds || []);
                        setTaskTitle(data.title || '学习任务');
                        
                        const myAssigneeData = data.assignees?.[user.uid];
                        if (myAssigneeData) {
                            if (myAssigneeData.reflections) {
                                setReflections(myAssigneeData.reflections);
                            }
                            if (myAssigneeData.status === 'completed') {
                                setCompletedAudioIds(data.recordingIds || []);
                                setIsTaskCompleted(true);
                            } else {
                                setIsTaskCompleted(false);
                            }
                        } else {
                            setIsTaskCompleted(false);
                        }
                    }
                } catch (error) {
                    console.error("Error fetching task", error);
                }
            };
            fetchTaskInfo();
        } else {
            setTaskRecordingIds([]);
            setTaskTitle('');
            setReflections({});
            setIsTaskCompleted(false);
        }
    }, [taskId, user]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Categories
                const catSnapshot = await getDocs(query(collection(db, 'categories'), orderBy('createdAt', 'desc')));
                const catData: Category[] = [];
                catSnapshot.forEach(doc => {
                    const docData = doc.data();
                    catData.push({ 
                        id: doc.id, 
                        name: docData.name,
                        businessType: docData.businessType || 'kid'
                    });
                });
                setCategories(catData);

                // Fetch Recordings
                const q = query(collection(db, 'recordings'), orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);
                const recData: Recording[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    recData.push({ 
                        id: doc.id, 
                        ...data,
                        playCount: data.playCount || 0
                    } as Recording);
                });
                setRecordings(recData);

                // Fetch All Favorites globally to calculate leaderboard
                const allFavSnapshot = await getDocs(collection(db, 'user_favorites'));
                const favCounts: Record<string, number> = {};
                allFavSnapshot.forEach(doc => {
                    const ids = doc.data().recordingIds || [];
                    ids.forEach((id: string) => {
                        favCounts[id] = (favCounts[id] || 0) + 1;
                    });
                });
                setAllFavoritesCount(favCounts);

                // Fetch current User's Favorites
                if (user) {
                    const favDoc = await getDoc(doc(db, 'user_favorites', user.uid));
                    if (favDoc.exists()) {
                        setFavorites(favDoc.data().recordingIds || []);
                    }
                }
            } catch (error) {
                console.error("Error fetching data: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const handleToggleLike = async (recId: string, currentLikes: string[] = []) => {
        if (!user) return;

        const isLiked = currentLikes.includes(user.uid);
        const recordingRef = doc(db, 'recordings', recId);
        
        // Optimistic UI update
        setRecordings(prev => prev.map(rec => {
            if (rec.id === recId) {
                const newLikes = isLiked 
                    ? (rec.likes || []).filter(uid => uid !== user.uid)
                    : [...(rec.likes || []), user.uid];
                return { ...rec, likes: newLikes };
            }
            return rec;
        }));

        try {
            await updateDoc(recordingRef, {
                likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
            });
        } catch (error) {
            console.error("Error toggling like:", error);
        }
    };

    const handleToggleFavorite = async (recId: string) => {
        if (!user) return;
        const isFav = favorites.includes(recId);
        const newFavs = isFav ? favorites.filter(id => id !== recId) : [...favorites, recId];
        setFavorites(newFavs);

        try {
            await setDoc(doc(db, 'user_favorites', user.uid), {
                recordingIds: isFav ? arrayRemove(recId) : arrayUnion(recId)
            }, { merge: true });
        } catch (error) {
            console.error("Error toggling favorite", error);
            setFavorites(favorites); // revert
        }
    };

    const handleAudioEnded = async (rec: Recording, durationSeconds: number) => {
        if (!user) return;
        
        // Mark that user has completed this audio
        setCompletedAudioIds(prev => prev.includes(rec.id) ? prev : [...prev, rec.id]);

        try {
            await addDoc(collection(db, 'learning_history'), {
                userId: user.uid,
                recordingId: rec.id,
                recordingTitle: rec.title,
                lecturerName: rec.lecturerName || '',
                durationSeconds: isNaN(durationSeconds) ? 0 : durationSeconds,
                listenedAt: serverTimestamp()
            });

            // Increment playCount
            const recRef = doc(db, 'recordings', rec.id);
            await updateDoc(recRef, {
                playCount: increment(1)
            });

            // Optimistic UI update for play count
            setRecordings(prev => prev.map(r => r.id === rec.id ? { ...r, playCount: (r.playCount || 0) + 1 } : r));

        } catch (error) {
            console.error("Error logging learning history", error);
        }
    };

    const validTaskRecordingIds = taskRecordingIds.filter(id => recordings.some(r => r.id === id));

    const canSubmit = taskId && 
        validTaskRecordingIds.length > 0 &&
        validTaskRecordingIds.every(id => completedAudioIds.includes(id) && (reflections[id]?.length || 0) >= 100);

    const handleSubmitTask = async () => {
        if (!user || !taskId || !canSubmit) return;
        
        setIsSubmittingTask(true);
        try {
            const taskRef = doc(db, 'learning_tasks', taskId);
            await updateDoc(taskRef, {
                [`assignees.${user.uid}.status`]: 'completed',
                [`assignees.${user.uid}.completedAt`]: serverTimestamp(),
                [`assignees.${user.uid}.reflections`]: reflections
            });
            alert(t('learning_hub.submit_success'));
            setSearchParams({}); // Go back to normal hub
        } catch (error) {
            console.error("Error submitting task", error);
            alert(t('learning_hub.submit_fail'));
        } finally {
            setIsSubmittingTask(false);
        }
    };

    // Filter recordings based on active tab and search query (excluding lecturer filter for top list calculation)
    const categoryFilteredRecordings = recordings.filter(rec => {
        if (taskId && taskRecordingIds.length > 0) {
            return taskRecordingIds.includes(rec.id);
        }
        if (targetRecordingId) {
            return rec.id === targetRecordingId;
        }
        
        // Filter by businessType (default old recordings to 'kid' as per user request)
        if ((rec.businessType || 'kid') !== businessType) {
            return false;
        }

        const matchesTab = activeTab === 'all' || rec.categoryId === activeTab;
        const matchesSearch = searchQuery === '' || 
            (rec.lecturerName && rec.lecturerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
            rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (rec.displayId && rec.displayId.toLowerCase().includes(searchQuery.toLowerCase())) ||
            rec.id.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesSearch;
    });

    // Final filtered list including the selected lecturer
    const filteredRecordings = categoryFilteredRecordings.filter(rec => {
        return selectedLecturer === '' || rec.lecturerName === selectedLecturer;
    });

    // Derive Top Lecturers from categoryFilteredRecordings
    const lecturerCounts = categoryFilteredRecordings.reduce((acc, rec) => {
        if (rec.lecturerName) {
            acc[rec.lecturerName] = (acc[rec.lecturerName] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);
    const sortedLecturers = Object.entries(lecturerCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

    const lecturerAvatars = categoryFilteredRecordings.reduce((acc, rec) => {
        if (rec.lecturerName && rec.avatarUrl && !acc[rec.lecturerName]) {
            acc[rec.lecturerName] = rec.avatarUrl;
        }
        return acc;
    }, {} as Record<string, string>);

    // Sort the filtered recordings based on sortType
    const sortedRecordings = [...filteredRecordings].sort((a, b) => {
        if (sortType === 'latest') {
            return (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0);
        } else {
            return (b.playCount || 0) - (a.playCount || 0);
        }
    });

    // Calculate display slice
    const displayedRecordings = sortedRecordings.slice(0, displayCount);

    // Calculate Leaderboard (Scoped by selected businessType)
    const displayTopFavorited = recordings
        .filter(rec => (rec.businessType || 'kid') === businessType)
        .sort((a, b) => {
            const countA = allFavoritesCount[a.id] || 0;
            const countB = allFavoritesCount[b.id] || 0;
            if (countB === countA) return (b.playCount || 0) - (a.playCount || 0);
            return countB - countA;
        })
        .slice(0, 10);
    
    const displayTopLiked = recordings
        .filter(rec => (rec.businessType || 'kid') === businessType)
        .sort((a, b) => {
            const countA = a.likes?.length || 0;
            const countB = b.likes?.length || 0;
            if (countB === countA) return (b.playCount || 0) - (a.playCount || 0);
            return countB - countA;
        })
        .slice(0, 10);

    // Leaderboard should only show on the main tab without active searches
    const showLeaderboard = activeTab === 'all' && !searchQuery && !taskId && !targetRecordingId;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12 overflow-x-hidden">
            {/* Control Center Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_40px_rgb(0,0,0,0.04)] border border-white p-6 sm:p-8 md:p-10 relative overflow-hidden">
                {/* Premium Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-desert-gold/10 via-teal-500/5 to-transparent rounded-full -translate-y-1/3 translate-x-1/4 pointer-events-none blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-deep-teal/5 to-transparent rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none blur-2xl"></div>
                
                <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 relative z-30">
                    <div>
                        {taskId ? (
                            <>
                                <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-deep-teal to-teal-700">{t('learning_hub.task_exclusive')}</h2>
                                <p className="text-arabian-night/60 mt-2 font-medium">{t('learning_hub.task_need_listen')} <span className="font-bold text-arabian-night">{taskTitle}</span></p>
                                <button onClick={() => setSearchParams({})} className="text-sm font-bold text-desert-gold mt-3 hover:text-yellow-600 transition-colors flex items-center gap-1 group">
                                    <span className="group-hover:-translate-x-1 transition-transform">←</span> {t('learning_hub.back_to_courses')}
                                </button>
                            </>
                        ) : targetRecordingId ? (
                            <>
                                <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-deep-teal to-teal-700">{t('learning_hub.shared_recording_title', '推荐学习素材')}</h2>
                                <p className="text-arabian-night/60 mt-2 font-medium">{t('learning_hub.shared_recording_desc', '正在播放为您推荐的精品销售实战录音，助推专业成长！')}</p>
                                <button onClick={() => setSearchParams({})} className="text-sm font-bold text-desert-gold mt-3 hover:text-yellow-600 transition-colors flex items-center gap-1 group">
                                    <span className="group-hover:-translate-x-1 transition-transform">←</span> {t('learning_hub.back_to_courses')}
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col">
                                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-deep-teal to-teal-800 tracking-tight">{t('learning_hub.explore')}</h2>
                                <div className="mt-3 flex items-center gap-3">
                                    <span className="w-10 h-1 bg-gradient-to-r from-desert-gold to-yellow-500 rounded-full shadow-sm"></span>
                                    <p className="text-base font-extrabold text-desert-gold tracking-wide italic bg-clip-text text-transparent bg-gradient-to-r from-desert-gold to-yellow-600">
                                        "{t('learning_hub.slogan')}"
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Actions Right Side */}
                    {!taskId && !targetRecordingId && (
                        <div className="flex flex-col gap-4 w-full md:w-auto items-end">
                            {/* Business Type Header for SS / Segmented Control for CC */}
                            {profile?.dep === 'SS' ? (
                                <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-8 py-3 rounded-full font-extrabold text-base shadow-lg shadow-orange-500/20 flex items-center gap-2 select-none self-start md:self-end animate-pulse">
                                    <span>✨</span>
                                    <span>{t('common.type_ss', 'SS 业务')}</span>
                                </div>
                            ) : profile?.role === 'super_admin' ? (
                                <div className="bg-white/80 backdrop-blur-xl p-1.5 rounded-full border border-gray-200/60 shadow-md flex items-center w-full md:w-auto self-start md:self-end">
                                    <button
                                        onClick={() => { setBusinessType('kid'); setActiveTab('all'); setSelectedLecturer(''); }}
                                        className={`flex-1 md:flex-none px-8 py-3 rounded-full font-extrabold text-base transition-all duration-300 ${
                                            businessType === 'kid' 
                                                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105' 
                                                : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/50'
                                        }`}
                                    >
                                        {t('common.type_kid', '青少业务')}
                                    </button>
                                    <button
                                        onClick={() => { setBusinessType('adult'); setActiveTab('all'); setSelectedLecturer(''); }}
                                        className={`flex-1 md:flex-none px-8 py-3 rounded-full font-extrabold text-base transition-all duration-300 ${
                                            businessType === 'adult' 
                                                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 scale-105' 
                                                : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/50'
                                        }`}
                                    >
                                        {t('common.type_adult', '成人业务')}
                                    </button>
                                    <button
                                        onClick={() => { setBusinessType('ss'); setActiveTab('all'); setSelectedLecturer(''); }}
                                        className={`flex-1 md:flex-none px-8 py-3 rounded-full font-extrabold text-base transition-all duration-300 ${
                                            businessType === 'ss' 
                                                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30 scale-105' 
                                                : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/50'
                                        }`}
                                    >
                                        {t('common.type_ss', 'SS 业务')}
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-white/80 backdrop-blur-xl p-1.5 rounded-full border border-gray-200/60 shadow-md flex items-center w-full md:w-auto self-start md:self-end">
                                    <button
                                        onClick={() => { setBusinessType('kid'); setActiveTab('all'); setSelectedLecturer(''); }}
                                        className={`flex-1 md:flex-none px-8 py-3 rounded-full font-extrabold text-base transition-all duration-300 ${
                                            businessType === 'kid' 
                                                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105' 
                                                : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/50'
                                        }`}
                                    >
                                        {t('common.type_kid', '青少业务')}
                                    </button>
                                    <button
                                        onClick={() => { setBusinessType('adult'); setActiveTab('all'); setSelectedLecturer(''); }}
                                        className={`flex-1 md:flex-none px-8 py-3 rounded-full font-extrabold text-base transition-all duration-300 ${
                                            businessType === 'adult' 
                                                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 scale-105' 
                                                : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/50'
                                        }`}
                                    >
                                        {t('common.type_adult', '成人业务')}
                                    </button>
                                </div>
                            )}

                            {/* Search Bar */}
                            <div ref={searchRef} className="relative w-full md:w-80 lg:w-[420px] shrink-0 group z-50">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-desert-gold">
                                    <Search className="h-5 w-5 text-arabian-night/40 group-focus-within:text-desert-gold transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder={t('learning_hub.search_placeholder')}
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    className="w-full pl-12 pr-5 py-3.5 border border-gray-200/80 rounded-full focus:ring-4 focus:ring-desert-gold/20 focus:border-desert-gold bg-white/60 backdrop-blur-md hover:bg-white transition-all shadow-[0_2px_10px_rgb(0,0,0,0.02)] text-sm font-semibold outline-none"
                                />

                                {/* Autocomplete Suggestions Panel */}
                                {showSuggestions && searchQuery.trim().length > 0 && (matchingLecturers.length > 0 || matchingTitles.length > 0) && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-gray-200/60 rounded-2xl shadow-xl py-3 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50 max-h-[380px] overflow-y-auto scrollbar-thin">
                                        {/* Lecturers Section */}
                                        {matchingLecturers.length > 0 && (
                                            <div className="mb-2">
                                                <div className="px-4 py-1.5 text-[11px] font-black text-deep-teal tracking-wider uppercase bg-gray-50 flex items-center gap-1.5 select-none">
                                                    <User className="w-3.5 h-3.5 text-desert-gold" />
                                                    <span>{t('learning_hub.suggested_lecturers', '推荐讲师')}</span>
                                                </div>
                                                <div className="mt-1">
                                                    {matchingLecturers.map((name) => (
                                                        <div
                                                            key={name}
                                                            onClick={() => {
                                                                setSearchQuery(name);
                                                                setShowSuggestions(false);
                                                            }}
                                                            className="px-5 py-2.5 hover:bg-gradient-to-r hover:from-desert-gold/10 hover:to-transparent hover:text-desert-gold cursor-pointer text-sm font-bold text-arabian-night transition-colors flex items-center gap-2"
                                                        >
                                                            <div className="w-6 h-6 rounded-full bg-desert-gold/10 flex items-center justify-center text-[10px] text-desert-gold font-extrabold shrink-0">
                                                                {name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="truncate">{highlightMatch(name, searchQuery)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Recordings Section */}
                                        {matchingTitles.length > 0 && (
                                            <div>
                                                <div className="px-4 py-1.5 text-[11px] font-black text-deep-teal tracking-wider uppercase bg-gray-50 flex items-center gap-1.5 select-none">
                                                    <PlayCircle className="w-3.5 h-3.5 text-desert-gold" />
                                                    <span>{t('learning_hub.suggested_courses', '推荐课程')}</span>
                                                </div>
                                                <div className="mt-1">
                                                    {matchingTitles.map((rec) => (
                                                        <div
                                                            key={rec.id}
                                                            onClick={() => {
                                                                setSearchQuery(rec.title);
                                                                setShowSuggestions(false);
                                                            }}
                                                            className="px-5 py-2.5 hover:bg-gradient-to-r hover:from-desert-gold/10 hover:to-transparent hover:text-desert-gold cursor-pointer text-sm font-bold text-arabian-night transition-colors flex items-center gap-2.5"
                                                        >
                                                            <div className="w-6 h-6 rounded-lg bg-deep-teal/5 flex items-center justify-center text-[10px] text-deep-teal font-extrabold shrink-0 border border-deep-teal/10">
                                                                🎬
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="truncate text-sm text-arabian-night font-bold">{highlightMatch(rec.title, searchQuery)}</div>
                                                                {rec.lecturerName && (
                                                                    <div className="text-[10px] text-arabian-night/50 truncate font-semibold mt-0.5">{rec.lecturerName}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </header>

                {taskId && (
                    <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/50 mt-8 relative z-10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 shadow-sm">
                        {isTaskCompleted ? (
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <Trophy className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-extrabold text-green-700 mb-1">{t('learning_hub.task_completed_title', '任务已完成')}</h3>
                                    <p className="text-sm font-medium text-arabian-night/60">{t('learning_hub.task_completed_desc', '您已经完成了该任务的所有学习内容并提交了心得。')}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <h3 className="text-lg font-extrabold text-deep-teal mb-1">{t('learning_hub.task_submission', '提交学习任务')}</h3>
                                    <p className="text-sm font-medium text-arabian-night/60">{t('learning_hub.task_submission_desc', '请听完所有分配的录音，并为每条录音撰写心得后即可提交任务。')}</p>
                                </div>
                                <button
                                    onClick={handleSubmitTask}
                                    disabled={!canSubmit || isSubmittingTask}
                                    className="bg-gradient-to-r from-deep-teal to-teal-700 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-teal-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shrink-0 border border-transparent disabled:hover:shadow-none hover:-translate-y-0.5"
                                >
                                    {isSubmittingTask ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    ) : null}
                                    {!canSubmit ? t('learning_hub.complete_all_requirements', '请完成所有要求') : t('learning_hub.submit_task')}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Category Tabs */}
                {!taskId && !targetRecordingId && (
                    <div className="mt-10 pt-6 border-t border-gray-100/60 relative z-10">
                        <div className="flex overflow-x-auto hide-scrollbar gap-3 py-2 pb-3">
                            <button
                                onClick={() => { setActiveTab('all'); setSelectedLecturer(''); }}
                                className={`px-6 py-2.5 rounded-full font-bold transition-all duration-300 whitespace-nowrap ${
                                    activeTab === 'all' 
                                        ? 'bg-gradient-to-r from-deep-teal to-teal-700 text-white shadow-lg shadow-teal-900/20 scale-105 border-transparent' 
                                        : 'bg-white/60 backdrop-blur-sm text-arabian-night/60 border border-gray-200/80 hover:border-desert-gold/50 hover:text-desert-gold hover:bg-white hover:-translate-y-0.5 hover:shadow-md'
                                }`}
                            >
                                {t('learning_hub.all_content')}
                            </button>
                            {categories.filter(cat => (cat.businessType || 'kid') === businessType).map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => { setActiveTab(cat.id); setSelectedLecturer(''); }}
                                    className={`px-6 py-2.5 rounded-full font-bold transition-all duration-300 whitespace-nowrap ${
                                        activeTab === cat.id 
                                            ? 'bg-gradient-to-r from-deep-teal to-teal-700 text-white shadow-lg shadow-teal-900/20 scale-105 border-transparent' 
                                            : 'bg-white/60 backdrop-blur-sm text-arabian-night/60 border border-gray-200/80 hover:border-desert-gold/50 hover:text-desert-gold hover:bg-white hover:-translate-y-0.5 hover:shadow-md'
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Lecturers Filter */}
                {!taskId && !targetRecordingId && sortedLecturers.length > 0 && (
                    <div className="mt-2 pt-5 border-t border-gray-100/60 relative z-10 animate-in fade-in duration-700">
                        <h4 className="text-sm font-extrabold text-deep-teal mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-desert-gold/10 flex items-center justify-center">
                                <User className="w-4 h-4 text-desert-gold" />
                            </span>
                            {t('learning_hub.popular_lecturers', 'Top Lecturers')}
                        </h4>
                        <div className="flex flex-wrap gap-3 py-2 pb-4">
                            {(showAllLecturers ? sortedLecturers : sortedLecturers.slice(0, 10)).map(lecturer => (
                                <button
                                    key={lecturer}
                                    onClick={() => setSelectedLecturer(selectedLecturer === lecturer ? '' : lecturer)}
                                    className={`flex items-center gap-2 pr-5 pl-1.5 py-1.5 rounded-full font-bold transition-all duration-300 group ${
                                        selectedLecturer === lecturer 
                                            ? 'bg-gradient-to-r from-desert-gold to-yellow-600 text-white scale-105 shadow-lg shadow-yellow-600/20 border-transparent ring-2 ring-yellow-400/30 ring-offset-1' 
                                            : 'bg-white/80 backdrop-blur-sm text-arabian-night/80 border border-gray-200/80 hover:border-desert-gold/50 hover:bg-white hover:-translate-y-1 hover:shadow-md'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-300 shadow-sm overflow-hidden border-2 ${
                                        selectedLecturer === lecturer ? 'border-white/40 bg-white/20 text-white' : 'border-transparent bg-gray-100 text-gray-500 group-hover:border-desert-gold/30 group-hover:bg-desert-gold/5'
                                    }`}>
                                        {lecturerAvatars[lecturer] ? (
                                            <img src={lecturerAvatars[lecturer]} alt={lecturer} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="font-extrabold">{lecturer.charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                    <span className="text-sm tracking-wide">{lecturer}</span>
                                    {selectedLecturer === lecturer && <span className="ml-1 text-[10px] bg-white/20 px-2 py-0.5 rounded-md backdrop-blur-sm shadow-sm">{lecturerCounts[lecturer]}</span>}
                                </button>
                            ))}

                            {sortedLecturers.length > 10 && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllLecturers(!showAllLecturers)}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-full font-extrabold text-sm transition-all duration-300 bg-white/80 backdrop-blur-sm text-desert-gold border border-gray-200/80 hover:border-desert-gold/50 hover:bg-white hover:-translate-y-1 hover:shadow-md cursor-pointer group shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                                >
                                    {showAllLecturers ? (
                                        <>
                                            <span>{t('learning_hub.see_less', 'See Less')}</span>
                                            <ChevronUp className="w-4 h-4 text-desert-gold transition-transform duration-300 group-hover:-translate-y-0.5" />
                                        </>
                                    ) : (
                                        <>
                                            <span>{t('learning_hub.see_more', 'See More')}</span>
                                            <span className="text-xs bg-desert-gold/15 text-desert-gold px-2 py-0.5 rounded-full border border-desert-gold/30 font-black tracking-wider">
                                                +{sortedLecturers.length - 10}
                                            </span>
                                            <ChevronDown className="w-4 h-4 text-desert-gold transition-transform duration-300 group-hover:translate-y-0.5" />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-desert-gold"></div>
                </div>
            ) : filteredRecordings.length === 0 && !taskId ? (
                <div className="text-center py-20 glass-panel rounded-2xl border border-white">
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <PlayCircle className="text-gray-400 h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-bold text-deep-teal mb-1">
                        {searchQuery ? t('learning_hub.no_result') : t('learning_hub.no_content')}
                    </h3>
                    <p className="text-arabian-night/50">
                        {searchQuery ? t('learning_hub.try_different_keyword') : t('learning_hub.ask_admin')}
                    </p>
                </div>
            ) : (
                <div className="pt-2">
                    {/* Main Grid & Leaderboard */}
                    <div className={showLeaderboard ? "flex flex-col xl:flex-row gap-8 items-start animate-in slide-in-from-bottom-4 duration-700" : "animate-in slide-in-from-bottom-4 duration-700"}>
                        <div className={showLeaderboard ? "flex-1 w-full min-w-0" : ""}>
                            {!taskId && (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 pb-2 border-b border-gray-100">
                                    <div className="flex items-center gap-3 pl-3 border-l-4 border-deep-teal">
                                        <h3 className="text-xl font-extrabold text-deep-teal">
                                            {activeTab === 'all' 
                                                ? t('learning_hub.discover_content', '发现内容')
                                                : categories.find(c => c.id === activeTab)?.name || t('learning_hub.discover_content', '发现内容')}
                                        </h3>
                                    </div>
                                    <div className="flex bg-gray-100/70 p-1.5 rounded-xl shrink-0 border border-gray-200/50 shadow-inner">
                                        <button 
                                            onClick={() => setSortType('latest')}
                                            className={`px-5 py-2 rounded-lg text-[15px] font-extrabold transition-all flex items-center gap-2 ${sortType === 'latest' ? 'bg-white text-deep-teal shadow-md border border-gray-200/50 scale-105' : 'text-arabian-night/60 hover:text-deep-teal hover:bg-white/50'}`}
                                        >
                                            <span className="text-lg">🆕</span> {t('common.sort_newest', '最新排序')}
                                        </button>
                                        <button 
                                            onClick={() => setSortType('popular')}
                                            className={`px-5 py-2 rounded-lg text-[15px] font-extrabold transition-all flex items-center gap-2 ${sortType === 'popular' ? 'bg-white text-desert-gold shadow-md border border-gray-200/50 scale-105' : 'text-arabian-night/60 hover:text-desert-gold hover:bg-white/50'}`}
                                        >
                                            <span className="text-lg">🔥</span> {t('common.sort_popular', '最热排行')}
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className={taskId ? "flex flex-col gap-6" : "grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6"}>
                                {taskId ? (
                                    validTaskRecordingIds.length === 0 ? (
                                        <div className="text-center py-10 text-arabian-night/50 font-bold col-span-full">{t('learning_hub.no_recordings_for_task', '该任务没有关联录音，或录音已被管理员删除')}</div>
                                    ) : (
                                        validTaskRecordingIds.map(recId => {
                                            const rec = recordings.find(r => r.id === recId);
                                            if (!rec) return null;
                                            return (
                                                <div key={recId} className="flex flex-col lg:flex-row gap-6 items-stretch bg-white/40 p-4 rounded-3xl border border-white shadow-sm col-span-full">
                                                    <div className="w-full lg:w-[340px] shrink-0">
                                                        <RecordingCard 
                                                            rec={rec} 
                                                            user={user} 
                                                            favorites={favorites}
                                                            handleToggleFavorite={handleToggleFavorite}
                                                            handleToggleLike={handleToggleLike}
                                                            handleAudioEnded={handleAudioEnded}
                                                            onPlayVideo={(videoRec: Recording, isSeekDisabled: boolean) => {
                                                                setActiveVideoRecording(videoRec);
                                                                setActiveVideoDisableSeek(isSeekDisabled);
                                                            }}
                                                            onShare={setShareRecording}
                                                            disableSeek={!isTaskCompleted}
                                                            className="w-full h-full"
                                                        />
                                                    </div>
                                                    <div className="flex-1 bg-white rounded-2xl p-6 shadow-sm border border-desert-gold/30 flex flex-col relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-desert-gold/10 to-transparent rounded-bl-full pointer-events-none"></div>
                                                        <h4 className="text-lg font-extrabold text-deep-teal mb-4 flex items-center justify-between relative z-10">
                                                            <span className="flex items-center gap-2">
                                                                <span className="w-1.5 h-5 bg-desert-gold rounded-full inline-block"></span>
                                                                {t('learning_hub.learning_reflection')}
                                                            </span>
                                                            {!isTaskCompleted && (
                                                                <span className={`text-xs px-3 py-1.5 rounded-full shadow-sm border ${completedAudioIds.includes(recId) ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                                    {completedAudioIds.includes(recId) ? t('learning_hub.listened', '已完整听完') : t('learning_hub.listen_first')}
                                                                </span>
                                                            )}
                                                        </h4>
                                                        <textarea
                                                            value={reflections[recId] || ''}
                                                            onChange={(e) => setReflections(prev => ({...prev, [recId]: e.target.value}))}
                                                            placeholder={isTaskCompleted ? '' : t('learning_hub.reflection_placeholder')}
                                                            readOnly={isTaskCompleted}
                                                            className={`flex-1 w-full p-5 border border-gray-100 rounded-xl outline-none resize-y min-h-[160px] text-base relative z-10 transition-all ${isTaskCompleted ? 'bg-transparent border-none text-arabian-night/80 italic shadow-inner' : 'focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-gray-50/50 hover:bg-white'}`}
                                                        />
                                                        {!isTaskCompleted && (
                                                            <div className="flex justify-end items-center mt-4 relative z-10">
                                                                <span className={`text-sm font-bold bg-white px-3 py-1 rounded-lg shadow-sm border ${
                                                                    (reflections[recId]?.length || 0) < 100 ? 'text-red-500 border-red-100' : 'text-green-500 border-green-100'
                                                                }`}>
                                                                    {t('learning_hub.current_words')} <span className="text-lg mx-1">{reflections[recId]?.length || 0}</span> {(reflections[recId]?.length || 0) < 100 ? t('learning_hub.words_needed', { count: 100 - (reflections[recId]?.length || 0) }) : ''}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )
                                ) : (
                                    displayedRecordings.map(rec => (
                                        <div key={rec.id} className="flex flex-col gap-3">
                                            <RecordingCard 
                                                rec={rec} 
                                                user={user} 
                                                favorites={favorites}
                                                handleToggleFavorite={handleToggleFavorite}
                                                handleToggleLike={handleToggleLike}
                                                handleAudioEnded={handleAudioEnded}
                                                onPlayVideo={(videoRec: Recording, isSeekDisabled: boolean) => {
                                                    setActiveVideoRecording(videoRec);
                                                    setActiveVideoDisableSeek(isSeekDisabled);
                                                }}
                                                onShare={setShareRecording}
                                                className="w-full h-full"
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            {displayCount < sortedRecordings.length && (
                                <div className="mt-8 flex justify-center">
                                    <button 
                                        onClick={() => setDisplayCount(prev => prev + 12)}
                                        className="bg-white border-2 border-desert-gold text-desert-gold hover:bg-desert-gold hover:text-white px-8 py-2.5 rounded-full font-bold transition-all shadow-sm"
                                    >
                                        {t('common.load_more', 'Load More')}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Leaderboard Widget */}
                        {showLeaderboard && (
                            <div className="w-full xl:w-[320px] 2xl:w-[360px] shrink-0 order-last xl:order-none">
                                <div className="glass-panel rounded-2xl border border-white p-5 sticky top-24">
                                    <h3 className="text-lg font-bold text-deep-teal mb-4 flex items-center gap-2">
                                        <Trophy className="w-5 h-5 text-desert-gold" />
                                        {t('learning_hub.leaderboard')}
                                    </h3>
                                    
                                    <div className="flex bg-gray-100/80 p-1 rounded-lg mb-4">
                                        <button 
                                            onClick={() => setLeaderboardTab('favorites')}
                                            className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${leaderboardTab === 'favorites' ? 'bg-white text-red-500 shadow-sm' : 'text-arabian-night/50 hover:text-arabian-night'}`}
                                        >
                                            {t('learning_hub.most_favorited')}
                                        </button>
                                        <button 
                                            onClick={() => setLeaderboardTab('likes')}
                                            className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${leaderboardTab === 'likes' ? 'bg-white text-desert-gold shadow-sm' : 'text-arabian-night/50 hover:text-arabian-night'}`}
                                        >
                                            {t('learning_hub.most_liked')}
                                        </button>
                                    </div>

                                    <div className="space-y-1">
                                        {(leaderboardTab === 'favorites' ? displayTopFavorited : displayTopLiked).map((rec, idx) => (
                                            <div 
                                                key={rec.id} 
                                                className="flex items-center gap-3 group cursor-pointer hover:bg-white p-2.5 rounded-xl transition-all border border-transparent hover:border-white/60 hover:shadow-sm" 
                                                onClick={() => setSearchParams({ recordingId: rec.id })}
                                            >
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${idx === 0 ? 'bg-yellow-100 text-yellow-600 shadow-sm' : idx === 1 ? 'bg-gray-200 text-gray-600 shadow-sm' : idx === 2 ? 'bg-orange-100 text-orange-600 shadow-sm' : 'bg-gray-50 text-gray-400'}`}>
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-arabian-night line-clamp-2 leading-tight group-hover:text-desert-gold transition-colors" title={rec.title}>
                                                        {rec.displayId && <span className="text-desert-gold mr-1 text-xs inline-block">[{rec.displayId}]</span>}
                                                        {rec.title}
                                                    </h4>
                                                    <div className="text-[10px] text-arabian-night/50 flex items-center gap-2 mt-0.5">
                                                        <span className="truncate">{rec.lecturerName || t('learning_hub.unknown_lecturer')}</span>
                                                        <span className="flex items-center gap-0.5 font-semibold">
                                                            {leaderboardTab === 'favorites' ? <Heart className="w-3 h-3 text-red-400 fill-red-400"/> : <Moon className="w-3 h-3 text-desert-gold fill-desert-gold"/>}
                                                            {leaderboardTab === 'favorites' ? (allFavoritesCount[rec.id] || 0) : (rec.likes?.length || 0)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button className="w-7 h-7 rounded-full bg-deep-teal/5 flex items-center justify-center text-deep-teal opacity-0 group-hover:opacity-100 group-hover:bg-deep-teal/10 transition-all shrink-0">
                                                    <PlayCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {activeVideoRecording && (
                <VideoPlayerModal
                    rec={activeVideoRecording}
                    disableSeek={activeVideoDisableSeek}
                    onClose={() => setActiveVideoRecording(null)}
                    onEnded={(duration) => {
                        handleAudioEnded(activeVideoRecording, duration);
                    }}
                />
            )}
            {shareRecording && (
                <SharePosterModal
                    rec={shareRecording}
                    onClose={() => setShareRecording(null)}
                />
            )}
        </div>
    );
}
