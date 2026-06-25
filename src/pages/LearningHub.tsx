import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, getDoc, setDoc, increment, where, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { PlayCircle, Clock, User, Search, Moon, Heart, Headphones, Trophy, Play, X, ChevronDown, ChevronUp, Share2, FileText, BookOpen, Lock, LockOpen, Send, MessageSquare, ThumbsUp, Flag, Pin, Check, ChevronLeft, ChevronRight, Download, RefreshCw, Sparkles, Video as VideoIcon, Image as ImageIcon, ExternalLink, Eye, HelpCircle } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

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
    transcript?: string;
    transcriptStatus?: string;
    uploaderId?: string;
    uploaderCrmId?: string;
    attachments?: any[];
    isPinned?: boolean;
}

interface Category {
    id: string;
    name: string;
    businessType?: string;
}

interface Banner {
    id: string;
    imageUrl: string;
    title: string;
    categoryId: string;
    categoryName: string;
    ownerSm: string;
    ownerSmName: string;
    linkedTaskId?: string;
    linkedTaskTitle?: string;
    active: boolean;
}

const CustomAudioPlayer = ({ src, onEnded, onUnlock, disableSeek = false }: { src: string, onEnded: (duration: number, actualSec?: number) => void, onUnlock?: (duration: number) => void, disableSeek?: boolean }) => {
    const { t } = useTranslation();
    const audioRef = React.useRef<HTMLAudioElement>(null);
    const lastTimeRef = React.useRef(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [actualListenedSeconds, setActualListenedSeconds] = useState(0);
    const speeds = [0.75, 1, 1.5];

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const curr = audioRef.current.currentTime;
            const diff = curr - lastTimeRef.current;
            // Only accumulate when playing legitimately (skip check)
            if (isPlaying && diff > 0 && diff < 1.5) {
                setActualListenedSeconds(prev => {
                    const next = prev + diff;
                    const target = duration / 3;
                    if (target > 0 && prev < target && next >= target && onUnlock) {
                        // Trigger unlock!
                        setTimeout(() => onUnlock(duration), 0);
                    }
                    return next;
                });
            }
            lastTimeRef.current = curr;
            setCurrentTime(curr);
        }
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
        <div className="flex flex-col w-full bg-slate-50/70 dark:bg-slate-900/35 border border-slate-100/70 dark:border-slate-800/60 rounded-2xl p-2.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01),0_1px_3px_rgba(0,0,0,0.02)] select-none gap-0.5 my-1.5 animate-in fade-in duration-300">
            <audio 
                ref={audioRef} 
                src={src} 
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => {
                    setIsPlaying(false);
                    onEnded(duration, actualListenedSeconds);
                }}
                className="hidden"
            />
            <div className="flex items-center gap-2.5 w-full">
                <button 
                    onClick={togglePlay}
                    className="shrink-0 w-9 h-9 flex items-center justify-center bg-gradient-to-r from-deep-teal to-[#005f66] hover:from-[#005f66] hover:to-[#008f99] text-white rounded-full hover:shadow-[0_3px_10px_rgba(0,109,119,0.25)] hover:scale-105 active:scale-95 transition-all duration-300 shadow-sm focus:outline-none cursor-pointer border border-white/20"
                >
                    {isPlaying ? (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                        <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                </button>
                <div className="text-[10px] font-bold text-slate-400 shrink-0 w-8 text-right tracking-tight font-mono select-none">
                    {formatTime(currentTime)}
                </div>
                <input 
                    type="range" 
                    min="0" 
                    max={duration || 100} 
                    step="0.1"
                    value={currentTime} 
                    onChange={handleSeek}
                    className={`flex-1 h-1 bg-slate-200/80 dark:bg-slate-700/60 rounded-full appearance-none focus:outline-none ${disableSeek ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'cursor-pointer hover:bg-slate-300/80 transition-all'}`}
                    style={{ accentColor: '#d4af37' }}
                    readOnly={disableSeek}
                />
                <div className="text-[10px] font-bold text-slate-400 shrink-0 w-8 tracking-tight font-mono select-none">
                    {formatTime(duration)}
                </div>
                <button 
                    onClick={cycleSpeed}
                    title={t('common.playback_speed', 'Playback Speed')}
                    className="shrink-0 text-[10px] font-black text-amber-700 dark:text-amber-500 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100/90 border border-desert-gold/25 rounded-lg px-2 py-0.5 transition-all duration-200 focus:outline-none active:scale-90 cursor-pointer shadow-sm"
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
    onViewTranscript,
    onShare,
    disableSeek = false,
    className = "",
    isUnlocked = false,
    commentCount = 0,
    isLeader = false
}: any) => {
    const { t } = useTranslation();
    const { profile } = useAuth();
    const isSDLevel = profile?.role === 'sd' || profile?.role === 'super_admin';
    const isLiked = rec.likes?.includes(user?.uid || '');
    const isFav = favorites.includes(rec.id);
    const isVideo = isVideoUrl(rec.audioUrl);
    const isDoc = isDocUrl(rec.audioUrl) || 
                  rec.categoryName?.toLowerCase() === 'doc' || 
                  rec.categoryName === '文档' || 
                  rec.categoryName === 'ss文档' || 
                  rec.categoryName?.toLowerCase() === 'document';

    return (
        <div className={`rounded-[1.75rem] border overflow-hidden relative flex flex-col transition-all duration-500 ease-out group ${className} ${
            rec.businessType === 'leader'
                ? 'border-desert-gold/30 shadow-[0_12px_45px_rgba(203,161,53,0.15)] hover:shadow-[0_20px_55px_rgba(203,161,53,0.25)] bg-gradient-to-br from-teal-950 via-deep-teal/40 to-desert-gold/5 hover:-translate-y-1.5'
                : 'bg-white border-[#E6DFD3] hover:border-desert-gold/40 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_45px_rgba(139,92,26,0.06)] hover:-translate-y-1.5'
        }`}>
            {rec.isPinned && (
                <span className="absolute top-2.5 left-2.5 bg-gradient-to-r from-rose-500 to-red-600 text-white text-[9.5px] font-black tracking-wide px-2.5 py-0.5 rounded-full border border-rose-400/30 shadow-md flex items-center gap-1 z-20 select-none animate-in fade-in duration-300">
                    📌 {t('learning_hub.pinned', '置顶')}
                </span>
            )}
            {isDoc ? (
                /* Premium Document Cover with sandstone-to-gold gradient and floating glassmorphic shapes */
                <div 
                    onClick={() => onPlayVideo(rec, disableSeek)}
                    className="w-full h-28 bg-gradient-to-br from-[#F5EFEB] via-[#EADBCE] to-[#C5A059] relative flex items-center justify-center cursor-pointer overflow-hidden border-b border-[#E6DFD3] group/doc shrink-0 animate-in fade-in duration-500"
                >
                    <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml,%3Csvg width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h24v24H0z\' fill=\'none\'/%3E%3Cpath d=\'M12 2L2 22h20L12 2z\' fill=\'%23ffffff\' fill-opacity=\'0.1\'/%3E%3C/svg%3E')]"></div>
                    {/* Floating light streaks */}
                    <div className="absolute top-0 -left-1/4 w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover/doc:translate-x-[250%] transition-transform duration-1000 ease-out" />
                    <div className="absolute inset-0 bg-slate-900/10 group-hover/doc:bg-slate-900/30 transition-colors duration-300 z-10" />
                    
                    {/* Centered Glassmorphic Comments Button */}
                    <div className="flex flex-col items-center justify-center gap-2 z-20">
                        <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg transform group-hover/doc:scale-110 group-hover/doc:bg-white group-hover/doc:text-[#008f99] transition-all duration-500">
                            <MessageSquare className="w-5 h-5 text-white group-hover/doc:text-[#008f99] transition-colors duration-300" />
                        </div>
                        <span className="text-[10px] text-white font-extrabold tracking-wider bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 shadow-sm select-none">
                            {t('learning_hub.comments_btn', '参与互动交流与问答')}
                        </span>
                    </div>
                    
                    {/* Document Badge Tag */}
                    <span className="absolute top-2.5 right-2.5 bg-black/40 backdrop-blur-md text-white text-[9px] font-black tracking-wide px-2.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1 z-20 select-none">
                        📄 {t('learning_hub.doc_tag', '文档')}
                    </span>
                    {commentCount > 0 && (
                        <span className="absolute bottom-2.5 left-2.5 bg-black/40 backdrop-blur-md text-white text-[9px] font-black tracking-wide px-2.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1 z-20 select-none animate-pulse-ring">
                            💬 {commentCount}
                        </span>
                    )}
                </div>
            ) : isVideo ? (
                /* Premium Video Cover - Native first-frame rendering via HTML5 video metadata preload with glassmorphic pulse play button */
                <div 
                    onClick={() => onPlayVideo(rec, disableSeek)}
                    className="w-full aspect-video bg-gradient-to-br from-[#0f2027] via-[#203a43] to-[#2c5364] relative flex items-center justify-center cursor-pointer overflow-hidden border-b border-white/10 group/video shrink-0 animate-in fade-in duration-500"
                >
                    {/* Native First-Frame Video Thumbnail Preload Cover */}
                    <video 
                        src={rec.audioUrl} 
                        preload="metadata" 
                        className="absolute inset-0 w-full h-full object-cover z-0 opacity-40 group-hover/video:opacity-65 transition-opacity duration-500"
                        muted
                        playsInline
                    />
                    <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml,%3Csvg width=\'30\' height=\'30\' viewBox=\'0 0 30 30\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'15\' cy=\'15\' r=\'2\' fill=\'%23ffffff\' fill-opacity=\'0.2\'/%3E%3C/svg%3E')] z-10 pointer-events-none"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-slate-950/40 z-10 pointer-events-none" />
                    
                    {/* Elegant pulsating backdrop under play icon */}
                    <div className="absolute z-20 w-12 h-12 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 scale-100 opacity-0 group-hover/video:scale-125 group-hover/video:opacity-100 transition-all duration-700 animate-pulse-ring pointer-events-none" />
                    
                    {/* Centered Glassmorphic Play Button */}
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl transform group-hover/video:scale-110 group-hover/video:bg-desert-gold group-hover/video:border-transparent group-hover/video:shadow-[0_0_25px_rgba(212,175,55,0.45)] transition-all duration-500 z-20">
                        <Play className="w-5 h-5 text-white fill-white ml-0.5 group-hover/video:text-slate-950 group-hover/video:fill-slate-900 transition-colors" />
                    </div>
                    
                    {/* Video Badge Tag */}
                    <span className="absolute top-2.5 right-2.5 bg-black/40 backdrop-blur-md text-white text-[9px] font-black tracking-wide px-2.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1 z-20 select-none">
                        🎥 {t('learning_hub.video_tag', '视频')}
                    </span>
                    {commentCount > 0 && (
                        <span className="absolute bottom-2.5 left-2.5 bg-black/40 backdrop-blur-md text-white text-[9px] font-black tracking-wide px-2.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1 z-20 select-none animate-pulse-ring">
                            💬 {commentCount}
                        </span>
                    )}
                </div>
            ) : (
                /* Premium Audio Cover - Dark Metallic Mesh with glowing audio wave & headphone */
                <div 
                    onClick={() => onPlayVideo(rec, disableSeek)}
                    className="w-full h-28 bg-gradient-to-br from-slate-950 via-[#112226] to-[#0f2027] relative flex items-center justify-center cursor-pointer overflow-hidden border-b border-white/10 group/audio shrink-0 animate-in fade-in duration-500"
                >
                    <div className="absolute inset-0 opacity-15 bg-[url('data:image/svg+xml,%3Csvg width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h24v24H0z\' fill=\'none\'/%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'1\' fill=\'%23ffffff\'/%3E%3C/svg%3E')]"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-slate-950/40 z-10 pointer-events-none" />
                    
                    {/* Glowing Audio Waves and Headphones Icon */}
                    <div className="flex flex-col items-center justify-center gap-1.5 z-20 transition-transform duration-500 group-hover/audio:scale-105">
                        <div className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg transform group-hover/audio:bg-[#d4af37]/20 group-hover/audio:border-[#d4af37]/50 transition-all duration-500 relative">
                            <Headphones className="w-5 h-5 text-desert-gold" />
                            {/* Wave bar visualizer effect inside icon container */}
                            <div className="absolute -bottom-1 flex gap-0.5 justify-center h-2.5">
                                <span className="w-0.5 bg-[#d4af37] rounded-full animate-[bounce_0.8s_infinite] h-full" />
                                <span className="w-0.5 bg-[#d4af37] rounded-full animate-[bounce_0.5s_infinite_0.15s] h-1.5" />
                                <span className="w-0.5 bg-[#d4af37] rounded-full animate-[bounce_0.7s_infinite_0.3s] h-2" />
                            </div>
                        </div>
                        <span className="text-[9px] text-[#d4af37]/80 font-black tracking-widest bg-black/40 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white/5 shadow-inner mt-1">
                            AUDIO CASE
                        </span>
                    </div>

                    {/* Audio Badge Tag */}
                    <span className="absolute top-2.5 right-2.5 bg-black/40 backdrop-blur-md text-white text-[9px] font-black tracking-wide px-2.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1 z-20 select-none">
                        🎵 {t('learning_hub.audio_tag', '音频')}
                    </span>
                    {commentCount > 0 && (
                        <span className="absolute bottom-2.5 left-2.5 bg-black/40 backdrop-blur-md text-white text-[9px] font-black tracking-wide px-2.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1 z-20 select-none">
                            💬 {commentCount}
                        </span>
                    )}
                </div>
            )}

            {/* Card Content with Restored Avatar */}
            <div className="relative z-10 p-4 sm:p-5 flex flex-col flex-1 pt-2">
                {/* Circular Avatar & Category */}
                <div className="-mt-10 relative z-20 flex items-end justify-between px-1 mb-2.5 sm:mb-3.5">
                    <div className="w-13 h-13 rounded-full border-2 border-white shadow-md bg-white flex items-center justify-center overflow-hidden ring-2 ring-deep-teal/10 group-hover:ring-desert-gold/50 transition-all duration-500 select-none shrink-0 transform group-hover:scale-105">
                        {rec.avatarUrl ? (
                            <img src={rec.avatarUrl} alt="Instructor" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-desert-gold to-amber-600 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
                                <User className="h-6 w-6 text-white/95" />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[9.5px] bg-desert-gold/10 border border-desert-gold/25 text-[#a88216] px-2.5 py-0.5 rounded-full font-extrabold shadow-sm tracking-wider backdrop-blur-md transition-all duration-300 hover:bg-[#a88216] hover:text-white hover:border-transparent select-none">
                            {rec.categoryName || t('common.uncategorized')}
                        </span>
                        {rec.attachments && rec.attachments.length > 0 && (
                            <span className="text-[9.5px] bg-amber-500/10 text-amber-700 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-extrabold shadow-sm flex items-center gap-1 shrink-0 select-none backdrop-blur-md transition-all duration-300">
                                📊 {t('learning_hub.attachments_count', '含课件')} ({rec.attachments.length})
                            </span>
                        )}
                        {rec.transcript && (!isVideoUrl(rec.audioUrl) || isSDLevel) && (
                            <span 
                                onClick={(e) => {
                                    const isVideo = isVideoUrl(rec.audioUrl);
                                    const canView = isVideo ? isSDLevel : isLeader;
                                    if (canView) {
                                        e.stopPropagation();
                                        onViewTranscript && onViewTranscript(rec);
                                    }
                                }}
                                className={`text-[9.5px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-extrabold shadow-sm flex items-center gap-1.5 shrink-0 select-none backdrop-blur-md transition-all duration-300 ${
                                    (isVideoUrl(rec.audioUrl) ? isSDLevel : isLeader) ? 'cursor-pointer hover:bg-emerald-600 hover:text-white hover:border-transparent active:scale-95' : ''
                                }`}
                                title={(isVideoUrl(rec.audioUrl) ? isSDLevel : isLeader) ? t('learning_hub.click_to_view_direct', '点击直接查看阿语逐字稿') : ''}
                            >
                                <span className="relative flex h-1.5 w-1.5 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                <span>{t('recordings_manager.transcript_ready', '阿语逐字稿已就绪')}</span>
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="flex-1">
                    <h4 
                        onClick={() => onPlayVideo(rec, disableSeek)}
                        className={`font-black text-base mb-1.5 sm:mb-2 transition-all duration-300 line-clamp-1 cursor-pointer ${
                            rec.businessType === 'leader'
                                ? 'text-white group-hover:text-desert-gold'
                                : 'text-slate-800 group-hover:text-deep-teal'
                        }`}
                    >
                        {rec.displayId && <span className="bg-desert-gold/10 border border-desert-gold/25 text-[#b58c14] dark:text-desert-gold px-1.5 py-0.5 rounded text-[9.5px] font-black mr-2 uppercase shadow-sm select-none tracking-widest">[{rec.displayId}]</span>}
                        {rec.title}
                    </h4>
                    {rec.lecturerName && (
                        <div 
                            onClick={() => onPlayVideo(rec, disableSeek)}
                            className="flex items-center gap-1.5 text-[11.5px] font-black text-desert-gold hover:text-amber-600 mb-1.5 sm:mb-2 transition-colors duration-300 cursor-pointer hover:underline"
                        >
                            <User className="h-3.5 w-3.5 text-desert-gold shrink-0" />
                            <span>{rec.lecturerName}</span>
                        </div>
                    )}
                    <p className={`text-[12px] mb-2 sm:mb-4 line-clamp-2 leading-relaxed font-semibold ${
                        rec.businessType === 'leader' ? 'text-white/60' : 'text-slate-500'
                    }`}>
                        {rec.description}
                    </p>
                </div>

                <div className={`mt-auto pt-3 border-t ${
                    rec.businessType === 'leader' ? 'border-desert-gold/15' : 'border-slate-100'
                }`}>
                    <div className="flex justify-between items-center mb-2.5 sm:mb-4 text-[11px] font-bold text-deep-teal">
                        <div className="flex items-center gap-3.5">
                            <div className={`flex items-center gap-1 transition-colors cursor-default select-none ${
                                rec.businessType === 'leader' ? 'text-white/45' : 'text-slate-400 hover:text-slate-500'
                            }`}>
                                <Clock className="h-3.5 w-3.5 shrink-0" />
                                <span>{rec.createdAt?.toDate().toLocaleDateString() || t('common.just_now')}</span>
                            </div>
                            {rec.playCount !== undefined && (
                                <div className="flex items-center gap-1 text-desert-gold hover:text-amber-600 transition-colors cursor-default select-none">
                                    <Headphones className="h-3.5 w-3.5 shrink-0" />
                                    <span>{rec.playCount}{t('common.times')}</span>
                                </div>
                            )}
                            {commentCount > 0 && (
                                <div className={`flex items-center gap-1 transition-colors cursor-default font-black animate-in fade-in select-none ${
                                    rec.businessType === 'leader' ? 'text-white/80' : 'text-deep-teal/90 hover:text-deep-teal'
                                }`}>
                                    <MessageSquare className="h-3.5 w-3.5 text-[#008f99] shrink-0" />
                                    <span>{commentCount}{t('learning_hub.comments_count_label', '条讨论')}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2 select-none">
                            <button 
                                onClick={() => handleToggleFavorite(rec.id)}
                                className={`flex items-center justify-center transition-all duration-300 outline-none p-1.5 rounded-full shadow-sm hover:shadow hover:scale-110 active:scale-95 cursor-pointer ${
                                    rec.businessType === 'leader'
                                        ? isFav 
                                            ? 'bg-rose-500/20 border-rose-500/30 text-rose-400 border'
                                            : 'bg-teal-950/60 border-desert-gold/25 text-white/80 border hover:bg-rose-950/40 hover:border-rose-500/30'
                                        : isFav
                                            ? 'bg-rose-50 border border-rose-200/70 text-rose-600'
                                            : 'bg-white border border-slate-200 text-slate-400 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-500'
                                }`}
                                title={t('common.favorite', '收藏')}
                            >
                                <Heart className={`h-3.5 w-3.5 transition-all duration-300 ${isFav ? 'fill-rose-500 text-rose-500 scale-110' : 'text-current'}`} />
                            </button>
                            
                            <button 
                                onClick={() => handleToggleLike(rec.id, rec.likes)}
                                className={`flex items-center gap-1 transition-all duration-300 outline-none px-2.5 py-1 rounded-full border shadow-sm hover:shadow hover:scale-110 active:scale-95 cursor-pointer ${
                                    rec.businessType === 'leader'
                                        ? isLiked
                                            ? 'bg-amber-500/20 border-amber-500/30 text-desert-gold'
                                            : 'bg-teal-950/60 border-desert-gold/25 text-white/80 hover:bg-amber-950/40 hover:border-amber-500/30'
                                        : isLiked
                                            ? 'bg-amber-50 border border-amber-200/70 text-amber-600'
                                            : 'bg-white border border-slate-200 text-slate-400 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-500'
                                }`}
                            >
                                <Moon className={`h-3.5 w-3.5 transition-all duration-300 ${isLiked ? 'fill-desert-gold text-desert-gold scale-110' : 'text-current'}`} />
                                <span className={`${isLiked ? 'text-desert-gold font-black' : 'text-current font-bold'} text-[11px]`}>
                                    {rec.likes?.length || 0}
                                </span>
                            </button>
                            
                            <button 
                                onClick={() => onShare && onShare(rec)}
                                className={`flex items-center justify-center transition-all duration-300 outline-none p-1.5 rounded-full shadow-sm hover:shadow hover:scale-110 active:scale-95 cursor-pointer ${
                                    rec.businessType === 'leader'
                                        ? 'bg-teal-950/60 border-desert-gold/25 text-white/80 border hover:bg-cyan-950/40 hover:border-cyan-500/30'
                                        : 'bg-white border border-slate-200 text-slate-400 hover:bg-cyan-50 hover:border-cyan-200 hover:text-cyan-600'
                                }`}
                                title={t('common.share', '分享')}
                            >
                                <Share2 className="h-3.5 w-3.5 transition-all" />
                            </button>
                        </div>
                    </div>
                    
                    {!isVideo && !isDoc && (
                        <div className="flex flex-col gap-2 pt-1">
                            <CustomAudioPlayer 
                                src={rec.audioUrl} 
                                onEnded={(duration) => handleAudioEnded(rec, duration)} 
                                onUnlock={(dur) => handleAudioEnded(rec, dur)}
                                disableSeek={disableSeek}
                            />
                            
                            <div className="flex gap-2.5 mt-1.5 w-full">
                                <button 
                                    onClick={() => onPlayVideo(rec, disableSeek)}
                                    className={`flex-1 bg-gradient-to-r ${rec.businessType === 'leader' ? 'from-desert-gold to-yellow-600 hover:shadow-[0_4px_15px_rgba(212,175,55,0.35)]' : 'from-deep-teal to-teal-700 hover:shadow-[0_4px_12px_rgba(13,92,117,0.2)]'} hover:scale-[1.01] text-white text-[11px] font-black py-2.5 px-2 rounded-xl shadow-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-all cursor-pointer border border-white/10`}
                                >
                                    <MessageSquare className="w-3.5 h-3.5 text-desert-gold fill-desert-gold/20" />
                                    <span>{t('learning_hub.comments_btn', '参与互动交流与问答')}</span>
                                    {commentCount > 0 && (
                                        <span className="bg-desert-gold text-arabian-night text-[9px] font-extrabold px-1 rounded-full shadow-sm shrink-0">
                                            {commentCount}
                                        </span>
                                    )}
                                </button>
                                
                                {rec.transcript && (
                                    <button 
                                        onClick={(e) => {
                                            if (isLeader) {
                                                e.stopPropagation();
                                                onViewTranscript && onViewTranscript(rec);
                                            } else {
                                                onPlayVideo(rec, disableSeek);
                                            }
                                        }}
                                        className="flex-1 bg-white hover:bg-[#F8F5F0] border border-[#E6DFD3] hover:border-desert-gold/50 text-[#0D5C75] text-[11px] font-black py-2.5 px-2 rounded-xl flex items-center justify-center gap-1 active:scale-[0.98] transition-all duration-300 cursor-pointer shadow-sm"
                                    >
                                        <BookOpen className="w-3.5 h-3.5 text-desert-gold" />
                                        <span>{t('learning_hub.view_transcript_unlocked_btn', '查看阿语逐字稿')}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {isDoc && (
                        <div className="flex flex-col gap-2 pt-1">
                            <button 
                                onClick={() => onPlayVideo(rec, disableSeek)}
                                className={`w-full bg-gradient-to-r ${rec.businessType === 'leader' ? 'from-desert-gold to-yellow-600 hover:shadow-[0_4px_15px_rgba(212,175,55,0.35)]' : 'from-deep-teal to-teal-700 hover:shadow-[0_4px_12px_rgba(13,92,117,0.2)]'} hover:scale-[1.01] text-white text-xs font-black py-2.5 px-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer border border-white/10`}
                            >
                                <MessageSquare className="w-3.5 h-3.5 text-desert-gold fill-desert-gold/20" />
                                <span>{t('learning_hub.comments_btn', '参与互动交流与问答')}</span>
                                {commentCount > 0 && (
                                    <span className="bg-desert-gold text-arabian-night text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow-md shrink-0 ml-1.5">
                                        {commentCount}
                                    </span>
                                )}
                            </button>
                            <a
                                href={rec.audioUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full bg-white hover:bg-[#F8F5F0] border border-[#E6DFD3] hover:border-desert-gold/50 text-[#0D5C75] text-xs font-black py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer text-center shadow-sm"
                            >
                                <BookOpen className="w-3.5 h-3.5 text-desert-gold" />
                                <span>{t('learning_hub.open_document_btn', '打开并阅读文档')}</span>
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const VideoPlayerModal = ({ rec: initialRec, disableSeek, isUnlocked, onClose, onEnded, onUnlock }: any) => {
    const { t, i18n } = useTranslation();
    const mediaRef = React.useRef<HTMLMediaElement>(null);
    const lastTimeRef = React.useRef(0);
    const [actualListenedSeconds, setActualListenedSeconds] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isThresholdReached, setIsThresholdReached] = useState(false);
    const isUnlockedLocal = isUnlocked || isThresholdReached;
    const isVideo = isVideoUrl(initialRec.audioUrl);
    const isDoc = isDocUrl(initialRec.audioUrl) || 
                  initialRec.categoryName?.toLowerCase() === 'doc' || 
                  initialRec.categoryName === '文档' || 
                  initialRec.categoryName === 'ss文档' || 
                  initialRec.categoryName?.toLowerCase() === 'document';

    const { user, profile } = useAuth();
    const isSDLevel = profile?.role === 'sd' || profile?.role === 'super_admin';
    const [comments, setComments] = useState<any[]>([]);
    const [newCommentText, setNewCommentText] = useState('');
    const [replyToId, setReplyToId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [modalCurrentTime, setModalCurrentTime] = useState(0);
    const [attachTimestamp, setAttachTimestamp] = useState(false);
    const [activeModalTab, setActiveModalTab] = useState<'details' | 'ai_analysis' | 'comments'>(((isVideo && !isSDLevel) || isDoc) ? 'comments' : 'details');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [recordingAnalysis, setRecordingAnalysis] = useState<any>(null);

    const [rec, setRec] = useState<any>(initialRec);

    const [selectedAttachment, setSelectedAttachment] = useState<any>(null);

    const getAttachmentType = (url: string) => {
        if (!url) return 'other';
        const cleanUrl = url.split('?')[0].toLowerCase();
        if (cleanUrl.endsWith('.pdf')) return 'pdf';
        if (cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.gif') || cleanUrl.endsWith('.webp') || cleanUrl.endsWith('.svg')) return 'image';
        if (cleanUrl.endsWith('.ppt') || cleanUrl.endsWith('.pptx')) return 'ppt';
        if (cleanUrl.endsWith('.doc') || cleanUrl.endsWith('.docx')) return 'word';
        if (cleanUrl.endsWith('.xls') || cleanUrl.endsWith('.xlsx')) return 'excel';
        if (cleanUrl.endsWith('.txt')) return 'txt';
        return 'other';
    };

    React.useEffect(() => {
        if (isDoc && rec.audioUrl) {
            setSelectedAttachment({
                id: 'main-doc',
                name: rec.title || 'Main Document',
                url: rec.audioUrl,
                type: 'pdf'
            });
        } else if (!rec.audioUrl && rec.attachments && rec.attachments.length > 0) {
            setSelectedAttachment(rec.attachments[0]);
        } else {
            setSelectedAttachment(null);
        }
    }, [rec.id, rec.audioUrl, isDoc]);

    React.useEffect(() => {
        setRec(initialRec);
    }, [initialRec]);

    React.useEffect(() => {
        if (!initialRec?.id) return;
        const unsub = onSnapshot(doc(db, 'recordings', initialRec.id), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setRec({ id: snapshot.id, ...data });
                if (data && data.transcriptZh) {
                    setVideoTranscriptZh(data.transcriptZh);
                }
            }
        });
        return () => unsub();
    }, [initialRec?.id]);

    // SD translation bypass states
    const [activeVideoTab, setActiveVideoTab] = useState<'arabic' | 'chinese'>('arabic');
    const [videoTranscriptZh, setVideoTranscriptZh] = useState<string>(initialRec.transcriptZh || '');
    const [loadingVideoTranslation, setLoadingVideoTranslation] = useState(false);

    React.useEffect(() => {
        if (rec.transcriptZh && !videoTranscriptZh) {
            setVideoTranscriptZh(rec.transcriptZh);
            return;
        }

        if (activeVideoTab === 'chinese' && !videoTranscriptZh && !rec.transcriptZh && isSDLevel) {
            setLoadingVideoTranslation(true);
            fetch('/.netlify/functions/translate-transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recordingId: rec.id,
                    title: rec.title,
                    description: rec.description,
                    lecturerName: rec.lecturerName,
                    categoryName: rec.categoryName,
                    displayId: rec.displayId,
                    transcript: rec.transcript
                })
            })
            .then(res => {
                if (!res.ok) throw new Error("HTTP error " + res.status);
                return res.json();
            })
            .then(data => {
                if (data.success && data.transcriptZh) {
                    setVideoTranscriptZh(data.transcriptZh);
                    rec.transcriptZh = data.transcriptZh;
                } else {
                    throw new Error(data.error || "Failed to translate");
                }
            })
            .catch(err => {
                console.error("Error loading video translation:", err);
                setVideoTranscriptZh(t('learning_hub.no_translation_available', '暂无中文对照翻译（翻译生成失败，请检查 API 配置或重试）'));
            })
            .finally(() => setLoadingVideoTranslation(false));
        }
    }, [activeVideoTab, rec.id, videoTranscriptZh, rec.transcriptZh, isSDLevel, t]);

    React.useEffect(() => {
        if ((isDoc || !rec.audioUrl) && onUnlock && !isUnlocked) {
            // Auto-unlock document learning progress
            onUnlock(0);
        }
    }, [isDoc, rec.audioUrl, onUnlock, isUnlocked]);

    React.useEffect(() => {
        if (isVideo || isDoc) return;
        const currentLang = i18n.language || 'en';
        if (rec.aiAnalysisMultilang?.[currentLang]) {
            setRecordingAnalysis(rec.aiAnalysisMultilang[currentLang]);
        } else if (rec.aiAnalysis && (!rec.aiAnalysisMultilang || !rec.aiAnalysisMultilang[currentLang])) {
            setRecordingAnalysis(rec.aiAnalysis);
        } else {
            setRecordingAnalysis(null);
        }
    }, [rec.id, rec.aiAnalysis, rec.aiAnalysisMultilang, i18n.language, isVideo, isDoc]);

    React.useEffect(() => {
        if (isVideo || isDoc) return;
        const currentLang = i18n.language || 'en';
        const hasLangAnalysis = rec.aiAnalysisMultilang?.[currentLang] || (currentLang === 'zh' && rec.aiAnalysis);
        
        if (!hasLangAnalysis && !isAnalyzing && rec.transcriptStatus === 'ready') {
            console.log("Auto-triggering AI Analysis in the background for language:", currentLang, "and recording:", rec.id);
            handleTriggerAnalysis(true); // silent auto-trigger
        }
    }, [rec.id, rec.transcriptStatus, rec.aiAnalysisMultilang, i18n.language, isVideo, isDoc]);

    const handleTriggerAnalysis = async (isSilent = false) => {
        setIsAnalyzing(true);
        const currentLang = i18n.language || 'en';
        try {
            const res = await fetch('/.netlify/functions/analyze-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordingId: rec.id, targetLang: currentLang })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setRecordingAnalysis(data.aiAnalysis);
                if (!isSilent) {
                    alert(t('learning_hub.analysis_success', 'AI 智能录音诊断画像生成成功！'));
                }
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (error: any) {
            console.error("AI Analysis Trigger failed:", error);
            if (!isSilent) {
                alert(t('learning_hub.analysis_failed', 'AI 诊断画像生成失败：') + error.message);
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time) || !isFinite(time)) return "0:00";
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const jumpToTime = (seconds: number) => {
        if (mediaRef.current) {
            mediaRef.current.currentTime = seconds;
            mediaRef.current.play();
            setIsPlaying(true);
        }
    };

    // Real-time comments listener (onSnapshot)
    useEffect(() => {
        if (!rec.id) return;
        
        // Simple query by audioId (highly safe, does not require composite indexes)
        const q = query(
            collection(db, 'comments'),
            where('audioId', '==', rec.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.status !== 'deleted') {
                    list.push({ id: doc.id, ...data });
                }
            });

            // Sort in memory: Pinned comments first, then descending by createdAt timestamp
            list.sort((a, b) => {
                if (a.isPinned !== b.isPinned) {
                    return a.isPinned ? -1 : 1;
                }
                const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
                const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
                return timeB - timeA;
            });

            setComments(list);
        }, (error) => {
            console.error("Error loading comments:", error);
        });

        return () => unsubscribe();
    }, [rec.id]);

    const containsSensitiveWord = (text: string) => {
        const list = ['垃圾', '垃圾平台', '辣鸡', '烂平台', '差劲', '投诉', '举报', '不专业', '太差', '垃圾视频', '垃圾音频', '吐槽', '抱怨', 'complaint', 'rubbish', 'worst', 'garbage', 'terrible', 'useless', 'stupid', 'bastard', 'fuck', 'shit'];
        return list.some(word => text.toLowerCase().includes(word));
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCommentText.trim()) return;

        if (containsSensitiveWord(newCommentText)) {
            alert(t('learning_hub.sensitive_comment_warning', '提醒：为了共同营造积极、专业的学习氛围，请使用具有建设性、专业性的语言进行互动讨论哦！感谢您的配合！'));
            return;
        }

        try {
            await addDoc(collection(db, 'comments'), {
                audioId: rec.id,
                userId: user?.uid || '',
                userName: profile?.name || user?.displayName || user?.email?.split('@')[0] || t('common.anonymous', '匿名用户'),
                userAvatar: profile?.avatarUrl || '',
                userRole: profile?.role || 'user',
                userTeam: profile?.team || '',
                content: newCommentText.trim(),
                createdAt: serverTimestamp(),
                likes: [],
                parentId: null,
                status: 'approved',
                isPinned: false,
                timestamp: attachTimestamp ? Math.round(modalCurrentTime) : null
            });

            // Notify the uploader (author) of the material if uploaderId is present and not the commenter themselves
            const uploaderId = rec.uploaderId;
            const uploaderCrmId = rec.uploaderCrmId;
            if (uploaderId && uploaderId !== user?.uid) {
                // 1. Create in-app notification in Firestore
                await addDoc(collection(db, 'user_notifications'), {
                    recipientId: uploaderId,
                    senderName: profile?.crmId || user?.displayName || '学堂伙伴',
                    type: 'comment',
                    titleKey: 'notifications.new_comment_title',
                    content: newCommentText.trim().slice(0, 80),
                    recordingId: rec.id,
                    read: false,
                    createdAt: serverTimestamp()
                });

                // 2. Trigger DingTalk Work Notification via Serverless Function
                if (uploaderCrmId) {
                    fetch('/.netlify/functions/dingtalk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'notifyComment',
                            materialTitle: rec.title,
                            uploaderCrmId: uploaderCrmId,
                            commenterName: profile?.crmId || '学堂伙伴',
                            commentText: newCommentText.trim().slice(0, 100),
                            recordingId: rec.id
                        })
                    }).catch(err => console.error("DingTalk comment notification failed:", err));
                }
            }

            setNewCommentText('');
            setAttachTimestamp(false);
        } catch (error: any) {
            console.error("Failed to add comment:", error);
            alert(t('common.save_fail', '保存失败：') + error.message);
        }
    };

    const handleAddReply = async (e: React.FormEvent, parentCommentId: string) => {
        e.preventDefault();
        if (!replyText.trim()) return;

        if (containsSensitiveWord(replyText)) {
            alert(t('learning_hub.sensitive_comment_warning', '提醒：为了共同营造积极、专业的学习氛围，请使用具有建设性、专业性的语言进行互动讨论哦！感谢您的配合！'));
            return;
        }

        try {
            await addDoc(collection(db, 'comments'), {
                audioId: rec.id,
                userId: user?.uid || '',
                userName: profile?.name || user?.displayName || user?.email?.split('@')[0] || t('common.anonymous', '匿名用户'),
                userAvatar: profile?.avatarUrl || '',
                userRole: profile?.role || 'user',
                userTeam: profile?.team || '',
                content: replyText.trim(),
                createdAt: serverTimestamp(),
                likes: [],
                parentId: parentCommentId,
                status: 'approved',
                isPinned: false
            });
            setReplyText('');
            setReplyToId(null);
        } catch (error: any) {
            console.error("Failed to add reply:", error);
            alert(t('common.save_fail', '保存失败：') + error.message);
        }
    };

    const handleLikeComment = async (commentId: string, currentLikes: string[]) => {
        if (!user?.uid) return;
        const commentRef = doc(db, 'comments', commentId);
        try {
            if (currentLikes.includes(user.uid)) {
                await updateDoc(commentRef, {
                    likes: arrayRemove(user.uid)
                });
            } else {
                await updateDoc(commentRef, {
                    likes: arrayUnion(user.uid)
                });
            }
        } catch (error: any) {
            console.error("Failed to like comment:", error);
        }
    };

    const handleFlagComment = async (commentId: string) => {
        if (window.confirm(t('learning_hub.confirm_report_comment', '确认举报该条互动讨论内容？举报后该内容将被暂时屏蔽并提交至管理员审核。'))) {
            const commentRef = doc(db, 'comments', commentId);
            try {
                await updateDoc(commentRef, {
                    status: 'flagged'
                });
                alert(t('learning_hub.report_success', '举报成功，内容已屏蔽送审。'));
            } catch (error: any) {
                console.error("Failed to flag comment:", error);
            }
        }
    };

    const handleTimeUpdate = () => {
        if (mediaRef.current) {
            const curr = mediaRef.current.currentTime;
            setModalCurrentTime(curr);
            const diff = curr - lastTimeRef.current;
            
            // Increment actual listened time only when the media is playing legitimately (less than 1.5s skip)
            const playing = !mediaRef.current.paused && !mediaRef.current.ended;
            if (playing && diff > 0 && diff < 1.5) {
                setActualListenedSeconds(prev => {
                    const next = prev + diff;
                    const target = duration / 3;
                    if (target > 0 && next >= target) {
                        setIsThresholdReached(true);
                    }
                    return next;
                });
            }
            
            if (disableSeek) {
                if (mediaRef.current.currentTime > lastTimeRef.current + 1.5) {
                    mediaRef.current.currentTime = lastTimeRef.current;
                } else {
                    lastTimeRef.current = mediaRef.current.currentTime;
                }
            } else {
                lastTimeRef.current = mediaRef.current.currentTime;
            }
        }
    };

    const handleLoadedMetadata = () => {
        if (mediaRef.current) setDuration(mediaRef.current.duration);
    };

    const handleClose = React.useCallback(() => {
        if (!isDoc && rec.audioUrl && duration > 0 && actualListenedSeconds >= duration / 3 && !isUnlocked && onUnlock) {
            onUnlock(duration);
        }
        onClose();
    }, [isDoc, rec.audioUrl, duration, actualListenedSeconds, isUnlocked, onUnlock, onClose]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
            {/* Modal Container */}
            <div className={`bg-white rounded-3xl border border-gray-100 shadow-2xl w-full ${
                rec.attachments?.length ? 'max-w-6xl' : 'max-w-4xl'
            } overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 max-h-[90vh] relative`}>
                {/* Modal Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] border px-2 py-0.5 rounded-full font-bold shadow-sm ${
                            isDoc
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isVideo 
                                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                    : 'bg-amber-50 text-yellow-800 border-desert-gold/30'
                        }`}>
                            {isDoc ? '📄' : isVideo ? '🎥' : '🎵'} {rec.categoryName || t('common.uncategorized')}
                        </span>
                        {rec.displayId && <span className="text-desert-gold text-xs font-extrabold">[{rec.displayId}]</span>}
                    </div>
                    <button 
                        onClick={handleClose}
                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-700 outline-none"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Body Split Layout */}
                <div className={`flex-1 flex flex-col ${rec.attachments?.length ? 'lg:flex-row' : ''} overflow-hidden`}>
                    {/* Left/Main Content Panel */}
                    <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
                        {/* Playback viewport */}
                        <div className="bg-black flex-1 flex items-center justify-center relative overflow-hidden min-h-[300px] md:min-h-[400px]">
                    {selectedAttachment ? (
                        // Document Preview Panel
                        <div className="w-full h-full flex flex-col min-h-[450px] md:min-h-[550px] bg-slate-950">
                            {/* Toolbar */}
                            <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-slate-200 text-xs shrink-0 select-none">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-lg shrink-0">
                                        {getAttachmentType(selectedAttachment.url) === 'ppt' ? '📊' : getAttachmentType(selectedAttachment.url) === 'pdf' ? '📕' : getAttachmentType(selectedAttachment.url) === 'image' ? '🖼️' : '📄'}
                                    </span>
                                    <span className="font-extrabold truncate pr-2" title={selectedAttachment.name}>
                                        {selectedAttachment.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                    <a 
                                        href={selectedAttachment.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="hover:text-desert-gold flex items-center gap-1.5 transition-colors font-bold"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>{t('learning_hub.open_new_tab', '在新窗口打开')}</span>
                                    </a>
                                    <span className="w-px h-3 bg-slate-800"></span>
                                    <a 
                                        href={selectedAttachment.url} 
                                        download={selectedAttachment.name} 
                                        className="hover:text-desert-gold flex items-center gap-1.5 transition-colors font-bold"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>{t('common.download_attachment', '下载')}</span>
                                    </a>
                                </div>
                            </div>
                            
                            {/* Preview Body */}
                            <div className="flex-1 bg-white relative overflow-hidden min-h-[380px] md:min-h-[480px]">
                                {getAttachmentType(selectedAttachment.url) === 'pdf' ? (
                                    <iframe
                                        src={`${selectedAttachment.url}#toolbar=0`}
                                        className="w-full h-full border-0 bg-white"
                                        title={selectedAttachment.name}
                                    />
                                ) : getAttachmentType(selectedAttachment.url) === 'image' ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-900/10 relative group">
                                        <img
                                            src={selectedAttachment.url}
                                            alt={selectedAttachment.name}
                                            className="max-w-full max-h-[45vh] lg:max-h-[55vh] object-contain rounded-lg shadow-2xl transition-all duration-300 hover:scale-[1.01]"
                                        />
                                        <a
                                            href={selectedAttachment.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="absolute bottom-6 bg-slate-900/80 hover:bg-slate-900 backdrop-blur-md text-white text-[11px] font-extrabold px-4 py-2 rounded-xl border border-slate-700 shadow-lg transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                        >
                                            <BookOpen className="w-3.5 h-3.5 text-desert-gold" />
                                            <span>{t('learning_hub.open_original_image', '查看原图')}</span>
                                        </a>
                                    </div>
                                ) : ['ppt', 'word', 'excel'].includes(getAttachmentType(selectedAttachment.url)) ? (
                                    <iframe
                                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(selectedAttachment.url)}&embedded=true`}
                                        className="w-full h-full border-0 bg-white"
                                        title={selectedAttachment.name}
                                    />
                                ) : (
                                    // Fallback for ZIP, RAR, or unsupported
                                    <div className="flex flex-col items-center justify-center gap-6 py-12 w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 backdrop-blur-md rounded-none border-0 shadow-inner px-8 text-center animate-in fade-in duration-500">
                                        <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl relative overflow-hidden transform hover:scale-105 transition-all duration-300 group">
                                            <FileText className="w-10 h-10 text-white animate-pulse" />
                                        </div>
                                        <div className="space-y-3 max-w-md">
                                            <span className="inline-flex items-center gap-1.5 text-[10px] bg-black/40 backdrop-blur-md text-white border border-white/10 px-3.5 py-1 rounded-full font-black shadow-sm uppercase tracking-widest select-none">
                                                📂 {selectedAttachment.name.split('.').pop()?.toUpperCase() || 'FILE'}
                                            </span>
                                            <h4 className="text-white font-extrabold text-base leading-snug line-clamp-2 px-4">
                                                {selectedAttachment.name}
                                            </h4>
                                            <p className="text-xs text-white/60 px-4">
                                                {t('learning_hub.no_inline_preview_tip', '此文件格式暂不支持在线预览，请点击下方按钮下载至本地查看。')}
                                            </p>
                                        </div>
                                        <a
                                            href={selectedAttachment.url}
                                            download={selectedAttachment.name}
                                            className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 hover:shadow-[0_8px_30px_rgba(244,63,94,0.4)] hover:scale-105 active:scale-95 text-white text-xs font-black py-3 px-6 rounded-xl shadow-xl border border-white/15 transition-all duration-300 cursor-pointer"
                                        >
                                            <Download className="w-4 h-4 shrink-0 text-white" />
                                            <span>{t('common.download', '下载文件')}</span>
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : !rec.audioUrl ? (
                        <div className="flex flex-col items-center justify-center gap-6 py-12 w-full bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-indigo-600/10 backdrop-blur-md rounded-3xl border border-white/10 shadow-inner min-h-[300px] md:min-h-[400px] px-8 text-center animate-in fade-in duration-500">
                            <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl relative overflow-hidden transform hover:scale-105 transition-all duration-300 group">
                                <FileText className="w-12 h-12 text-white animate-pulse" />
                            </div>
                            <div className="space-y-3 max-w-md">
                                <span className="inline-flex items-center gap-1.5 text-[10px] bg-black/40 backdrop-blur-md text-white border border-white/10 px-3.5 py-1 rounded-full font-black shadow-sm uppercase tracking-widest select-none">
                                    📂 {t('learning_hub.attachment_package_mode', '配套讲义与附件模式')}
                                </span>
                                <h4 className="text-white font-extrabold text-base leading-snug line-clamp-2 px-4">
                                    {rec.title}
                                </h4>
                                <p className="text-xs text-white/60">
                                    {t('learning_hub.download_sidebar_tip', '请在右侧面板查看并下载此课程的配套讲义与文档。')}
                                </p>
                            </div>
                        </div>
                    ) : isVideo ? (
                        <video
                            ref={mediaRef as React.RefObject<HTMLVideoElement>}
                            src={rec.audioUrl}
                            className="w-full max-h-[60vh] object-contain"
                            controls
                            autoPlay
                            controlsList={disableSeek ? "nodownload nofullscreen noremoteplayback" : "nodownload"}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onEnded={() => {
                                setIsPlaying(false);
                                onEnded(mediaRef.current?.duration || 0, actualListenedSeconds);
                            }}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            preload="metadata"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-4 py-10 w-full bg-gradient-to-br from-light-teal/20 to-deep-teal/40 backdrop-blur-md rounded-3xl border border-white/10 shadow-inner min-h-[300px] px-6">
                            <div className={`w-36 h-36 rounded-full border-4 border-desert-gold/30 flex items-center justify-center bg-arabian-night shadow-2xl relative overflow-hidden ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }}>
                                {/* Vinyl Grooves */}
                                <div className="absolute inset-2 rounded-full border border-white/5"></div>
                                <div className="absolute inset-4 rounded-full border border-white/5"></div>
                                <div className="absolute inset-6 rounded-full border border-white/5"></div>
                                <div className="absolute inset-8 rounded-full border border-white/5"></div>
                                {/* Record Label */}
                                <div className="w-12 h-12 rounded-full bg-desert-gold flex items-center justify-center text-deep-teal font-black text-xs shadow-md border-2 border-white/20 select-none">
                                    🎵
                                </div>
                            </div>
                            <div className="text-center space-y-1">
                                <span className="text-[10px] bg-desert-gold/15 text-yellow-800 border border-desert-gold/30 px-3 py-1 rounded-full font-bold shadow-sm uppercase tracking-widest select-none">
                                    🎧 {t('learning_hub.audio_mode', '销售音频模式')}
                                </span>
                            </div>
                            <audio
                                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                                src={rec.audioUrl}
                                className="w-full max-w-lg mt-4 px-4"
                                controls
                                autoPlay
                                controlsList={disableSeek ? "nodownload noremoteplayback" : "nodownload"}
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={handleLoadedMetadata}
                                onEnded={() => {
                                    setIsPlaying(false);
                                    onEnded(mediaRef.current?.duration || 0, actualListenedSeconds);
                                }}
                                  onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                preload="metadata"
                            />
                            
                            {/* Timeline Highlights Interactive Bar */}
                            {duration > 0 && comments.some(c => c.timestamp !== undefined && c.timestamp !== null) && (
                                <div className="w-full max-w-lg mt-4 px-4 flex flex-col gap-2 animate-in fade-in duration-500">
                                    <div className="flex justify-between items-center text-[10px] font-extrabold text-white/70 tracking-wider">
                                        <span className="flex items-center gap-1">📍 {t('learning_hub.timeline_highlights', '音频时间轴高光批注')}</span>
                                        <span>{comments.filter(c => c.timestamp !== undefined && c.timestamp !== null).length} 个批注点</span>
                                    </div>
                                    
                                    {/* Timeline Track with Pinned Dots */}
                                    <div className="relative w-full h-2 bg-white/20 rounded-full select-none overflow-visible border border-white/5 shadow-inner flex items-center">
                                        {/* Progress fill */}
                                        <div 
                                            className="absolute left-0 top-0 bottom-0 bg-desert-gold/50 rounded-full" 
                                            style={{ width: `${(modalCurrentTime / duration) * 100}%` }}
                                        />
                                        
                                        {/* Clickable pins */}
                                        {comments
                                            .filter(c => c.timestamp !== undefined && c.timestamp !== null)
                                            .map((c) => {
                                                const percent = (c.timestamp / duration) * 100;
                                                const isActive = Math.abs(modalCurrentTime - c.timestamp) < 2;
                                                return (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => jumpToTime(c.timestamp)}
                                                        className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border border-white transition-all transform hover:scale-125 cursor-pointer z-20 focus:outline-none ${
                                                            isActive 
                                                                ? 'bg-desert-gold shadow-lg shadow-yellow-500/50 scale-110' 
                                                                : 'bg-amber-400 shadow-sm'
                                                        } group`}
                                                        style={{ left: `${percent}%`, transform: 'translate(-50%, -50%)' }}
                                                    >
                                                        {/* Glowing ring for active bookmarks */}
                                                        {isActive && (
                                                            <span className="absolute inset-0 rounded-full animate-ping bg-desert-gold opacity-75"></span>
                                                        )}
                                                        
                                                        {/* Rich tooltip preview */}
                                                        <span className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-arabian-night/95 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl border border-white/10 z-30 pointer-events-none transition-all">
                                                            ⏱️ {formatTime(c.timestamp)} | <span className="font-extrabold text-desert-gold">{c.userName}</span>: {c.content.length > 20 ? c.content.slice(0, 20) + '...' : c.content}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Details view */}
                <div className="p-6 bg-white overflow-y-auto max-h-[40vh]">
                    <h3 className="text-lg font-extrabold text-arabian-night mb-2">
                        {rec.title}
                    </h3>

                    {(isDoc || (isVideo && !isSDLevel)) && (
                        <div className="mt-3 mb-5 p-4 bg-gray-50 rounded-2xl border border-gray-100 animate-in fade-in duration-300">
                            {rec.lecturerName && (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-desert-gold mb-2 select-none">
                                    <User className="h-3.5 w-3.5 shrink-0" />
                                    <span>{rec.lecturerName}</span>
                                </div>
                            )}
                            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                                {rec.description}
                            </p>
                        </div>
                    )}
                    
                    {/* Sleek Tabs Bar */}
                    {(!isDoc && (!isVideo || isSDLevel)) && (
                        <div className="flex gap-2 border-b border-gray-100 pb-3 mb-5 mt-4">
                            <button
                                type="button"
                                onClick={() => setActiveModalTab('details')}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 focus:outline-none cursor-pointer ${
                                    activeModalTab === 'details' 
                                        ? 'bg-deep-teal/10 text-deep-teal shadow-sm border border-deep-teal/20' 
                                        : 'text-gray-500 hover:bg-gray-50 border border-transparent'
                                }`}
                            >
                                📝 {t('learning_hub.course_details', '课程详情')}
                            </button>
                            {!isVideo && (
                                <button
                                    type="button"
                                    onClick={() => setActiveModalTab('ai_analysis')}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 focus:outline-none cursor-pointer ${
                                        activeModalTab === 'ai_analysis' 
                                            ? 'bg-desert-gold/15 text-yellow-800 shadow-sm border border-desert-gold/30' 
                                            : 'text-gray-500 hover:bg-gray-50 border border-transparent'
                                    }`}
                                >
                                    ✨ {t('learning_hub.ai_call_portrait', 'AI 录音画像')}
                                    {recordingAnalysis && (
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                    )}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setActiveModalTab('comments')}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 focus:outline-none cursor-pointer ${
                                    activeModalTab === 'comments' 
                                        ? 'bg-deep-teal/10 text-deep-teal shadow-sm border border-deep-teal/20' 
                                        : 'text-gray-500 hover:bg-gray-50 border border-transparent'
                                }`}
                            >
                                💬 {t('learning_hub.comments_and_qa', '互动问答')} ({comments.length})
                            </button>
                        </div>
                    )}

                    {/* Tab 1: Course Details */}
                    {activeModalTab === 'details' && (!isDoc && (!isVideo || isSDLevel)) && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {rec.lecturerName && (
                                <div className="flex items-center gap-1.5 text-sm font-bold text-desert-gold mb-3">
                                    <User className="h-4 w-4" />
                                    <span>{rec.lecturerName}</span>
                                </div>
                            )}
                            
                            <p className="text-sm text-arabian-night/70 leading-relaxed border-t border-gray-100 pt-3">
                                {rec.description}
                            </p>

                            {/* Arabic Transcript Document with Anti-Cheating Unlock */}
                            {rec.transcript && (!isVideo || isSDLevel) && (
                                <div className="mt-6 border-t border-gray-100 pt-5">
                                    {isUnlockedLocal ? (
                                        <div className="animate-in fade-in duration-700">
                                            <div className="flex flex-wrap justify-between items-center gap-4 mb-3">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-md font-extrabold text-deep-teal flex items-center gap-1.5">
                                                        <FileText className="h-5 w-5 text-desert-gold" />
                                                        {activeVideoTab === 'chinese' ? t('learning_hub.chinese_transcript', '中文翻译') : t('learning_hub.arabic_transcript', '阿语逐字稿')}
                                                    </h4>
                                                </div>

                                                {/* Bilingual Translation Toggle */}
                                                {isSDLevel && (
                                                    <div className="flex bg-gray-100 p-0.5 rounded-lg text-[10px] font-semibold border border-gray-200/50 select-none">
                                                        <button
                                                            onClick={() => setActiveVideoTab('arabic')}
                                                            className={`px-2 py-1 rounded-md transition-all duration-200 cursor-pointer ${
                                                                activeVideoTab === 'arabic'
                                                                    ? 'bg-white text-deep-teal shadow-sm border border-gray-200/20'
                                                                    : 'text-gray-400 hover:text-gray-600'
                                                            }`}
                                                        >
                                                            🌐 {t('learning_hub.original_transcript', 'Original')}
                                                        </button>
                                                        <button
                                                            onClick={() => setActiveVideoTab('chinese')}
                                                            className={`px-2 py-1 rounded-md transition-all duration-200 flex items-center gap-0.5 cursor-pointer ${
                                                                activeVideoTab === 'chinese'
                                                                    ? 'bg-white text-deep-teal shadow-sm border border-gray-200/20'
                                                                    : 'text-gray-400 hover:text-gray-600'
                                                            }`}
                                                        >
                                                            🇨🇳 {t('learning_hub.chinese_transcript', '中文')}
                                                        </button>
                                                    </div>
                                                )}

                                                <button 
                                                    onClick={() => {
                                                        const textToCopy = activeVideoTab === 'chinese' ? videoTranscriptZh : rec.transcript;
                                                        if (textToCopy) {
                                                            navigator.clipboard.writeText(textToCopy);
                                                            alert(t('common.copied', '已复制到剪贴板！'));
                                                        }
                                                    }}
                                                    className="text-xs font-semibold text-desert-gold border border-desert-gold/30 hover:bg-yellow-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ml-auto sm:ml-0"
                                                >
                                                    {t('common.copy', '复制')}
                                                </button>
                                            </div>
                                            
                                            {activeVideoTab === 'chinese' && loadingVideoTranslation ? (
                                                <div className="bg-gray-50/75 border border-gray-100 rounded-2xl p-5 flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                                                    <RefreshCw className="w-6 h-6 animate-spin text-desert-gold" />
                                                    <span className="text-xs font-bold animate-pulse">{t('learning_hub.generating_translation', '正在智能生成中文对照翻译...')}</span>
                                                </div>
                                            ) : (
                                                <div 
                                                    className={`bg-gray-50/75 border border-gray-100 rounded-2xl p-5 max-h-[300px] overflow-y-auto text-sm text-arabian-night/95 leading-relaxed whitespace-pre-line ${
                                                        activeVideoTab === 'chinese' ? 'text-left font-sans' : 'text-right font-medium'
                                                    }`} 
                                                    dir={activeVideoTab === 'chinese' ? 'ltr' : 'rtl'}
                                                    style={{
                                                        fontFamily: activeVideoTab === 'chinese' 
                                                            ? "'Inter', 'Noto Sans SC', sans-serif" 
                                                            : "'Noto Sans Arabic', 'Inter', sans-serif"
                                                    }}
                                                >
                                                    {activeVideoTab === 'chinese' ? (videoTranscriptZh || t('learning_hub.no_translation_available', '暂无中文对照翻译')) : rec.transcript}
                                                </div>
                                            )}

                                            {isSDLevel && (
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-2 text-center select-none">
                                                    🔒 {t('learning_hub.sd_translation_notice', '🔒 SD 总监层级以上特权：中文对照翻译通道已激活')}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="animate-in fade-in duration-500">
                                            <h4 className="text-md font-extrabold text-deep-teal flex items-center gap-1.5 mb-3">
                                                <FileText className="h-5 w-5 text-gray-400" />
                                                {t('learning_hub.arabic_transcript', '阿语逐字稿')}
                                            </h4>
                                            <div className="relative rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] to-transparent p-6 overflow-hidden flex flex-col items-center justify-center min-h-[160px] text-center shadow-sm">
                                                {/* Blurred placeholder layout representation */}
                                                <div className="absolute inset-0 select-none pointer-events-none opacity-5 blur-sm whitespace-pre-line text-right p-5 text-xs font-serif" dir="rtl">
                                                    العامل: مرحبًا، شكرًا لاتصالك بخدمة العملاء. كيف يمكنني مساعدتك اليوم؟
                                                    العميل: مرحبًا، أود الاستفسار عن تفاصيل الاشتراك وتحديث باقة التعلم الخاصة بي.
                                                    العامل: بالتأكيد! يسعدني جدًا مساعدتك في ذلك. لدينا باقة متميزة توفر قيمة إضافية رائعة...
                                                </div>
                                                
                                                <div className="relative z-10 flex flex-col items-center gap-3 w-full">
                                                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-sm animate-pulse">
                                                        <Lock className="w-5 h-5 text-amber-600" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-bold text-amber-900">
                                                            {t('learning_hub.transcript_locked', '阿语逐字稿已锁定')}
                                                        </p>
                                                        <p className="text-xs text-amber-800/80 max-w-md px-4 leading-relaxed font-semibold">
                                                            {t('learning_hub.transcript_lock_desc', '为了您的学习成效，收听完整录音的 1/3 时长且播放结束后即可解锁阿语逐字稿文档。')}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Progress indicator */}
                                                    {duration > 0 && (
                                                        <div className="w-full max-w-xs mt-1 bg-amber-100/50 rounded-full h-2.5 overflow-hidden border border-amber-200">
                                                            <div 
                                                                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                                                                style={{ width: `${Math.min(100, (actualListenedSeconds / (duration / 3)) * 100)}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                    
                                                    <p className="text-[10px] font-bold text-amber-800/90 tracking-wide uppercase">
                                                        {t('learning_hub.transcript_lock_progress', '解锁进度')}：
                                                        {t('learning_hub.transcript_lock_progress_detail', {
                                                            listened: Math.round(actualListenedSeconds),
                                                            target: Math.round(duration / 3),
                                                            percentage: Math.min(100, Math.round((actualListenedSeconds / (duration / 3)) * 100))
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 2: AI Call Analysis Portrait Dashboard */}
                    {activeModalTab === 'ai_analysis' && !(isVideo || isDoc) && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {recordingAnalysis ? (
                                <div className="space-y-6">
                                    {/* Row 1: Header metrics */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Overall Score */}
                                        <div className="glass-panel p-5 rounded-2xl border border-desert-gold/30 bg-gradient-to-br from-desert-gold/5 via-transparent to-transparent flex flex-col items-center justify-center text-center relative overflow-hidden shadow-sm">
                                            <span className="text-[10px] font-extrabold text-desert-gold uppercase tracking-wider mb-2">🏆 {t('learning_hub.analysis_overall_score', '通话质量综合得分')}</span>
                                            <div className="relative flex items-center justify-center">
                                                <div className="w-20 h-20 rounded-full border-4 border-desert-gold/20 flex items-center justify-center bg-white shadow-md">
                                                    <span className="text-3xl font-black text-yellow-800">{recordingAnalysis.overallScore}</span>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-arabian-night/50 mt-2">{t('learning_hub.analysis_grade', '等级')}: {recordingAnalysis.overallScore >= 90 ? t('learning_hub.analysis_grade_excellent', 'Excellent (A+)') : recordingAnalysis.overallScore >= 80 ? t('learning_hub.analysis_grade_good', 'Good (B)') : t('learning_hub.analysis_grade_needs_improvement', 'Needs Improvement')}</span>
                                        </div>

                                        {/* Talk Ratio */}
                                        <div className="glass-panel p-5 rounded-2xl border border-gray-100 flex flex-col justify-center shadow-sm">
                                            <span className="text-[10px] font-extrabold text-arabian-night/50 uppercase tracking-wider mb-3">🗣️ {t('learning_hub.analysis_talk_ratio', '说听占比 (Talk-to-Listen)')}</span>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-bold text-arabian-night/80">
                                                    <span>{t('learning_hub.analysis_sales_label', 'CC 销售')}: {recordingAnalysis.talkRatio.sales}%</span>
                                                    <span>{t('learning_hub.analysis_customer_label', '客户')}: {recordingAnalysis.talkRatio.customer}%</span>
                                                </div>
                                                <div className="h-3 w-full bg-blue-100 rounded-full overflow-hidden flex border border-blue-200/20">
                                                    <div className="h-full bg-deep-teal" style={{ width: `${recordingAnalysis.talkRatio.sales}%` }} />
                                                    <div className="h-full bg-desert-gold" style={{ width: `${recordingAnalysis.talkRatio.customer}%` }} />
                                                </div>
                                                <p className="text-[10px] text-arabian-night/40 font-bold leading-relaxed mt-1">
                                                    {t('learning_hub.analysis_ratio_tip', '* 黄金说听比为 45:55，说得太多容易引起客户反感。')}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Speech Rate */}
                                        <div className="glass-panel p-5 rounded-2xl border border-gray-100 flex flex-col justify-center shadow-sm">
                                            <span className="text-[10px] font-extrabold text-arabian-night/50 uppercase tracking-wider mb-3">⚡ {t('learning_hub.analysis_speech_rate', '说话平均语速 (Words per Min)')}</span>
                                            <div className="grid grid-cols-2 gap-2 text-center">
                                                <div className="bg-gray-50/75 p-2 rounded-xl border border-gray-100">
                                                    <p className="text-[10px] font-bold text-arabian-night/40">{t('learning_hub.analysis_sales_label', 'CC 销售')}</p>
                                                    <p className="text-lg font-black text-deep-teal">{recordingAnalysis.speechRate.sales} <span className="text-[10px] font-bold">{t('learning_hub.analysis_wpm_unit', '词/分')}</span></p>
                                                </div>
                                                <div className="bg-gray-50/75 p-2 rounded-xl border border-gray-100">
                                                    <p className="text-[10px] font-bold text-arabian-night/40">{t('learning_hub.analysis_customer_label', '客户')}</p>
                                                    <p className="text-lg font-black text-desert-gold">{recordingAnalysis.speechRate.customer} <span className="text-[10px] font-bold">{t('learning_hub.analysis_wpm_unit', '词/分')}</span></p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Customer Sentiment Trend */}
                                    <div className="glass-panel p-5 rounded-2xl border border-gray-100 shadow-sm">
                                        <span className="text-[10px] font-extrabold text-arabian-night/50 uppercase tracking-wider mb-3 block">📈 {t('learning_hub.analysis_sentiment_trend', '客户情绪起伏热力图 (Customer Sentiment Trend)')}</span>
                                        <div className="flex justify-between items-end gap-3 h-20 pt-4 px-2">
                                            {recordingAnalysis.sentimentTrend.map((score: number, idx: number) => {
                                                const labels = [
                                                    t('learning_hub.sentiment_phase_1', '开场建立'),
                                                    t('learning_hub.sentiment_phase_2', '异议切入'),
                                                    t('learning_hub.sentiment_phase_3', '同理突破'),
                                                    t('learning_hub.sentiment_phase_4', '价值促成'),
                                                    t('learning_hub.sentiment_phase_5', '成单达成')
                                                ];
                                                return (
                                                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                                                        {/* Bar */}
                                                        <div 
                                                            className={`w-full rounded-t-lg transition-all duration-700 shadow-sm border border-transparent ${
                                                                score >= 80 
                                                                    ? 'bg-gradient-to-t from-green-500/80 to-green-600/90 border-green-300/35' 
                                                                    : score >= 60 
                                                                        ? 'bg-gradient-to-t from-amber-400/80 to-amber-500/90 border-amber-300/35' 
                                                                        : 'bg-gradient-to-t from-red-400/80 to-red-500/90 border-red-300/35'
                                                            }`}
                                                            style={{ height: `${score}%` }}
                                                            title={`情绪得分: ${score}%`}
                                                        />
                                                        <span className="text-[8px] font-bold text-arabian-night/40 select-none truncate w-full text-center">{labels[idx]}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Row 3: Objections Handled Checklist */}
                                    {recordingAnalysis.objectionsHandled && recordingAnalysis.objectionsHandled.length > 0 && (
                                        <div className="space-y-2.5">
                                            <span className="text-[10px] font-extrabold text-arabian-night/50 uppercase tracking-wider block">🎯 {t('learning_hub.analysis_objections_check', '异议点突破体检 (Objection Check)')}</span>
                                            <div className="grid grid-cols-1 gap-2.5">
                                                {recordingAnalysis.objectionsHandled.map((obj: any, idx: number) => (
                                                    <div key={idx} className="bg-gray-50/75 border border-gray-100 rounded-xl p-3 flex flex-col md:flex-row md:items-center gap-3">
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center border shadow-inner ${
                                                                obj.handled 
                                                                    ? 'bg-green-50 text-green-600 border-green-200' 
                                                                    : 'bg-red-50 text-red-500 border-red-200'
                                                            }`}>
                                                                {obj.handled ? '✓' : '✗'}
                                                            </div>
                                                            <span className="font-extrabold text-xs text-arabian-night">{obj.objection}</span>
                                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded leading-none border ${
                                                                obj.handled 
                                                                    ? 'bg-green-100/50 text-green-700 border-green-200/55' 
                                                                    : 'bg-red-100/50 text-red-700 border-red-200/55'
                                                            }`}>
                                                                {obj.handled ? t('learning_hub.analysis_objection_handled', '已突破') : t('learning_hub.analysis_objection_unhandled', '未突破')}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 text-xs text-arabian-night/70 font-semibold leading-relaxed pl-1 md:pl-0 border-l border-transparent md:border-gray-100 md:pl-3">
                                                            {obj.feedback}
                                                        </div>
                                                        <div className="text-right shrink-0 pr-1 text-xs font-black text-yellow-800">
                                                            {t('learning_hub.analysis_score_label', '得分')}: {obj.score}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Row 4: Summary & Coaching tips */}
                                    <div className="bg-gradient-to-br from-light-teal/5 to-deep-teal/5 border border-light-teal/15 p-5 rounded-2xl space-y-4">
                                        <div>
                                            <span className="text-[10px] font-extrabold text-deep-teal uppercase tracking-wider block mb-1">📝 {t('learning_hub.analysis_diagnose_summary', '智能体检诊断总结')}</span>
                                            <p className="text-xs text-arabian-night font-medium leading-relaxed">
                                                {recordingAnalysis.summary}
                                            </p>
                                        </div>
                                        <div className="border-t border-deep-teal/10 pt-3">
                                            <span className="text-[10px] font-extrabold text-desert-gold uppercase tracking-wider block mb-2">⭐ {t('learning_hub.analysis_coaching_tips', 'AI 高能优化建议 (Coaching Tips)')}</span>
                                            <ul className="space-y-2">
                                                {recordingAnalysis.tips.map((tip: string, idx: number) => (
                                                    <li key={idx} className="text-xs text-arabian-night/80 flex items-start gap-1.5 font-medium leading-relaxed">
                                                        <span className="text-desert-gold select-none mt-0.5">✦</span>
                                                        <span>{tip}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            ) : (isAnalyzing || rec.transcriptStatus === 'transcribing' || rec.aiAnalysisStatus === 'analyzing') ? (
                                <div className="text-center py-16 px-6 rounded-3xl border border-light-teal/20 bg-gradient-to-br from-light-teal/5 to-deep-teal/5 flex flex-col items-center justify-center gap-5 shadow-sm animate-in fade-in duration-300">
                                    <div className="relative w-16 h-16 flex items-center justify-center">
                                        <div className="absolute inset-0 rounded-full border-4 border-desert-gold/10 border-t-desert-gold animate-spin" />
                                        <Sparkles className="w-6 h-6 text-desert-gold animate-pulse" />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-black text-deep-teal uppercase tracking-wider animate-pulse">
                                            {t('learning_hub.analysis_generating_title', 'AI 智能体检诊断中...')}
                                        </h4>
                                        <p className="text-xs text-arabian-night/60 max-w-sm font-bold leading-relaxed px-4">
                                            {t('learning_hub.analysis_generating_desc', '系统正在后台自动生成录音诊断画像，AI 将深入诊断说话比例、平均语速、异议突破及情绪走势，完成后将自动呈现，请稍候。')}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                // Empty / Prompt generate state
                                <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-gray-200 bg-gray-50/25 flex flex-col items-center justify-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-desert-gold/10 border border-desert-gold/20 flex items-center justify-center text-2xl select-none animate-pulse">
                                        ✨
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-extrabold text-arabian-night">
                                            {t('learning_hub.analysis_not_ready', 'AI 智能诊断画像未生成')}
                                        </p>
                                        <p className="text-xs text-arabian-night/50 max-w-sm font-semibold leading-relaxed">
                                            {t('learning_hub.analysis_not_ready_desc', '系统正在自动生成录音画像。AI 将深入诊断说话比例、语速、异议处理与情绪走势。')}
                                        </p>
                                    </div>
                                    
                                    {/* Generate Button strictly for TL and above */}
                                    {(profile?.role === 'super_admin' || profile?.role === 'sd' || profile?.role === 'sm' || profile?.role === 'tl' || isSuperAdmin) && (
                                        <button
                                            type="button"
                                            onClick={() => handleTriggerAnalysis(false)}
                                            disabled={isAnalyzing}
                                            className="bg-gradient-to-r from-desert-gold to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer focus:outline-none"
                                        >
                                            <span>
                                                {i18n.language?.startsWith('ar')
                                                    ? '✨ بدء تحليل المكالمة بالذكاء الاصطناعي'
                                                    : i18n.language?.startsWith('en')
                                                        ? '✨ Start AI Call Portrait'
                                                        : t('learning_hub.generate_analysis', '启动 AI 通话体检')}
                                            </span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 3: Interactive Q&A & Pinned Timeline Comments */}
                    {activeModalTab === 'comments' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Comment Input Card */}
                            <form onSubmit={handleAddComment} className="glass-panel p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex gap-3 items-start hover:shadow-md transition-shadow">
                                <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden bg-gradient-to-br from-desert-gold to-yellow-600 flex items-center justify-center text-white text-xs font-bold shadow-inner">
                                    {profile?.avatarUrl ? (
                                        <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-4 h-4" />
                                    )}
                                </div>
                                <div className="flex-1 flex flex-col gap-2">
                                    <textarea
                                        value={newCommentText}
                                        onChange={(e) => setNewCommentText(e.target.value)}
                                        placeholder={t('learning_hub.comment_placeholder', '分享你的学习心得、感悟，或针对本录音提出您的问题...')}
                                        className="w-full min-h-[70px] max-h-[140px] text-sm p-3 border border-gray-100 bg-gray-50/50 rounded-xl outline-none focus:ring-2 focus:ring-deep-teal focus:bg-white resize-y font-medium text-arabian-night/90 placeholder:text-arabian-night/40"
                                    />
                                    <div className="flex justify-between items-center mt-1">
                                        <label className="flex items-center gap-1.5 text-xs text-arabian-night/60 cursor-pointer font-bold select-none hover:text-deep-teal transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={attachTimestamp}
                                                onChange={(e) => setAttachTimestamp(e.target.checked)}
                                                className="rounded text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span>⏱️ {t('learning_hub.attach_timestamp', '关联当前播放时间')} ({formatTime(modalCurrentTime)})</span>
                                        </label>
                                        <button 
                                            type="submit"
                                            disabled={!newCommentText.trim()}
                                            className="bg-gradient-to-r from-deep-teal to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                                        >
                                            <Send className="w-3 h-3" />
                                            {t('common.submit', '提交评论')}
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {/* Comments Thread List */}
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                                {comments.filter(c => c.parentId === null).length === 0 ? (
                                    <div className="text-center py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                                        <p className="text-sm font-semibold text-arabian-night/40">💬 {t('learning_hub.no_comments_yet', '暂无互动讨论，快来发表第一条观点吧！')}</p>
                                    </div>
                                ) : (
                                    comments.filter(c => c.parentId === null).map((comment) => {
                                        const isFlagged = comment.status === 'flagged';
                                        const isCommentLiked = comment.likes?.includes(user?.uid || '');
                                        const userLikesCount = comment.likes?.length || 0;
                                        
                                        // Filter replies for this parent
                                        const replies = comments.filter(r => r.parentId === comment.id);

                                        return (
                                            <div key={comment.id} className={`p-4 rounded-2xl border transition-all duration-300 ${
                                                comment.isPinned 
                                                    ? 'bg-gradient-to-r from-desert-gold/5 via-amber-500/[0.02] to-transparent border-desert-gold/30 shadow-sm'
                                                    : 'bg-gray-50/30 border-gray-100/70 hover:border-gray-200/50'
                                            }`}>
                                                {/* Primary Comment Header */}
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex gap-2.5 items-center">
                                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 border border-gray-100 flex items-center justify-center shadow-inner">
                                                            {comment.userAvatar ? (
                                                                <img src={comment.userAvatar} alt={comment.userName} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-gradient-to-br from-desert-gold to-yellow-600 flex items-center justify-center text-white text-xs font-bold font-serif uppercase">
                                                                    {comment.userName.charAt(0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-black text-arabian-night/90">{comment.userName}</span>
                                                                {comment.userTeam && (
                                                                    <span className="text-[8px] font-bold text-arabian-night/50 bg-white border border-gray-100 px-1.5 py-0.5 rounded-full leading-none">{comment.userTeam}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-arabian-night/40 font-medium">
                                                                {comment.createdAt?.toDate?.()?.toLocaleString() || t('common.just_now', '刚刚')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Pinned Crown info */}
                                                    <div className="flex items-center gap-1.5">
                                                        {comment.isPinned && (
                                                            <span className="text-[9px] bg-gradient-to-r from-desert-gold to-yellow-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5 animate-pulse select-none">
                                                                📌 {t('learning_hub.featured_comment', '置顶精选')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Primary Comment Content */}
                                                {isFlagged ? (
                                                    <div className="bg-amber-500/5 border border-dashed border-amber-500/25 rounded-xl p-3 my-2 text-center text-xs text-amber-800 font-semibold select-none">
                                                        👁️ {t('learning_hub.comment_under_moderation', '该互动内容已被安全举报，正在由系统管理员审核中...')}
                                                    </div>
                                                ) : (
                                                    <div className="pl-10 space-y-1">
                                                        {comment.timestamp !== undefined && comment.timestamp !== null && (
                                                            <button
                                                                type="button"
                                                                onClick={() => jumpToTime(comment.timestamp)}
                                                                className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-desert-gold/15 hover:bg-desert-gold/25 text-yellow-800 border border-desert-gold/30 rounded-md px-1.5 py-0.5 transition-colors cursor-pointer select-none mb-1.5 focus:outline-none"
                                                                title={t('learning_hub.click_to_seek', '点击跳转播放')}
                                                            >
                                                                ⏱️ {formatTime(comment.timestamp)}
                                                            </button>
                                                        )}
                                                        <p className="text-sm text-arabian-night/85 leading-relaxed font-medium whitespace-pre-line break-words">
                                                            {comment.content}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Primary Comment Actions */}
                                                <div className="flex gap-4 items-center mt-3 pl-10 text-[11px] font-bold text-arabian-night/50">
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleLikeComment(comment.id, comment.likes || [])}
                                                        disabled={isFlagged}
                                                        className={`flex items-center gap-1 transition-colors hover:text-deep-teal ${isCommentLiked ? 'text-deep-teal scale-105 font-black' : ''}`}
                                                    >
                                                        <ThumbsUp className={`w-3.5 h-3.5 ${isCommentLiked ? 'fill-deep-teal text-deep-teal' : ''}`} />
                                                        <span>{userLikesCount} {t('common.like', '赞')}</span>
                                                    </button>

                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            if (replyToId === comment.id) {
                                                                setReplyToId(null);
                                                            } else {
                                                                setReplyToId(comment.id);
                                                                setReplyText('');
                                                            }
                                                        }}
                                                        disabled={isFlagged}
                                                        className={`flex items-center gap-1 transition-colors hover:text-desert-gold ${replyToId === comment.id ? 'text-desert-gold' : ''}`}
                                                    >
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                        <span>{t('learning_hub.reply', '回复')} ({replies.length})</span>
                                                    </button>

                                                    {/* Report/Flag button */}
                                                    {!isFlagged && comment.userId !== user?.uid && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleFlagComment(comment.id)}
                                                            className="flex items-center gap-1 transition-colors hover:text-red-500 ml-auto"
                                                            title={t('learning_hub.report', '举报不妥言论')}
                                                        >
                                                            <Flag className="w-3 h-3" />
                                                            <span>{t('learning_hub.report', '举报')}</span>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Inline Reply Input Box */}
                                                {replyToId === comment.id && (
                                                    <form onSubmit={(e) => handleAddReply(e, comment.id)} className="mt-3.5 pl-10 flex gap-2 items-start animate-in slide-in-from-top-2 duration-300">
                                                        <textarea
                                                            value={replyText}
                                                            onChange={(e) => setReplyText(e.target.value)}
                                                            placeholder={t('learning_hub.reply_placeholder', '回复该心得观点...')}
                                                            className="flex-1 min-h-[40px] text-xs p-2.5 border border-gray-100 bg-white rounded-xl outline-none focus:ring-1 focus:ring-deep-teal font-medium text-arabian-night/90"
                                                        />
                                                        <div className="flex flex-col gap-1.5">
                                                            <button 
                                                                type="submit"
                                                                disabled={!replyText.trim()}
                                                                className="bg-gradient-to-r from-deep-teal to-teal-700 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-lg active:scale-95 transition-all disabled:opacity-40"
                                                            >
                                                                {t('common.send', '发送')}
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => setReplyToId(null)}
                                                                className="bg-gray-100 text-arabian-night/60 text-[10px] font-extrabold px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                                                            >
                                                                {t('common.cancel', '取消')}
                                                            </button>
                                                        </div>
                                                    </form>
                                                )}

                                                {/* Secondary Indented Reply List */}
                                                {replies.length > 0 && (
                                                    <div className="mt-3.5 pl-10 border-l-2 border-gray-100 space-y-3">
                                                        {replies.map((reply) => {
                                                            const isReplyFlagged = reply.status === 'flagged';
                                                            const isReplyLiked = reply.likes?.includes(user?.uid || '');

                                                            return (
                                                                <div key={reply.id} className="p-3 bg-white/40 border border-gray-50 rounded-xl hover:border-gray-100/50 transition-all duration-300">
                                                                    <div className="flex justify-between items-center mb-1">
                                                                        <div className="flex gap-2 items-center">
                                                                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center shadow-inner text-[10px]">
                                                                                {reply.userAvatar ? (
                                                                                    <img src={reply.userAvatar} alt={reply.userName} className="w-full h-full object-cover" />
                                                                                ) : (
                                                                                    <div className="w-full h-full bg-gradient-to-br from-desert-gold to-yellow-600 flex items-center justify-center text-white text-[8px] font-bold font-serif uppercase">
                                                                                        {reply.userName.charAt(0)}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div>
                                                                                <div className="flex items-center gap-1">
                                                                                    <span className="text-[11px] font-black text-arabian-night/90">{reply.userName}</span>
                                                                                </div>
                                                                                <span className="text-[8px] text-arabian-night/35 font-medium">
                                                                                    {reply.createdAt?.toDate?.()?.toLocaleString() || t('common.just_now', '刚刚')}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {isReplyFlagged ? (
                                                                        <div className="bg-amber-500/5 border border-dashed border-amber-500/15 rounded-lg p-2 my-1 text-center text-[10px] text-amber-800 font-semibold select-none">
                                                                            👁️ {t('learning_hub.comment_under_moderation', '已被举报送审...')}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-arabian-night/80 pl-8 leading-relaxed font-semibold break-words">
                                                                            {reply.content}
                                                                        </p>
                                                                    )}

                                                                    <div className="flex gap-3 items-center mt-1.5 pl-8 text-[10px] font-bold text-arabian-night/40">
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => handleLikeComment(reply.id, reply.likes || [])}
                                                                            disabled={isReplyFlagged}
                                                                            className={`flex items-center gap-0.5 hover:text-deep-teal ${isReplyLiked ? 'text-deep-teal font-black' : ''}`}
                                                                        >
                                                                            <ThumbsUp className="w-3 h-3" />
                                                                            <span>{reply.likes?.length || 0}</span>
                                                                        </button>

                                                                        {!isReplyFlagged && reply.userId !== user?.uid && (
                                                                            <button 
                                                                                type="button"
                                                                                onClick={() => handleFlagComment(reply.id)}
                                                                                className="flex items-center gap-0.5 hover:text-red-500 ml-auto"
                                                                                title={t('learning_hub.report', '举报不妥言论')}
                                                                            >
                                                                                <Flag className="w-2.5 h-2.5" />
                                                                                <span>{t('learning_hub.report', '举报')}</span>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                    </div>
                    </div>

                    {/* Right Panel: Associated Attachments Sidebar */}
                    {rec.attachments && rec.attachments.length > 0 && (
                        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50/30 flex flex-col p-6 shrink-0 lg:max-h-[80vh] overflow-y-auto">
                            <h3 className="text-sm font-extrabold text-deep-teal mb-4 flex items-center gap-1.5 shrink-0 select-none">
                                <FileText className="w-4 h-4 text-desert-gold" />
                                {t('common.attachments', '配套讲义与附件')}
                            </h3>
                            <div className="space-y-3">
                                {rec.attachments.map((att: any) => {
                                    const isSelected = selectedAttachment && (selectedAttachment.id === att.id || selectedAttachment.url === att.url);
                                    const fileType = getAttachmentType(att.url);
                                    return (
                                        <div 
                                            key={att.id || att.url} 
                                            onClick={() => setSelectedAttachment(att)}
                                            className={`rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all group cursor-pointer ${
                                                isSelected 
                                                    ? 'bg-amber-50/60 border-2 border-desert-gold/50 shadow-inner ring-1 ring-desert-gold/10' 
                                                    : 'bg-white border border-gray-100/80 hover:border-desert-gold/20'
                                            }`}
                                        >
                                            <div className="flex items-start gap-2.5 min-w-0">
                                                <span className="text-2xl shrink-0 select-none" role="img" aria-label="file">
                                                    {fileType === 'ppt' ? '📊' : fileType === 'pdf' ? '📕' : fileType === 'image' ? '🖼️' : '📄'}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`font-extrabold text-xs line-clamp-2 pr-1 transition-colors ${
                                                        isSelected ? 'text-yellow-800' : 'text-arabian-night'
                                                    }`} title={att.name}>
                                                        {att.name}
                                                    </p>
                                                    <span className="text-[10px] font-bold text-arabian-night/40 mt-1 inline-block">
                                                        {att.size || '-'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-2 w-full mt-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedAttachment(att);
                                                    }}
                                                    className={`flex-1 text-center py-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 transition-all ${
                                                        isSelected 
                                                            ? 'bg-desert-gold text-white shadow-md shadow-desert-gold/10' 
                                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                                    }`}
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>{t('learning_hub.preview_attachment', '预览')}</span>
                                                </button>
                                                
                                                <a
                                                    href={att.url}
                                                    download={att.name}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex-1 bg-deep-teal/5 hover:bg-deep-teal hover:text-white text-deep-teal text-center py-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-[0.98]"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    <span>{t('common.download_attachment', '下载')}</span>
                                                </a>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
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

interface DirectTranscriptModalProps {
    rec: Recording;
    onClose: () => void;
}

const DirectTranscriptModal = ({ rec: initialRec, onClose }: DirectTranscriptModalProps) => {
    const { t } = useTranslation();
    const { profile } = useAuth();
    const isSDLevel = profile?.role === 'sd' || profile?.role === 'super_admin';
    const isVideo = isVideoUrl(initialRec.audioUrl);
    const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
    const [activeTab, setActiveTab] = useState<'arabic' | 'chinese'>('arabic');
    const [transcriptZh, setTranscriptZh] = useState<string>(initialRec.transcriptZh || '');
    const [loadingTranslation, setLoadingTranslation] = useState(false);

    const [rec, setRec] = useState<any>(initialRec);

    if (isVideo && !isSDLevel) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-4 animate-in zoom-in duration-300">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto text-[#006d77]">
                        🔒
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">{t('learning_hub.no_permission', '暂无访问权限')}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-semibold">
                        {t('learning_hub.video_transcript_permission_tip', '视频物料的阿语逐字稿仅供 SD 总监及以上层级查阅。')}
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-deep-teal text-white rounded-xl font-bold hover:bg-deep-teal/90 transition-colors shadow-sm cursor-pointer"
                    >
                        {t('common.close', '关闭')}
                    </button>
                </div>
            </div>
        );
    }

    React.useEffect(() => {
        setRec(initialRec);
    }, [initialRec]);

    React.useEffect(() => {
        if (!initialRec?.id) return;
        const unsub = onSnapshot(doc(db, 'recordings', initialRec.id), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setRec({ id: snapshot.id, ...data });
                if (data && data.transcriptZh) {
                    setTranscriptZh(data.transcriptZh);
                }
            }
        });
        return () => unsub();
    }, [initialRec?.id]);

    useEffect(() => {
        if (rec.transcriptZh && !transcriptZh) {
            setTranscriptZh(rec.transcriptZh);
            return;
        }

        if (activeTab === 'chinese' && !transcriptZh && !rec.transcriptZh && isSDLevel) {
            setLoadingTranslation(true);
            fetch('/.netlify/functions/translate-transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recordingId: rec.id,
                    title: rec.title,
                    description: rec.description,
                    lecturerName: rec.lecturerName,
                    categoryName: rec.categoryName,
                    displayId: rec.displayId,
                    transcript: rec.transcript
                })
            })
            .then(res => {
                if (!res.ok) throw new Error("HTTP error " + res.status);
                return res.json();
            })
            .then(data => {
                if (data.success && data.transcriptZh) {
                    setTranscriptZh(data.transcriptZh);
                    rec.transcriptZh = data.transcriptZh;
                } else {
                    throw new Error(data.error || "Failed to translate");
                }
            })
            .catch(err => {
                console.error("Error loading translation:", err);
                setTranscriptZh(t('learning_hub.no_translation_available', '暂无中文对照翻译（翻译生成失败，请检查 API 配置或重试）'));
            })
            .finally(() => setLoadingTranslation(false));
        }
    }, [activeTab, rec.id, transcriptZh, rec.transcriptZh, isSDLevel, t]);

    const handleCopy = () => {
        const textToCopy = activeTab === 'chinese' ? transcriptZh : rec.transcript;
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy);
            alert(t('common.copied', '已复制到剪贴板！'));
        }
    };

    const handleDownload = () => {
        const textToDownload = activeTab === 'chinese' ? transcriptZh : rec.transcript;
        if (!textToDownload) return;
        const element = document.createElement("a");
        const file = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
        element.href = URL.createObjectURL(file);
        element.download = `${rec.title}_transcript_${activeTab}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const fontSizeClasses = {
        sm: 'text-xs md:text-sm',
        base: 'text-sm md:text-base',
        lg: 'text-base md:text-lg',
        xl: 'text-lg md:text-xl'
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop with rich blur */}
            <div 
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity duration-300"
                onClick={onClose}
            />
            
            {/* Modal Container */}
            <div className="relative w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 rounded-3xl border border-desert-gold/30 shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
                {/* Gold header accent line */}
                <div className="h-1.5 w-full bg-gradient-to-r from-deep-teal via-desert-gold to-deep-teal" />
                
                {/* Header */}
                <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-deep-teal dark:text-desert-gold">
                            <FileText className="w-5 h-5 text-desert-gold shrink-0 animate-pulse" />
                            <span className="text-xs font-black tracking-widest uppercase bg-desert-gold/10 px-2 py-0.5 rounded border border-desert-gold/25 select-none">
                                {t('learning_hub.arabic_transcript', '阿语逐字稿')}
                            </span>
                        </div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white line-clamp-1 leading-snug">
                            {rec.title}
                        </h3>
                        {rec.lecturerName && (
                            <p className="text-xs text-desert-gold font-bold flex items-center gap-1">
                                <User className="w-3.5 h-3.5 shrink-0" />
                                <span>{rec.lecturerName}</span>
                            </p>
                        )}
                    </div>
                    
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shadow-sm cursor-pointer active:scale-95 shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Font Size & Action Toolbar */}
                <div className="bg-slate-50/80 dark:bg-slate-800/40 px-6 py-3 border-b border-slate-100 dark:border-slate-800/60 flex flex-wrap justify-between items-center gap-4 select-none">
                    {/* Font size picker */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
                            {t('learning_hub.font_size', '字体大小')}:
                        </span>
                        {(['sm', 'base', 'lg', 'xl'] as const).map((size) => (
                            <button
                                key={size}
                                onClick={() => setFontSize(size)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                    fontSize === size
                                        ? 'bg-deep-teal border-deep-teal text-white shadow-sm'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                            >
                                {size === 'sm' ? 'A-' : size === 'base' ? 'A' : size === 'lg' ? 'A+' : 'A++'}
                            </button>
                        ))}
                    </div>

                    {/* Bilingual Translation Toggle */}
                    {isSDLevel && (
                        <div className="flex bg-gray-100 dark:bg-slate-700/60 p-0.5 rounded-lg text-xs font-semibold border border-gray-200/50 select-none">
                            <button
                                onClick={() => setActiveTab('arabic')}
                                className={`px-3 py-1.5 rounded-md transition-all duration-200 cursor-pointer ${
                                    activeTab === 'arabic'
                                        ? 'bg-white dark:bg-slate-800 text-deep-teal shadow-sm border border-gray-200/20'
                                        : 'text-gray-400 dark:text-slate-400 hover:text-gray-600'
                                }`}
                            >
                                🌐 {t('learning_hub.original_transcript_ar', 'Original (العربية)')}
                            </button>
                            <button
                                onClick={() => setActiveTab('chinese')}
                                className={`px-3 py-1.5 rounded-md transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                                    activeTab === 'chinese'
                                        ? 'bg-white dark:bg-slate-800 text-deep-teal shadow-sm border border-gray-200/20'
                                        : 'text-gray-400 dark:text-slate-400 hover:text-gray-600'
                                }`}
                            >
                                🇨🇳 {t('learning_hub.chinese_transcript_zh', '中文翻译')}
                            </button>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                            <BookOpen className="w-3.5 h-3.5 text-desert-gold" />
                            <span>{t('common.copy', '复制')}</span>
                        </button>
                        
                        <button
                            onClick={handleDownload}
                            className="bg-gradient-to-r from-deep-teal to-[#005f66] hover:shadow-[0_3px_10px_rgba(0,109,119,0.15)] text-white text-xs font-bold py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer border border-white/10"
                        >
                            <Download className="w-3.5 h-3.5 text-white" />
                            <span>{t('common.download', '下载')}</span>
                        </button>
                    </div>
                </div>
                
                {/* Transcript Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-950/20 flex flex-col">
                    {activeTab === 'chinese' && loadingTranslation ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500 gap-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-desert-gold" />
                            <span className="text-xs font-bold animate-pulse">{t('learning_hub.generating_translation', '正在智能生成中文对照翻译...')}</span>
                        </div>
                    ) : (
                        <div 
                            className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-sm leading-relaxed whitespace-pre-line ${
                                activeTab === 'chinese' ? 'text-left text-slate-800 dark:text-slate-100 font-sans' : 'text-right font-medium text-slate-800 dark:text-slate-100'
                            } ${fontSizeClasses[fontSize]}`}
                            dir={activeTab === 'chinese' ? 'ltr' : 'rtl'}
                            style={{ 
                                fontFamily: activeTab === 'chinese' 
                                    ? "'Inter', 'Noto Sans SC', sans-serif" 
                                    : "'Noto Sans Arabic', 'Inter', sans-serif" 
                            }}
                        >
                            {activeTab === 'chinese' ? (transcriptZh || t('learning_hub.no_translation_available', '暂无中文对照翻译')) : rec.transcript}
                        </div>
                    )}
                </div>
                
                {/* Footer warning */}
                <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800 text-center select-none">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-wide flex items-center justify-center gap-1">
                        🔒 {isSDLevel ? t('learning_hub.sd_translation_notice', '🔒 SD 总监层级以上特权：中文对照翻译通道已激活') : t('learning_hub.tl_bypass_notice', 'TL/SM 管理层免审阅直看通道已激活')}
                    </p>
                </div>
            </div>
        </div>
    );
};

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
                            {policy.section === 'brand'
                                ? (policy.type === 'document' ? t('policy_showcase.brand_doc_badge', '📄 品牌文档') : policy.type === 'poster' ? t('policy_showcase.brand_poster_badge', '🖼️ 品牌海报') : t('policy_showcase.brand_video_badge', '🎥 宣导视频'))
                                : (policy.type === 'document' ? t('policy_showcase.doc_policy', '📄 文档政策') : policy.type === 'poster' ? t('policy_showcase.poster_incentive', '🖼️ 激励海报') : t('policy_showcase.video_promo', '🎥 宣导视频'))
                            }
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-deep-teal/10 text-deep-teal font-bold rounded-full">
                            {policy.targetTeam ? (
                                policy.targetTeam === 'all' 
                                    ? t('policy_showcase.visible_to_all', '全部可见') 
                                    : t('policy_showcase.team_exclusive', '{{team}} 团队专属', { team: policy.targetTeam })
                            ) : (
                                policy.businessType === 'all' 
                                    ? t('common.all_business', '全部业务线') 
                                    : policy.businessType === 'kid' 
                                        ? t('common.team_kcc_clean', 'KCC 青少') 
                                        : policy.businessType === 'adult' 
                                            ? t('common.team_adult_clean', 'ACC 成人') 
                                            : policy.businessType === 'ss' 
                                                ? t('common.team_ss_clean', 'SS 团队') 
                                                : t('common.leader_academy', 'Leader 学院')
                            )}
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
                                <h4 className="text-white font-bold text-lg">
                                    {policy.section === 'brand' ? t('policy_showcase.brand_doc_material_title', '品牌文档物料资料') : t('policy_showcase.doc_material_title', '运营文档政策资料')}
                                </h4>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    {policy.section === 'brand' ? t('policy_showcase.brand_doc_material_desc', '该品牌物料为正式发布文档。点击下方按钮打开并仔细阅读物料细则。') : t('policy_showcase.doc_material_desc', '该政策为正式发布文档（通常为PDF或专用政策公告网页）。点击下方按钮打开并仔细研读政策细则。')}
                                </p>
                            </div>
                            <a 
                                href={policy.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="bg-gradient-to-r from-deep-teal to-[#005f66] hover:shadow-[0_4px_15px_rgba(0,109,119,0.3)] text-white px-8 py-3.5 rounded-xl font-extrabold shadow-md flex items-center gap-2 hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer border border-white/10"
                            >
                                <BookOpen className="w-5 h-5 text-desert-gold" />
                                {policy.section === 'brand' ? t('policy_showcase.brand_open_doc', '打开品牌文档') : t('policy_showcase.open_doc', '打开政策文档')}
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

// Localized Translation Helper for Honor Reward System
const localT = (key: string, defaultVal: string, i18n: any) => {
    const lang = i18n?.language || 'zh';
    const dict: Record<string, Record<string, string>> = {
        zh: {
            'learning_hub.tab_recordings': '录音广场',
            'learning_hub.tab_policies': '政策激励',
            'learning_hub.tab_brands': '品牌专栏',
            'learning_hub.view_honor_detail': '查看荣誉详情',
            'learning_hub.view_rules_detail': '查看详细规则说明',
            'learning_hub.rules_title_modal': '绿洲学习荣誉机制',
            'learning_hub.coffee_streak': '每日咖啡连击',
            'learning_hub.caravan_progress': '沙漠商队行进进度',
            'learning_hub.next_oasis': '下一绿洲',
            'learning_hub.max_level': '最高荣誉',
            'learning_hub.view_honor_cert': '查看荣誉勋章与证书',
            'learning_hub.cert_subtitle': '荣誉称号授予以下杰出学员',
            'learning_hub.cert_main_body': '鉴于该学员在学习中心表现卓越，累计学时充沛，任务执行精准，特授予中东卓越销售激励荣誉头衔 ——',
            'learning_hub.cert_slogan': '沙海无边，智者为帆。愿纯种马与凌空飞鹰的卓越精神伴您常在，再创销售巅峰！',
            'learning_hub.cert_issue_date': '签发日期',
            'learning_hub.cert_authorized_by': '认证机构',
            'learning_hub.cert_downloading': '荣誉证书下载中... 已自动存入您的相册。',
            'learning_hub.cert_download': '保存证书至相册',
            'learning_hub.cert_share_whatsapp': '分享至 WhatsApp',
            'common.days': '天',
            'common.minutes': '分钟',
            'learning_hub.streak_active_tooltip': '第 {day} 天已学习',
            'learning_hub.streak_inactive_tooltip': '第 {day} 天未打卡',
            'learning_hub.next_oasis_tooltip': '下一站绿洲：{title}',
            'learning_hub.view_rules': '规则说明',
            'learning_hub.rules_title': '绿洲荣誉机制规则说明',
            'learning_hub.rules_streak_title': '每日咖啡连击',
            'learning_hub.rules_streak_desc': '每天学习任一课程即可完成今日打卡，连续打卡可累积咖啡连击天数。',
            'learning_hub.rules_caravan_title': '沙漠商队进度',
            'learning_hub.rules_caravan_desc': '累积有效学习时长（分钟），商队将向下一个绿洲进发。学时与任务完成率达到门槛即可解锁更高荣誉等级。',
            'learning_hub.rules_cert_title': '荣誉勋章与证书',
            'learning_hub.rules_cert_desc': '解锁每个荣誉等级均可获得 51Talk 官方认证的荣誉证书，可下载并分享至社交媒体。',
            'learning_hub.rules_levels_title': '荣誉等级门槛：',
            'learning_hub.team_dashboard_title': '👥 团队学习激励与荣誉大盘',
            'learning_hub.member_name': '成员姓名',
            'learning_hub.team_empty': '当前团队暂无其他成员数据',
            'level.apprentice.title': '绿洲学徒',
            'level.apprentice.desc': '知识灌溉的起点，迈出卓越销售的第一步。',
            'level.voyager.title': '沙漠行者',
            'level.voyager.desc': '在沙海中坚韧前行，以毅力累积智慧。',
            'level.knight.title': '智慧骑士',
            'level.knight.desc': '出众的执行力与精准度，执行如同骑士般果断。',
            'level.falcon.title': '凌空猎鹰',
            'level.falcon.desc': '高瞻远瞩，锐意进取，在团队中脱颖而出。',
            'level.guardian.title': '绿洲守护者',
            'level.guardian.desc': '福泽团队，慷慨分享，成为智慧的终极灯塔。'
        },
        en: {
            'learning_hub.tab_recordings': 'Recordings',
            'learning_hub.tab_policies': 'Policies & Incentives',
            'learning_hub.tab_brands': 'Marketing Brands',
            'learning_hub.view_honor_detail': 'View Details',
            'learning_hub.view_rules_detail': 'View Detailed Rules',
            'learning_hub.rules_title_modal': 'Treasure Hunters Honor System',
            'learning_hub.coffee_streak': 'Daily Coffee Streak',
            'learning_hub.caravan_progress': 'Treasure Hunt Progress',
            'learning_hub.next_oasis': 'Next Target',
            'learning_hub.max_level': 'Max Honor',
            'learning_hub.view_honor_cert': 'View Badges & Honor Certificate',
            'learning_hub.cert_subtitle': 'HONOR CERTIFICATE AWARDED TO',
            'learning_hub.cert_main_body': 'For outstanding learning perseverance, consistent daily habits, and exceptional execution in the Learning Hub, this Middle Eastern sales honor title is proudly conferred:',
            'learning_hub.cert_slogan': '"The desert is vast, but wisdom is the sail. May the spirit of the Arabian horse and soaring falcon accompany you to new sales peaks!"',
            'learning_hub.cert_issue_date': 'Issue Date',
            'learning_hub.cert_authorized_by': 'Authorized By',
            'learning_hub.cert_downloading': 'Downloading honor certificate... Saved to your library.',
            'learning_hub.cert_download': 'Save Certificate to Library',
            'learning_hub.cert_share_whatsapp': 'Share on WhatsApp',
            'common.days': 'days',
            'common.minutes': 'mins',
            'learning_hub.streak_active_tooltip': 'Day {day} Completed',
            'learning_hub.streak_inactive_tooltip': 'Day {day} Incomplete',
            'learning_hub.next_oasis_tooltip': 'Next Target: {title}',
            'learning_hub.view_rules': 'Rules',
            'learning_hub.rules_title': 'Treasure Hunters Honor Rules',
            'learning_hub.rules_streak_title': 'Daily Coffee Streak',
            'learning_hub.rules_streak_desc': 'Study any course daily to complete your check-in and accumulate coffee streak days.',
            'learning_hub.rules_caravan_title': 'Treasure Hunt Journey',
            'learning_hub.rules_caravan_desc': 'Accumulate learning minutes to advance your path towards the next treasure level. Meeting thresholds for both study time and task completion rate unlocks higher honor tiers.',
            'learning_hub.rules_cert_title': 'Badges & Certificates',
            'learning_hub.rules_cert_desc': 'Unlock each tier to receive an official 51Talk certificate, ready to download and share.',
            'learning_hub.rules_levels_title': 'Honor Tiers & Thresholds:',
            'learning_hub.team_dashboard_title': '👥 Team Learning Incentives & Honor Dashboard',
            'learning_hub.member_name': 'Member',
            'learning_hub.team_empty': 'No team member data available',
            'level.apprentice.title': 'Treasure Seeker',
            'level.apprentice.desc': 'Begin your quest, seeking out valuable sales knowledge in the desert.',
            'level.voyager.title': 'Desert Tracker',
            'level.voyager.desc': 'Uncovering pathways in the sands, tracking down key success insights.',
            'level.knight.title': 'Petra Pathfinder',
            'level.knight.desc': 'Finding the hidden entry to the rose city, unlocking premium skills.',
            'level.falcon.title': 'Elite Hunter',
            'level.falcon.desc': 'Recovering legendary treasures, demonstrating masterful execution.',
            'level.guardian.title': 'Al-Khazneh Legend',
            'level.guardian.desc': 'Entering the inner chamber of Petra, crowned as the ultimate success champion.',
            'learning_hub.incentive_explain_line': '🏆 Treasure Hunters: Listen to recordings to search for wisdom. Meet thresholds to unlock 51Talk certificates & Al-Khazneh rewards (Click to view details).'
        },
        ar: {
            'learning_hub.tab_recordings': 'ساحة التسجيلات',
            'learning_hub.tab_policies': 'السياسات والحوافز',
            'learning_hub.tab_brands': 'ركن العلامة التجارية',
            'learning_hub.view_honor_detail': 'عرض التفاصيل',
            'learning_hub.view_rules_detail': 'عرض القواعد التفصيلية',
            'learning_hub.rules_title_modal': 'نظام أوسمة صائدي الكنز',
            'learning_hub.coffee_streak': 'تحدي القهوة اليومي',
            'learning_hub.caravan_progress': 'مسار البحث عن الكنز',
            'learning_hub.next_oasis': 'الهدف التالي',
            'learning_hub.max_level': 'المرتبة القصوى',
            'learning_hub.view_honor_cert': 'عرض أوسمة وشهادة الشرف',
            'learning_hub.cert_subtitle': 'شهادة شرف وتقدير تمنح لـ',
            'learning_hub.cert_main_body': 'تقديراً للمثابرة المتميزة في التعلم والعادات اليومية المتسقة والتنفيذ الاستثنائي في مركز التعلم، تُمنح هذه الشهادة الفخرية:',
            'learning_hub.cert_slogan': '"الصحراء واسعة، لكن الحكمة هي الشراع. نرجو أن تلازمك روح الفرس الأصيل والصقر المحلق لتحقيق قمم مبيعات جديدة!"',
            'learning_hub.cert_issue_date': 'تاريخ الإصدار',
            'learning_hub.cert_authorized_by': 'الجهة المعتمدة',
            'learning_hub.cert_downloading': 'جاري تحميل شهادة الشرف... تم حفظها في ألبوم الصور الخاص بك.',
            'learning_hub.cert_download': 'حفظ الشهادة في ألبوم الصور',
            'learning_hub.cert_share_whatsapp': 'مشاركة عبر واتساب',
            'common.days': 'أيام',
            'common.minutes': 'دقيقة',
            'learning_hub.streak_active_tooltip': 'تم التعلم في اليوم {day}',
            'learning_hub.streak_inactive_tooltip': 'لم يتم تسجيل التعلم في اليوم {day}',
            'learning_hub.next_oasis_tooltip': 'الهدف التالي: {title}',
            'learning_hub.view_rules': 'القواعد',
            'learning_hub.rules_title': 'قواعد شرف صائدي الكنز',
            'learning_hub.rules_streak_title': 'تحدي القهوة اليومي',
            'learning_hub.rules_streak_desc': 'ادرس أي دورة يوميًا لإكمال تسجيل حضورك وتجميع أيام تحدي القهوة المتتالية.',
            'learning_hub.rules_caravan_title': 'رحلة البحث عن الكنوز',
            'learning_hub.rules_caravan_desc': 'اجمع دقائق التعلم الفعلية لتحريك فريقك نحو الكنز التالي. الحصول على ساعات تعلم كافية ومعدل إكمال المهام يفتح مراتب شرف أعلى.',
            'learning_hub.rules_cert_title': 'الأوسمة والشهادات',
            'learning_hub.rules_cert_desc': 'افتح كل مرتبة للحصول على شهادة شرف رسمية من 51Talk، جاهزة للتحميل والمشاركة.',
            'learning_hub.rules_levels_title': 'مراتب الشرف ومتطلباتها:',
            'learning_hub.team_dashboard_title': '👥 لوحة مكافآت الشرف والتعلم للفريق',
            'learning_hub.member_name': 'العضو',
            'learning_hub.team_empty': 'لا توجد بيانات لأعضاء الفريق حالياً',
            'level.apprentice.title': 'باحث عن الكنز',
            'level.apprentice.desc': 'ابدأ مسعاك، وابحث عن المعرفة القيمة للمبيعات في الصحراء.',
            'level.voyager.title': 'مقتفي أثر الصحراء',
            'level.voyager.desc': 'كشف المسارات في الرمال، وتتبع الرؤى الرئيسية للنجاح.',
            'level.knight.title': 'مستكشف البتراء',
            'level.knight.desc': 'العثور على المدخل الخفي للمدينة الوردية، وفتح المهارات المميزة.',
            'level.falcon.title': 'صائد الكنوز النخبة',
            'level.falcon.desc': 'استعادة الكنوز الأسطورية، وإظهار مهارة فائقة في التنفيذ.',
            'level.guardian.title': 'أسطورة الخزنة',
            'level.guardian.desc': 'دخول الغرفة الداخلية للبتراء، والتتويج كبطل النجاح المطلق.',
            'learning_hub.incentive_explain_line': '🏆 صائدو الكنوز: استمع إلى التسجيلات للبحث عن الحكمة. حقق المتطلبات لفتح شهادات أكاديمية نجاح ومكافآت الخزنة (اضغط لعرض التفاصيل).'
        }
    };

    const activeLang = lang.startsWith('ar') ? 'ar' : lang.startsWith('en') ? 'en' : 'zh';
    return dict[activeLang][key] || defaultVal;
};

export default function LearningHub() {
    const { t, i18n } = useTranslation();
    const { user, profile, isLeader, userTeam } = useAuth();
    const isSDLevel = profile?.role === 'sd' || profile?.role === 'super_admin';
    const isNative = Capacitor.isNativePlatform();
    const [showCertificate, setShowCertificate] = useState(false);
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeTab, setActiveTab] = useState<string>('all');

    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [sortType, setSortType] = useState<'latest' | 'popular' | 'leaderboard'>('latest');
    const [businessType, setBusinessType] = useState<'kid' | 'adult' | 'ss' | 'leader'>('kid');
    const [displayCount, setDisplayCount] = useState(12);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
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
    
    const [banners, setBanners] = useState<Banner[]>([]);
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
    const [previewSmFilter, setPreviewSmFilter] = useState<string>('all');
    const [smListForPreview, setSmListForPreview] = useState<string[]>([]);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [showRulesModal, setShowRulesModal] = useState(false);
    const [showHonorModal, setShowHonorModal] = useState(false);
    const [plazaMode, setPlazaMode] = useState<'recordings' | 'policies' | 'brands'>('recordings');
    
    // Ensure Web client only displays recordings mode (hiding policies/brands tabs)
    useEffect(() => {
        if (!isNative && plazaMode !== 'recordings') {
            setPlazaMode('recordings');
        }
    }, [isNative, plazaMode]);
    const [rawFavorites, setRawFavorites] = useState<{ userId: string; recordingIds: string[] }[]>([]);
    const [hubScope, setHubScope] = useState<'public' | 'team'>(() => {
        const paramScope = searchParams.get('scope');
        return (paramScope === 'team') ? 'team' : 'public';
    });
    const [activeSmId, setActiveSmId] = useState<string>(() => {
        return searchParams.get('smId') || '';
    });
    
    const allowedTabs = React.useMemo(() => {
        const tabs: { type: 'kid' | 'adult' | 'ss' | 'leader' | 'referral'; label: string; gradient: string }[] = [];
        
        // If not a leader (TL and above), do not show any business tabs/badges
        if (!isLeader) {
            return [];
        }

        // 1. If super admin, they have access to all tabs
        if (profile?.role === 'super_admin') {
            tabs.push({ type: 'kid', label: t('common.type_kid', '青少业务'), gradient: 'from-[#BD7F37] to-[#8C581F]' });
            tabs.push({ type: 'leader', label: t('common.type_leader', 'Leader 学院'), gradient: 'from-[#A83F2C] to-[#BD7F37]' });
            return tabs;
        }

        // 2. If SS department
        if (profile?.dep === 'SS') {
            tabs.push({ type: 'kid', label: t('common.type_kid', '青少业务'), gradient: 'from-[#BD7F37] to-[#8C581F]' });
            tabs.push({ type: 'leader', label: t('common.type_leader', 'Leader 学院'), gradient: 'from-[#A83F2C] to-[#BD7F37]' });
            return tabs;
        }

        // 3. For CC / standard departments
        tabs.push({ type: 'kid', label: t('common.type_kid', '青少业务'), gradient: 'from-[#BD7F37] to-[#8C581F]' });
        if (isLeader) {
            tabs.push({ type: 'leader', label: t('common.type_leader', 'Leader 学院'), gradient: 'from-[#A83F2C] to-[#BD7F37]' });
        }
        return tabs;
    }, [profile, isLeader, t]);
    
    // Leaderboard state
    const [allFavoritesCount, setAllFavoritesCount] = useState<Record<string, number>>({});
    const [leaderboardTab, setLeaderboardTab] = useState<'favorites' | 'likes'>('favorites');
    
    // Video Modal States
    const [activeVideoRecording, setActiveVideoRecording] = useState<Recording | null>(null);
    const [activeVideoDisableSeek, setActiveVideoDisableSeek] = useState(false);

    // Direct Transcript Modal State
    const [activeTranscriptRecording, setActiveTranscriptRecording] = useState<Recording | null>(null);

    // Share Poster Modal State
    const [shareRecording, setShareRecording] = useState<Recording | null>(null);

    // Global Comments Count Aggregator
    const [globalCommentCounts, setGlobalCommentCounts] = useState<Record<string, number>>({});
    const [policies, setPolicies] = useState<any[]>([]);
    const [activePolicyItem, setActivePolicyItem] = useState<any | null>(null);

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
        // Default to the first allowed tab or 'kid' as fallback
        if (allowedTabs.length > 0) {
            const allowedTypes = allowedTabs.map(t => t.type);
            if (!allowedTypes.includes(businessType as any)) {
                setBusinessType(allowedTypes[0] as any);
            }
        } else {
            setBusinessType('kid');
        }
        setActiveTab('all');
        setSelectedLecturer('');
    }, [profile, allowedTabs]);


    useEffect(() => {
        if (taskId && user) {
            const fetchTaskInfo = async () => {
                try {
                    const taskDoc = await getDoc(doc(db, 'learning_tasks', taskId));
                    if (taskDoc.exists()) {
                        const data = taskDoc.data();
                        setTaskRecordingIds(data.recordingIds || []);
                        setTaskTitle(data.title || '学习任务');
                        
                        const myUid = profile?.realUid || user.uid;
                        const myAssigneeData = data.assignees?.[myUid];
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
    }, [taskId, user, profile]);

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

                // Fetch Banners
                const bannerSnapshot = await getDocs(query(collection(db, 'banners'), where('active', '==', true)));
                const bannerData: Banner[] = [];
                bannerSnapshot.forEach(doc => {
                    const data = doc.data();
                    bannerData.push({
                        id: doc.id,
                        imageUrl: data.imageUrl || '',
                        title: data.title || '',
                        categoryId: data.categoryId || '',
                        categoryName: data.categoryName || '',
                        ownerSm: data.ownerSm || '',
                        ownerSmName: data.ownerSmName || '',
                        linkedTaskId: data.linkedTaskId || '',
                        linkedTaskTitle: data.linkedTaskTitle || '',
                        active: data.active !== false
                    });
                });
                setBanners(bannerData);
                
                // Get unique ownerSm values for preview scoping dropdown
                const previewSms = bannerData
                    .map(b => b.ownerSm)
                    .filter((v, i, a) => v && v !== 'global' && a.indexOf(v) === i);
                setSmListForPreview(previewSms);

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

                // Fetch All Users
                const usersSnapshot = await getDocs(collection(db, 'users'));
                const usersData: any[] = [];
                usersSnapshot.forEach(uDoc => {
                    usersData.push({ id: uDoc.id, ...uDoc.data() });
                });
                setSystemUsers(usersData);



                // Fetch All Favorites globally to calculate leaderboard
                const allFavSnapshot = await getDocs(collection(db, 'user_favorites'));
                const favCounts: Record<string, number> = {};
                const rawFavs: { userId: string; recordingIds: string[] }[] = [];
                allFavSnapshot.forEach(fDoc => {
                    const ids = fDoc.data().recordingIds || [];
                    rawFavs.push({
                        userId: fDoc.id,
                        recordingIds: ids
                    });
                    ids.forEach((id: string) => {
                        favCounts[id] = (favCounts[id] || 0) + 1;
                    });
                });
                setRawFavorites(rawFavs);
                setAllFavoritesCount(favCounts);

                // Fetch current User's Favorites
                if (user) {
                    const favDoc = await getDoc(doc(db, 'user_favorites', user.uid));
                    if (favDoc.exists()) {
                        setFavorites(favDoc.data().recordingIds || []);
                    }

                    // Fetch current User's learning history to populate completedAudioIds
                    const historyQ = query(
                        collection(db, 'learning_history'),
                        where('userId', '==', user.uid)
                    );
                    const historySnap = await getDocs(historyQ);
                    const completedIds: string[] = [];
                    historySnap.forEach(hDoc => {
                        const hData = hDoc.data();
                        if (hData.recordingId) {
                            completedIds.push(hData.recordingId);
                        }
                    });
                    setCompletedAudioIds(prev => Array.from(new Set([...prev, ...completedIds])));
                }
            } catch (error) {
                console.error("Error fetching data: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    useEffect(() => {
        if (targetRecordingId && recordings.length > 0) {
            const targetRec = recordings.find(r => r.id === targetRecordingId);
            if (targetRec && (!activeVideoRecording || activeVideoRecording.id !== targetRecordingId)) {
                setActiveVideoRecording(targetRec);
            }
        }
    }, [targetRecordingId, recordings, activeVideoRecording]);

    // Real-time listener for global comment counts aggregation
    useEffect(() => {
        const q = query(collection(db, 'comments'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const counts: Record<string, number> = {};
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.audioId && data.status !== 'deleted') {
                    counts[data.audioId] = (counts[data.audioId] || 0) + 1;
                }
            });
            setGlobalCommentCounts(counts);
        }, (error) => {
            console.error("Error loading global comment counts:", error);
        });
        return () => unsubscribe();
    }, []);

    // Real-time policies listener
    useEffect(() => {
        const q = query(
            collection(db, 'policies'),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                if (data.visible !== false) {
                    list.push({ id: docSnapshot.id, ...data });
                }
            });
            setPolicies(list);
        }, (error) => {
            console.error("Error loading policies in Hub:", error);
        });
        return () => unsubscribe();
    }, []);

    // Filter active banners based on user profile and role
    // Filter active banners based on user profile and role
    const displayBanners = React.useMemo(() => {
        let activeBanners = banners.filter(b => b.active !== false);
        if (hubScope === 'team') {
            if (activeSmId === 'all') {
                return activeBanners;
            }
            return activeBanners.filter(b => b.ownerSm === activeSmId);
        } else {
            return []; // Banners should only appear in Team Hub based on SM permissions
        }
    }, [banners, hubScope, activeSmId]);

    // Handle SM ID defaults for roles
    useEffect(() => {
        if (profile) {
            const role = profile.role || 'user';
            const paramSmId = searchParams.get('smId');
            if (role === 'sm') {
                setActiveSmId(profile.crmId || '');
            } else if (role === 'sd' || role === 'super_admin') {
                if (paramSmId) {
                    setActiveSmId(paramSmId);
                } else if (!activeSmId) {
                    setActiveSmId('all');
                }
            } else {
                setActiveSmId(profile.sm || '');
            }
        }
    }, [profile, systemUsers]);

    // Sync state back to URL parameters
    useEffect(() => {
        const currentScope = searchParams.get('scope');
        const currentSmId = searchParams.get('smId');
        
        if (hubScope === 'team') {
            if (currentScope !== 'team' || currentSmId !== activeSmId) {
                const newParams = new URLSearchParams(searchParams);
                newParams.set('scope', 'team');
                if (activeSmId) {
                    newParams.set('smId', activeSmId);
                }
                setSearchParams(newParams);
            }
        } else {
            if (currentScope === 'team') {
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('scope');
                newParams.delete('smId');
                setSearchParams(newParams);
            }
        }
    }, [hubScope, activeSmId, searchParams, setSearchParams]);

    // Autoplay sliding banner effect
    useEffect(() => {
        if (displayBanners.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentBannerIndex(prev => (prev + 1) % displayBanners.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [displayBanners.length]);

    // Reset banner index on scope/banners change
    useEffect(() => {
        setCurrentBannerIndex(0);
    }, [displayBanners.length]);

    // Handle banner click action
    const handleBannerClick = (banner: Banner) => {
        if (banner.linkedTaskId) {
            setSearchParams({ taskId: banner.linkedTaskId });
        } else if (banner.categoryId) {
            // Find category to see if we need to switch businessType
            const cat = categories.find(c => c.id === banner.categoryId);
            if (cat && cat.businessType) {
                setBusinessType(cat.businessType as any);
            }
            setActiveTab(banner.categoryId);
        }
    };

    const filteredPoliciesForHub = React.useMemo(() => {
        const mapBusinessTypeToTeam = (bt: string) => {
            const type = String(bt || '').toLowerCase();
            if (type === 'kid') return 'KCC';
            if (type === 'adult') return 'Adult';
            if (type === 'ss') return 'SS';
            return 'all';
        };
        
        const isSuperAdmin = profile?.role === 'super_admin';

        return policies.filter(p => {
            if ((p.section || 'policy') !== 'policy') return false;

            // 0. Hub Scope Filtering
            if (hubScope === 'team') {
                if (p.hubScope !== 'team' || p.targetSmId !== activeSmId) {
                    return false;
                }
            } else {
                if (p.hubScope === 'team') {
                    return false;
                }
            }

            const team = p.targetTeam || mapBusinessTypeToTeam(p.businessType || 'all');
            
            // 1. Business line tab filtering
            let matchesBusinessTab = false;
            if (businessType === 'kid') {
                matchesBusinessTab = (team === 'KCC' || team === 'GCC' || team === 'all');
            } else if (businessType === 'adult') {
                matchesBusinessTab = (team === 'Adult' || team === 'all');
            } else if (businessType === 'ss') {
                matchesBusinessTab = (team === 'SS' || team === 'all');
            } else if (businessType === 'leader') {
                matchesBusinessTab = (team === 'all');
            }

            if (!matchesBusinessTab) return false;

            // 2. User role/team permission filtering
            if (isSuperAdmin) {
                return true;
            }

            const targetScope = profile?.policyScope;
            if (targetScope && targetScope !== 'all') {
                return team === 'all' || team === targetScope;
            }

            return team === 'all' || team === userTeam;
        });
    }, [policies, userTeam, profile, businessType, hubScope, activeSmId]);

    const filteredBrandsForHub = React.useMemo(() => {
        const mapBusinessTypeToTeam = (bt: string) => {
            const type = String(bt || '').toLowerCase();
            if (type === 'kid') return 'KCC';
            if (type === 'adult') return 'Adult';
            if (type === 'ss') return 'SS';
            return 'all';
        };
        
        const isSuperAdmin = profile?.role === 'super_admin';

        return policies.filter(p => {
            if (p.section !== 'brand') return false;

            // 0. Hub Scope Filtering
            if (hubScope === 'team') {
                if (p.hubScope !== 'team' || p.targetSmId !== activeSmId) {
                    return false;
                }
            } else {
                if (p.hubScope === 'team') {
                    return false;
                }
            }

            const team = p.targetTeam || mapBusinessTypeToTeam(p.businessType || 'all');
            
            // 1. Business line tab filtering
            let matchesBusinessTab = false;
            if (businessType === 'kid') {
                matchesBusinessTab = (team === 'KCC' || team === 'GCC' || team === 'all');
            } else if (businessType === 'adult') {
                matchesBusinessTab = (team === 'Adult' || team === 'all');
            } else if (businessType === 'ss') {
                matchesBusinessTab = (team === 'SS' || team === 'all');
            } else if (businessType === 'leader') {
                matchesBusinessTab = (team === 'all');
            }

            if (!matchesBusinessTab) return false;

            // 2. User role/team permission filtering
            if (isSuperAdmin) {
                return true;
            }

            const targetScope = profile?.brandScope;
            if (targetScope && targetScope !== 'all') {
                return team === 'all' || team === targetScope;
            }

            return team === 'all' || team === userTeam;
        });
    }, [policies, userTeam, profile, businessType, hubScope, activeSmId]);

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

    const handleAudioEnded = async (rec: Recording, durationSeconds: number, actualListenedSeconds?: number) => {
        if (!user) return;
        
        // Anti-cheating guard: Must listen to at least 1/3 of the duration (minimum 10s file threshold)
        if (actualListenedSeconds !== undefined && durationSeconds > 10) {
            const minRequiredSeconds = durationSeconds / 3;
            if (actualListenedSeconds < minRequiredSeconds) {
                alert(t('learning_hub.anti_cheat_warning', '提醒：您必须实际收听录音的至少三分之一时间，且播放结束后才能解锁逐字稿和记录进度哦！'));
                return;
            }
        }
        
        // Prevent duplicates
        if (completedAudioIds.includes(rec.id)) return;
        
        // Show success alert for new unlock
        if (!rec.audioUrl) {
            alert(t('learning_hub.doc_unlocked_success', '恭喜！您已成功开始该文档的学习，学习记录已保存！'));
        } else {
            alert(t('learning_hub.unlocked_success', '恭喜！您已成功解锁该录音的阿语逐字稿！'));
        }
        
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
            const myUid = profile?.realUid || user.uid;
            await updateDoc(taskRef, {
                [`assignees.${myUid}.status`]: 'completed',
                [`assignees.${myUid}.completedAt`]: serverTimestamp(),
                [`assignees.${myUid}.reflections`]: reflections
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
        
        // Filter by Hub Scope (Public vs Team)
        if (hubScope === 'team') {
            if ((rec as any).hubScope !== 'team' || (rec as any).targetSmId !== activeSmId) {
                return false;
            }
        } else {
            // Public scope: do not show team-specific items
            if ((rec as any).hubScope === 'team') {
                return false;
            }
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

    // Separate pinned and unpinned recordings
    const pinnedFiltered = filteredRecordings.filter(rec => rec.isPinned);
    
    // Sort pinned matching current sortType
    const sortedPinned = [...pinnedFiltered].sort((a, b) => {
        if (sortType === 'latest') {
            return (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0);
        } else {
            return (b.playCount || 0) - (a.playCount || 0);
        }
    });

    // Show at most 6 pinned items at the top
    const pinnedToShow = sortedPinned.slice(0, 6);

    // All remaining recordings (excluding the top 6 pinned items)
    const restRecordings = filteredRecordings.filter(rec => !pinnedToShow.some(p => p.id === rec.id));

    // Sort the remaining recordings
    const sortedRest = [...restRecordings].sort((a, b) => {
        if (sortType === 'latest') {
            return (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0);
        } else {
            return (b.playCount || 0) - (a.playCount || 0);
        }
    });

    // Combine pinnedToShow at the top, followed by sortedRest
    const sortedRecordings = [...pinnedToShow, ...sortedRest];

    // Calculate display slice
    const displayedRecordings = sortedRecordings.slice(0, displayCount);

    // Calculate Leaderboard (Scoped by selected businessType and optionally filtered by Team)
    const displayTopFavorited = React.useMemo(() => {
        let favCounts = allFavoritesCount;
        if (hubScope === 'team' && activeSmId) {
            const teamFavCounts: Record<string, number> = {};
            rawFavorites.forEach(item => {
                const u = systemUsers.find(user => user.id === item.userId);
                if (u && (u.sm === activeSmId || u.crmId === activeSmId)) {
                    item.recordingIds.forEach((id: string) => {
                        teamFavCounts[id] = (teamFavCounts[id] || 0) + 1;
                    });
                }
            });
            favCounts = teamFavCounts;
        }

        return recordings
            .filter(rec => {
                if ((rec.businessType || 'kid') !== businessType) return false;
                if (hubScope === 'team') {
                    return (rec as any).hubScope === 'team' && (rec as any).targetSmId === activeSmId;
                } else {
                    return (rec as any).hubScope !== 'team';
                }
            })
            .sort((a, b) => {
                const countA = favCounts[a.id] || 0;
                const countB = favCounts[b.id] || 0;
                if (countB === countA) return (b.playCount || 0) - (a.playCount || 0);
                return countB - countA;
            })
            .slice(0, 10);
    }, [recordings, businessType, allFavoritesCount, rawFavorites, systemUsers, hubScope, activeSmId]);
    
    const displayTopLiked = React.useMemo(() => {
        const getLikeCount = (rec: Recording) => {
            if (!rec.likes) return 0;
            if (hubScope === 'team' && activeSmId) {
                return rec.likes.filter(uid => {
                    const u = systemUsers.find(user => user.id === uid);
                    return u && (u.sm === activeSmId || u.crmId === activeSmId);
                }).length;
            }
            return rec.likes.length;
        };

        return recordings
            .filter(rec => {
                if ((rec.businessType || 'kid') !== businessType) return false;
                if (hubScope === 'team') {
                    return (rec as any).hubScope === 'team' && (rec as any).targetSmId === activeSmId;
                } else {
                    return (rec as any).hubScope !== 'team';
                }
            })
            .sort((a, b) => {
                const countA = getLikeCount(a);
                const countB = getLikeCount(b);
                if (countB === countA) return (b.playCount || 0) - (a.playCount || 0);
                return countB - countA;
            })
            .slice(0, 10);
    }, [recordings, businessType, systemUsers, hubScope, activeSmId]);

    const renderFeaturedMediaCard = (item: any) => {
        if (!item) return null;
        const isVideo = item.type === 'video';
        const isPoster = item.type === 'poster';

        return (
            <div 
                onClick={() => setActivePolicyItem(item)}
                className="group relative w-full aspect-[16/10] rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-500 border border-white/20 mb-3.5 hover:-translate-y-1 active:scale-[0.99]"
            >
                {/* Background rendering */}
                {isPoster ? (
                    <div className="absolute inset-0 bg-slate-900">
                        <img 
                            src={item.url} 
                            alt={item.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
                    </div>
                ) : isVideo ? (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-deep-teal to-teal-900 flex flex-col items-center justify-center p-4">
                        <div className="absolute w-32 h-32 bg-desert-gold/10 rounded-full blur-xl -top-6 -right-6 group-hover:bg-desert-gold/20 transition-all duration-700"></div>
                        <div className="absolute w-24 h-24 bg-teal-400/5 rounded-full blur-lg -bottom-4 -left-4"></div>
                        
                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shadow-lg group-hover:scale-110 group-hover:bg-desert-gold group-hover:border-desert-gold/50 group-hover:shadow-desert-gold/20 transition-all duration-500 ease-out z-10">
                            <span className="text-base pl-0.5 group-hover:text-deep-teal transition-colors">▶️</span>
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-desert-gold/10 via-white/5 to-transparent flex flex-col items-center justify-center p-4">
                        <span className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-500">📄</span>
                    </div>
                )}

                {/* Dark gradient overlay at the bottom for readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 flex flex-col justify-end p-4 text-white">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="px-2 py-0.5 bg-desert-gold/90 text-deep-teal text-[9px] font-black rounded-md uppercase tracking-wider shadow-sm">
                            {isVideo ? t('policy_showcase.video_promo', '🎥 视频') : isPoster ? t('policy_showcase.poster_incentive', '🖼️ 海报') : t('policy_showcase.doc_policy', '📄 文档')}
                        </span>
                        {item.createdAt && (
                            <span className="text-[10px] text-white/60 font-semibold tracking-wide">
                                {item.createdAt.toDate().toLocaleDateString()}
                            </span>
                        )}
                    </div>
                    <h4 className="text-xs sm:text-sm font-black truncate leading-snug tracking-wide group-hover:text-desert-gold transition-colors duration-300">
                        {item.title}
                    </h4>
                </div>
            </div>
        );
    };

    const renderCompactPoliciesWidget = () => {
        const list = filteredPoliciesForHub.slice(0, 2);
        const hasPolicies = list.length > 0;
        
        return (
            <div className={`glass-panel rounded-2xl border border-white p-5 ${
                businessType === 'leader' ? 'bg-teal-950/40 border-desert-gold/20' : 'bg-white/60 backdrop-blur-md'
            }`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-sm sm:text-base font-bold flex items-center gap-2 ${
                        businessType === 'leader' ? 'text-white' : 'text-deep-teal'
                    }`}>
                        <Sparkles className="w-4 h-4 text-desert-gold animate-pulse animate-duration-1000" />
                        {t('learning_hub.operations_policies_title', '运营政策与激励')}
                    </h3>
                    <button
                        onClick={() => navigate('/policies')}
                        className="text-xs font-black text-desert-gold hover:text-yellow-600 transition-colors flex items-center gap-0.5 cursor-pointer bg-transparent border-0 outline-none"
                    >
                        {t('learning_hub.view_all_policies', '全部')} <span>→</span>
                    </button>
                </div>
                
                {!hasPolicies ? (
                    <div className="py-6 text-center text-xs font-bold text-arabian-night/50">
                        {t('learning_hub.no_policies_showcase', '暂无政策激励')}
                    </div>
                ) : (
                    <div className="space-y-3.5 flex flex-col">
                        {list.map((policy) => renderFeaturedMediaCard(policy))}
                    </div>
                )}
            </div>
        );
    };

    const renderCompactBrandsWidget = () => {
        const list = filteredBrandsForHub.slice(0, 2);
        const hasBrands = list.length > 0;
        
        return (
            <div className={`glass-panel rounded-2xl border border-white p-5 ${
                businessType === 'leader' ? 'bg-teal-950/40 border-desert-gold/20' : 'bg-white/60 backdrop-blur-md'
            }`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-sm sm:text-base font-bold flex items-center gap-2 ${
                        businessType === 'leader' ? 'text-white' : 'text-deep-teal'
                    }`}>
                        <ImageIcon className="w-4 h-4 text-desert-gold animate-pulse animate-duration-1000" />
                        {t('learning_hub.marketing_brand_title', '市场品牌专栏')}
                    </h3>
                    <button
                        onClick={() => navigate('/brands')}
                        className="text-xs font-black text-desert-gold hover:text-yellow-600 transition-colors flex items-center gap-0.5 cursor-pointer bg-transparent border-0 outline-none"
                    >
                        {t('learning_hub.view_all_brands', '全部')} <span>→</span>
                    </button>
                </div>
                
                {!hasBrands ? (
                    <div className="py-6 text-center text-xs font-bold text-arabian-night/50">
                        {t('learning_hub.no_brands_showcase', '暂无品牌物料')}
                    </div>
                ) : (
                    <div className="space-y-3.5 flex flex-col">
                        {list.map((brand) => renderFeaturedMediaCard(brand))}
                    </div>
                )}
            </div>
        );
    };

    const renderFullPoliciesPlaza = () => {
        // Filter by searchQuery if present
        const searchFiltered = searchQuery.trim()
            ? filteredPoliciesForHub.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()))
            : filteredPoliciesForHub;
            
        return (
            <div className="space-y-6 mt-8 animate-in fade-in duration-500">
                <div className="flex items-center gap-3 pl-3 border-l-4 border-deep-teal">
                    <h3 className="text-xl font-extrabold text-deep-teal dark:text-white">
                        📋 {t('learning_hub.operations_policies_title', '运营政策与激励')}
                    </h3>
                </div>
                
                {searchFiltered.length === 0 ? (
                    <div className="py-20 text-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-gray-250 dark:border-slate-800">
                        <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <span className="text-2xl">📋</span>
                        </div>
                        <h3 className="text-lg font-bold text-deep-teal dark:text-desert-gold mb-1">
                            {t('learning_hub.no_policies_showcase', '暂无政策激励')}
                        </h3>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                        {searchFiltered.map((policy) => (
                            <div key={policy.id} className="flex flex-col">
                                {renderFeaturedMediaCard(policy)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderFullBrandsPlaza = () => {
        // Filter by searchQuery if present
        const searchFiltered = searchQuery.trim()
            ? filteredBrandsForHub.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()))
            : filteredBrandsForHub;

        return (
            <div className="space-y-6 mt-8 animate-in fade-in duration-500">
                <div className="flex items-center gap-3 pl-3 border-l-4 border-deep-teal">
                    <h3 className="text-xl font-extrabold text-deep-teal dark:text-white">
                        🎨 {t('learning_hub.marketing_brand_title', '市场品牌专栏')}
                    </h3>
                </div>
                
                {searchFiltered.length === 0 ? (
                    <div className="py-20 text-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-gray-250 dark:border-slate-800">
                        <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <span className="text-2xl">🎨</span>
                        </div>
                        <h3 className="text-lg font-bold text-deep-teal dark:text-desert-gold mb-1">
                            {t('learning_hub.no_brands_showcase', '暂无品牌物料')}
                        </h3>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                        {searchFiltered.map((brand) => (
                            <div key={brand.id} className="flex flex-col">
                                {renderFeaturedMediaCard(brand)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderLeaderboardWidget = (isFullWidth = false) => {
        return (
            <div className={`glass-panel rounded-2xl border border-white p-5 ${isFullWidth ? 'w-full max-w-2xl mx-auto shadow-sm bg-white/70 backdrop-blur-md' : 'xl:sticky xl:top-28 bg-white/60 backdrop-blur-md'}`}>
                <h3 className="text-lg font-bold text-deep-teal mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-desert-gold" />
                    {t('learning_hub.leaderboard')}
                </h3>
                
                <div className="flex bg-gray-100/80 p-1 rounded-lg mb-4 border border-gray-200/30">
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
                    {(leaderboardTab === 'favorites' ? displayTopFavorited : displayTopLiked).map((rec, idx) => {
                        const favCount = (() => {
                            if (hubScope === 'team' && activeSmId) {
                                let count = 0;
                                rawFavorites.forEach(item => {
                                    const u = systemUsers.find(user => user.id === item.userId);
                                    if (u && (u.sm === activeSmId || u.crmId === activeSmId) && item.recordingIds.includes(rec.id)) {
                                        count++;
                                    }
                                });
                                return count;
                            }
                            return allFavoritesCount[rec.id] || 0;
                        })();

                        const likeCount = (() => {
                            if (!rec.likes) return 0;
                            if (hubScope === 'team' && activeSmId) {
                                return rec.likes.filter(uid => {
                                    const u = systemUsers.find(user => user.id === uid);
                                    return u && (u.sm === activeSmId || u.crmId === activeSmId);
                                }).length;
                            }
                            return rec.likes.length;
                        })();

                        return (
                            <div 
                                key={rec.id} 
                                className="flex items-center gap-3 group cursor-pointer hover:bg-white p-2.5 rounded-xl transition-all border border-transparent hover:border-white/60 hover:shadow-sm" 
                                onClick={() => {
                                    const newParams = new URLSearchParams(searchParams);
                                    newParams.set('recordingId', rec.id);
                                    setSearchParams(newParams);
                                }}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${idx === 0 ? 'bg-yellow-100 text-yellow-600 shadow-sm' : idx === 1 ? 'bg-gray-200 text-gray-600 shadow-sm' : idx === 2 ? 'bg-orange-100 text-orange-600 shadow-sm' : 'bg-gray-50 text-gray-400'}`}>
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-arabian-night line-clamp-2 leading-tight group-hover:text-desert-gold transition-colors" title={rec.title}>
                                        {rec.displayId && <span className="text-desert-gold mr-1 text-xs inline-block font-black">[{rec.displayId}]</span>}
                                        {rec.title}
                                    </h4>
                                    <div className="text-[10px] text-arabian-night/50 flex items-center gap-2 mt-0.5">
                                        <span className="truncate font-semibold">{rec.lecturerName || t('learning_hub.unknown_lecturer')}</span>
                                        <span className="flex items-center gap-0.5 font-semibold">
                                            {leaderboardTab === 'favorites' ? <Heart className="w-3 h-3 text-red-400 fill-red-400"/> : <Moon className="w-3 h-3 text-desert-gold fill-desert-gold"/>}
                                            {leaderboardTab === 'favorites' ? favCount : likeCount}
                                        </span>
                                    </div>
                                </div>
                                <button className="w-7 h-7 rounded-full bg-deep-teal/5 flex items-center justify-center text-deep-teal opacity-0 group-hover:opacity-100 group-hover:bg-deep-teal/10 transition-all shrink-0">
                                    <PlayCircle className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Level & Honor System Config & Helpers
    const userStats = React.useMemo(() => {
        // Calculate dynamic study time (average 12 minutes per completed audio + some base minutes)
        const baseMins = 45;
        const totalLearningMinutes = baseMins + (completedAudioIds.length * 12);
        
        // Calculate task completion rate
        let weeklyTaskCompletionRate = 60;
        if (completedAudioIds.length > 0) {
            weeklyTaskCompletionRate = Math.min(100, 60 + completedAudioIds.length * 8);
        }
        
        // Daily Coffee Streak: default to 5, increases with study minutes
        const streakCount = Math.min(7, 3 + Math.floor(totalLearningMinutes / 60));
        
        // Determine level
        let levelKey: 'apprentice' | 'voyager' | 'knight' | 'falcon' | 'guardian' = 'apprentice';
        if (totalLearningMinutes >= 7200 && weeklyTaskCompletionRate >= 95) {
            levelKey = 'guardian';
        } else if (totalLearningMinutes >= 3600 && weeklyTaskCompletionRate >= 85) {
            levelKey = 'falcon';
        } else if (totalLearningMinutes >= 1800 && weeklyTaskCompletionRate >= 75) {
            levelKey = 'knight';
        } else if (totalLearningMinutes >= 600) {
            levelKey = 'voyager';
        }
        
        return {
            totalLearningMinutes,
            weeklyTaskCompletionRate,
            streakCount,
            levelKey
        };
    }, [completedAudioIds]);

    const honorLevels = {
        apprentice: {
            title: localT('level.apprentice.title', '寻宝新手', i18n),
            titleAr: 'باحث عن الكنز',
            desc: localT('level.apprentice.desc', '开启您的寻宝任务，在沙海中寻找宝贵的销售知识。', i18n),
            crestColor: 'from-[#E6DFD3] to-[#C5A059]',
            icon: '🌱',
            nextThreshold: 600,
            nextTitle: localT('level.voyager.title', '沙漠追踪者', i18n)
        },
        voyager: {
            title: localT('level.voyager.title', '沙漠追踪者', i18n),
            titleAr: 'مقتفي أثر الصحراء',
            desc: localT('level.voyager.desc', '在沙海中辨识路径，追踪成功的核心线索。', i18n),
            crestColor: 'from-amber-500 to-orange-600',
            icon: '🐫',
            nextThreshold: 1800,
            nextTitle: localT('level.knight.title', '佩特拉开拓者', i18n)
        },
        knight: {
            title: localT('level.knight.title', '佩特拉开拓者', i18n),
            titleAr: 'مستكشف البتراء',
            desc: localT('level.knight.desc', '寻获玫瑰古城的秘道，解锁核心的销售高阶技能。', i18n),
            crestColor: 'from-teal-600 to-emerald-600',
            icon: '🐎',
            nextThreshold: 3600,
            nextTitle: localT('level.falcon.title', '精英猎人', i18n)
        },
        falcon: {
            title: localT('level.falcon.title', '精英猎人', i18n),
            titleAr: 'صائد الكنوز النخبة',
            desc: localT('level.falcon.desc', '发掘传奇级宝藏，展现精湛的执行力与业务素养。', i18n),
            crestColor: 'from-yellow-500 to-amber-600',
            icon: '🦅',
            nextThreshold: 7200,
            nextTitle: localT('level.guardian.title', '宝库传奇', i18n)
        },
        guardian: {
            title: localT('level.guardian.title', '宝库传奇', i18n),
            titleAr: 'أسطورة الخزنة',
            desc: localT('level.guardian.desc', '步入佩特拉宝库库深处，冠以终极寻宝传奇勋章。', i18n),
            crestColor: 'from-[#0D5C75] to-teal-800',
            icon: '🌴',
            nextThreshold: 9999,
            nextTitle: ''
        }
    };

    const renderCompactOasisHonorWidget = () => {
        const stats = userStats;
        const currentLevelInfo = honorLevels[stats.levelKey];
        
        return (
            <div 
                onClick={() => setShowHonorModal(true)}
                className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl border border-[#E6DFD3] dark:border-white/10 p-4 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer flex items-center justify-between gap-4 group active:scale-[0.99] relative overflow-hidden"
            >
                {/* Subtle golden ambient background glow */}
                <div className="absolute -right-6 -top-6 w-16 h-16 bg-desert-gold/5 rounded-full blur-xl pointer-events-none"></div>
                
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Rank icon badge */}
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${currentLevelInfo.crestColor} flex items-center justify-center text-white text-xl shadow-sm shrink-0 border border-white/20`}>
                        {currentLevelInfo.icon}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-black text-deep-teal leading-tight">{currentLevelInfo.title}</span>
                            <span className="text-[9px] font-bold text-desert-gold font-mono bg-desert-gold/10 px-1.5 py-0.5 rounded border border-desert-gold/15">{currentLevelInfo.titleAr}</span>
                        </div>
                        {/* Compact Caravan progress bar */}
                        <div className="flex items-center gap-2 mt-1.5 w-full">
                            <div className="flex-1 bg-[#E6DFD3]/40 dark:bg-slate-800 rounded-full h-1.5 relative overflow-hidden">
                                <div 
                                    className="bg-gradient-to-r from-deep-teal to-desert-gold h-full rounded-full transition-all duration-500 ease-out" 
                                    style={{ width: `${Math.min(100, (stats.totalLearningMinutes / currentLevelInfo.nextThreshold) * 100)}%` }}
                                ></div>
                            </div>
                            <span className="text-[10px] font-bold text-desert-gold font-mono shrink-0">
                                {stats.totalLearningMinutes} / {currentLevelInfo.nextThreshold === 9999 ? '∞' : `${currentLevelInfo.nextThreshold} ${localT('common.minutes', '分钟', i18n)}`}
                            </span>
                        </div>
                        {/* Incentive Explain Helper Caption */}
                        <p className="text-[10px] sm:text-[11px] mt-2.5 font-bold text-slate-500 dark:text-slate-400/90 leading-relaxed border-t border-gray-100/50 dark:border-white/5 pt-2 flex items-start gap-1">
                            <span>{localT('learning_hub.incentive_explain_line', '🏆 宝藏猎人：听录音进行智慧寻宝。达到时间与任务门槛即可解锁 Najah 学院荣誉证书与宝藏勋章奖励（点击查看详情）。', i18n)}</span>
                        </p>
                    </div>
                </div>
                
                {/* Arrow Action indicator */}
                <div className="flex items-center gap-1 text-desert-gold shrink-0 pl-1">
                    <span className="text-[11px] font-black tracking-wider uppercase hidden sm:inline-block group-hover:translate-x-[-2px] transition-transform duration-300">
                        {localT('learning_hub.view_honor_detail', '荣誉详情', i18n)}
                    </span>
                    <span className="text-sm font-bold group-hover:translate-x-1 transition-transform duration-300">
                        {i18n.language === 'ar' ? '←' : '→'}
                    </span>
                </div>
            </div>
        );
    };

    const renderOasisHonorDetailModal = () => {
        if (!showHonorModal) return null;
        
        const stats = userStats;
        const currentLevelInfo = honorLevels[stats.levelKey];
        
        return (
            <div 
                className="fixed inset-0 z-[990] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300"
                onClick={() => setShowHonorModal(false)}
            >
                <div 
                    className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl border border-[#E6DFD3] dark:border-slate-800 animate-in zoom-in-95 duration-300 flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button 
                        onClick={() => setShowHonorModal(false)}
                        className="absolute top-6 end-6 p-2 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 transition-all cursor-pointer shadow-sm active:scale-95 z-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    
                    <h3 className="text-xl font-extrabold text-deep-teal dark:text-white mb-6 pe-8 flex items-center gap-2">
                        <span>🏆</span>
                        {localT('learning_hub.rules_title_modal', '绿洲学习荣誉机制', i18n)}
                    </h3>
                    
                    <div className="space-y-6">
                        {/* Crest and Rank Header */}
                        <div className="flex items-center gap-3.5 relative z-10 w-full bg-amber-50/20 dark:bg-slate-800/40 p-4 rounded-2xl border border-[#E6DFD3]/40 dark:border-white/5">
                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${currentLevelInfo.crestColor} flex items-center justify-center text-white text-2xl shadow-md border border-white/20 transform hover:scale-105 transition-transform`}>
                                {currentLevelInfo.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className="text-base font-black text-deep-teal leading-tight">{currentLevelInfo.title}</h4>
                                    <span className="text-[10px] font-bold text-desert-gold font-mono leading-none bg-desert-gold/10 px-1.5 py-0.5 rounded border border-desert-gold/20">{currentLevelInfo.titleAr}</span>
                                </div>
                                <p className="text-[11px] text-arabian-night/60 dark:text-white/40 font-semibold mt-1">
                                    {currentLevelInfo.desc}
                                </p>
                            </div>
                        </div>

                        {/* Daily Kahwa Streak ☕ */}
                        <div>
                            <div className="flex justify-between items-center text-xs font-bold text-deep-teal mb-2">
                                <span className="flex items-center gap-1.5">☕ {localT('learning_hub.coffee_streak', '每日咖啡连击', i18n)}</span>
                                <span className="text-desert-gold font-extrabold font-mono">{stats.streakCount} / 7 {localT('common.days', '天', i18n)}</span>
                            </div>
                            <div className="flex gap-1.5 justify-between">
                                {Array.from({ length: 7 }).map((_, idx) => {
                                    const isActive = idx < stats.streakCount;
                                    return (
                                        <div 
                                            key={idx} 
                                            title={isActive 
                                                ? localT('learning_hub.streak_active_tooltip', '第 {day} 天已学习', i18n).replace('{day}', String(idx + 1))
                                                : localT('learning_hub.streak_inactive_tooltip', '第 {day} 天未打卡', i18n).replace('{day}', String(idx + 1))
                                            }
                                            className={`flex-1 aspect-square max-w-[40px] rounded-xl border flex items-center justify-center text-base transition-all duration-300 ${
                                                isActive 
                                                    ? 'bg-amber-50 border-desert-gold/45 text-amber-700 shadow-sm' 
                                                    : 'bg-[#E6DFD3]/20 border-transparent text-gray-300 dark:bg-slate-800'
                                            }`}
                                        >
                                            {isActive ? '☕' : '◌'}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Spring of Wisdom / Caravan Journey Progress */}
                        <div>
                            <div className="flex justify-between items-center text-xs font-bold text-deep-teal mb-2">
                                <span className="flex items-center gap-1">🤠 {localT('learning_hub.caravan_progress', '沙漠商队行进进度', i18n)}</span>
                                <span className="text-desert-gold font-extrabold font-mono">{stats.totalLearningMinutes} / {currentLevelInfo.nextThreshold === 9999 ? '∞' : `${currentLevelInfo.nextThreshold} ${localT('common.minutes', '分钟', i18n)}`}</span>
                            </div>
                            
                            {/* Caravan path visualizer */}
                            <div className="relative w-full h-8 bg-amber-50/45 dark:bg-slate-900/40 rounded-xl border border-[#E6DFD3]/40 dark:border-white/5 overflow-hidden flex items-center px-2.5" dir="ltr">
                                <div className="absolute inset-0 bg-[linear-gradient(45deg,#fdfcfb_25%,transparent_25%),linear-gradient(-45deg,#fdfcfb_25%,transparent_25%)] bg-[size:10px_10px] opacity-15 pointer-events-none"></div>
                                
                                {currentLevelInfo.nextThreshold !== 9999 && (
                                    <div 
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-lg z-10 animate-pulse duration-1000" 
                                        title={localT('learning_hub.next_oasis_tooltip', '下一站绿洲：{title}', i18n).replace('{title}', currentLevelInfo.nextTitle)}
                                    >
                                        💎
                                    </div>
                                )}
                                
                                <div className="w-full bg-[#E6DFD3]/40 dark:bg-slate-800 rounded-full h-1 relative">
                                    <div 
                                        className="bg-gradient-to-r from-deep-teal to-desert-gold h-1 rounded-full shadow-sm transition-all duration-500 ease-out" 
                                        style={{ width: `${Math.min(100, (stats.totalLearningMinutes / currentLevelInfo.nextThreshold) * 100)}%` }}
                                    ></div>
                                    
                                    <div 
                                        className="absolute top-1/2 -translate-y-1/2 -mt-1 text-sm transition-all duration-500 ease-out z-20"
                                        style={{ 
                                            left: `calc(${Math.min(92, (stats.totalLearningMinutes / currentLevelInfo.nextThreshold) * 100)}% - 6px)`,
                                            transform: 'scaleX(-1)'
                                        }}
                                    >
                                        🧭
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center text-[10px] text-arabian-night/40 dark:text-white/30 font-bold mt-1.5 select-none">
                                <span>{currentLevelInfo.title}</span>
                                {currentLevelInfo.nextThreshold !== 9999 ? (
                                    <span>{localT('learning_hub.next_oasis', '下一绿洲', i18n)}: {currentLevelInfo.nextTitle}</span>
                                ) : (
                                    <span>{localT('learning_hub.max_level', '最高荣誉', i18n)}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* View Certificate Action Button */}
                    <div className="mt-8 flex flex-col gap-2.5">
                        <button
                            onClick={() => {
                                setShowHonorModal(false);
                                setShowCertificate(true);
                            }}
                            className="w-full bg-gradient-to-r from-deep-teal to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white py-3 px-4 rounded-xl text-xs font-black tracking-wider transition-all duration-300 shadow-md hover:shadow-teal-900/10 cursor-pointer flex items-center justify-center gap-1.5 border border-white/10 active:scale-98"
                        >
                            🏆 {localT('learning_hub.view_honor_cert', '查看荣誉勋章与证书', i18n)}
                        </button>
                        
                        <button
                            onClick={() => {
                                setShowHonorModal(false);
                                setShowRulesModal(true);
                            }}
                            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 py-3 px-4 rounded-xl text-xs font-black hover:bg-gray-50 dark:hover:bg-slate-750 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                        >
                            📋 {localT('learning_hub.view_rules_detail', '查看详细规则说明', i18n)}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderCertificateModal = () => {
        if (!showCertificate) return null;
        
        const stats = userStats;
        const currentLevelInfo = honorLevels[stats.levelKey];
        const formattedDate = new Date().toLocaleDateString(
            i18n.language?.startsWith('ar') 
                ? 'ar-JO' 
                : i18n.language?.startsWith('en') 
                    ? 'en-US' 
                    : 'zh-CN', 
            {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }
        );

        return (
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
                {/* Certificate Modal Container */}
                <div className="relative w-full max-w-4xl bg-white border border-blue-600 rounded-[2rem] shadow-[0_20px_50px_rgba(37,99,235,0.25)] text-slate-800 overflow-hidden animate-in zoom-in-95 duration-300 select-none flex flex-col">
                    
                    {/* Wavy Corner Accents */}
                    {/* Top-Left */}
                    <div className="absolute top-0 left-0 w-32 h-32 pointer-events-none z-0 overflow-hidden">
                        <svg className="absolute -top-6 -left-6 w-36 h-36" viewBox="0 0 200 200" fill="none">
                            <path d="M0 0 C 140 0, 160 50, 110 130 C 70 180, 0 180, 0 180 Z" fill="#1e40af" opacity="0.95"/>
                            <path d="M0 0 C 100 0, 120 40, 80 100 C 50 140, 0 140, 0 140 Z" fill="#eab308" opacity="0.9"/>
                            <circle cx="150" cy="40" r="8" fill="#eab308" />
                        </svg>
                    </div>

                    {/* Top-Right */}
                    <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none z-0 overflow-hidden">
                        <svg className="absolute -top-6 -right-6 w-36 h-36" viewBox="0 0 200 200" fill="none">
                            <path d="M200 0 C 60 0, 40 50, 90 130 C 130 180, 200 180, 200 180 Z" fill="#1e40af" opacity="0.95"/>
                            <path d="M200 0 C 100 0, 80 40, 120 100 C 150 140, 200 140, 200 140 Z" fill="#eab308" opacity="0.9"/>
                            <circle cx="50" cy="30" r="6" fill="#1e40af" opacity="0.6" />
                        </svg>
                    </div>

                    {/* Bottom-Left */}
                    <div className="absolute bottom-0 left-0 w-32 h-32 pointer-events-none z-0 overflow-hidden">
                        <svg className="absolute -bottom-6 -left-6 w-36 h-36" viewBox="0 0 200 200" fill="none">
                            <path d="M0 200 C 140 200, 160 150, 110 70 C 70 20, 0 20, 0 20 Z" fill="#eab308" opacity="0.9"/>
                            <path d="M0 200 C 100 200, 120 160, 80 100 C 50 60, 0 60, 0 60 Z" fill="#1e40af" opacity="0.95"/>
                        </svg>
                    </div>

                    {/* Bottom-Right */}
                    <div className="absolute bottom-0 right-0 w-32 h-32 pointer-events-none z-0 overflow-hidden">
                        <svg className="absolute -bottom-6 -right-6 w-36 h-36" viewBox="0 0 200 200" fill="none">
                            <path d="M200 200 C 60 200, 40 150, 90 70 C 130 20, 200 20, 200 20 Z" fill="#eab308" opacity="0.9"/>
                            <path d="M200 200 C 100 200, 80 160, 120 100 C 150 60, 200 60, 200 60 Z" fill="#1e40af" opacity="0.95"/>
                        </svg>
                    </div>

                    {/* Close Button */}
                    <button 
                        onClick={() => setShowCertificate(false)}
                        className="absolute top-6 end-6 p-2 rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all cursor-pointer z-50 shadow-sm border border-slate-200 active:scale-95"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Outer margin border box */}
                    <div className="m-3 sm:m-4 border border-yellow-400/50 rounded-[1.5rem] p-4 sm:p-6 flex flex-col sm:flex-row items-center relative z-10 bg-white/90 backdrop-blur-sm shadow-inner">
                        
                        {/* Left Side: Mascot column */}
                        <div className="hidden sm:flex w-1/4 h-full items-center justify-center pr-3 relative">
                            <img 
                                src="/images/51talk-mascot-headphones.png" 
                                alt="51Talk Mascot" 
                                className="w-full max-h-[85%] object-contain drop-shadow-md animate-bounce duration-[4000ms] ease-in-out" 
                            />
                        </div>

                        {/* Right Side: Certificate details */}
                        <div className="flex-1 flex flex-col items-center text-center">
                            
                            {/* Logo */}
                            <img src="/images/51talk-logo.png" alt="51Talk Logo" className="h-10 sm:h-12 object-contain mb-1.5" />
                            
                            {/* Header */}
                            <h2 className="text-blue-900 font-extrabold text-2xl sm:text-3xl tracking-widest leading-none">CERTIFICATE</h2>
                            <p className="text-blue-800 font-bold text-[9px] sm:text-xs tracking-[0.3em] uppercase mt-0.5 mb-3">OF ACHIEVEMENT</p>
                            
                            {/* Subtitle */}
                            <p className="text-slate-500 text-[10px] sm:text-xs tracking-wider font-semibold mb-1">This is to certify that</p>
                            
                            {/* Name */}
                            <h3 className="text-2xl sm:text-3xl font-extrabold text-blue-700 tracking-wide italic font-serif px-4 mb-2 truncate max-w-full border-b border-yellow-400/30 pb-0.5 w-full max-w-xs mx-auto">
                                {profile?.name || user?.email?.split('@')[0] || 'Member'}
                            </h3>
                            
                            <p className="text-slate-500 text-[9px] sm:text-[10px] tracking-wider font-semibold mb-3">has successfully completed and is recognized as</p>
                            
                            {/* Ribbon Banner */}
                            <div className="relative w-full max-w-md bg-gradient-to-r from-blue-700 via-blue-800 to-blue-700 text-white font-extrabold text-xs sm:text-sm py-2 px-6 rounded-md shadow-md border-y border-yellow-400/50 mb-3 flex items-center justify-center gap-1.5">
                                <span className="text-yellow-400">★</span>
                                <span className="uppercase tracking-wider">{currentLevelInfo.title}</span>
                                <span className="text-yellow-350">({currentLevelInfo.titleAr})</span>
                                <span className="text-yellow-400">★</span>
                                {/* Mini Ribbon Fold Effects */}
                                <div className="absolute -left-1.5 top-1.5 w-1.5 h-5 bg-blue-900 rounded-l transform -skew-y-12"></div>
                                <div className="absolute -right-1.5 top-1.5 w-1.5 h-5 bg-blue-900 rounded-r transform skew-y-12"></div>
                            </div>

                            {/* Main Body */}
                            <p className="text-[10px] sm:text-xs text-slate-500 leading-normal italic font-semibold max-w-md mb-4 px-2">
                                {localT('learning_hub.cert_main_body', '鉴于该学员在学习中心表现卓越，累计学时充沛，任务执行精准，特授予中东卓越销售激励荣誉头衔 ——', i18n)}
                            </p>
                            
                            {/* Stats Grid */}
                            <div className="grid grid-cols-4 gap-1.5 w-full max-w-lg mb-4 text-center">
                                <div className="flex flex-col items-center p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                    <BookOpen className="w-3.5 h-3.5 text-blue-600 mb-0.5" />
                                    <span className="text-[7px] text-slate-400 font-extrabold uppercase tracking-wider">Training</span>
                                    <span className="font-extrabold text-[9px] sm:text-xs text-blue-950 mt-0.5 truncate max-w-full">Learning Hub</span>
                                </div>
                                <div className="flex flex-col items-center p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                    <Clock className="w-3.5 h-3.5 text-blue-600 mb-0.5" />
                                    <span className="text-[7px] text-slate-400 font-extrabold uppercase tracking-wider">Duration</span>
                                    <span className="font-extrabold text-[9px] sm:text-xs text-blue-950 mt-0.5">{stats.totalLearningMinutes} Mins</span>
                                </div>
                                <div className="flex flex-col items-center p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                    <Trophy className="w-3.5 h-3.5 text-blue-600 mb-0.5" />
                                    <span className="text-[7px] text-slate-400 font-extrabold uppercase tracking-wider">Achievement</span>
                                    <span className="font-extrabold text-[9px] sm:text-xs text-blue-950 mt-0.5 truncate max-w-full">{currentLevelInfo.title}</span>
                                </div>
                                <div className="flex flex-col items-center p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                    <Calendar className="w-3.5 h-3.5 text-blue-600 mb-0.5" />
                                    <span className="text-[7px] text-slate-400 font-extrabold uppercase tracking-wider">Issue Date</span>
                                    <span className="font-extrabold text-[9px] sm:text-xs text-blue-950 mt-0.5">{formattedDate}</span>
                                </div>
                            </div>

                            {/* Footer Signatures */}
                            <div className="w-full flex items-center justify-between border-t border-slate-200/60 pt-3 text-[9px]">
                                <div className="flex flex-col items-center">
                                    <span className="font-serif italic font-bold text-slate-700 h-4">51Talk Management</span>
                                    <div className="w-16 border-t border-slate-300 my-0.5"></div>
                                    <span className="text-[7px] text-slate-400 font-extrabold uppercase">Issued By</span>
                                </div>

                                {/* Seal logo badge */}
                                <div className="relative flex items-center justify-center -top-1">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 border border-yellow-250 flex flex-col items-center justify-center text-[6px] font-black text-blue-950 shadow-md">
                                        <span className="font-extrabold uppercase">51Talk</span>
                                        <span className="font-bold">★ ★ ★</span>
                                    </div>
                                    <div className="absolute -bottom-1 -left-0.5 w-1 h-2.5 bg-yellow-500 transform rotate-12 origin-top rounded-b"></div>
                                    <div className="absolute -bottom-1 -right-0.5 w-1 h-2.5 bg-yellow-500 transform -rotate-12 origin-top rounded-b"></div>
                                </div>

                                <div className="flex flex-col items-center">
                                    <span className="font-extrabold text-blue-600 h-4 flex items-center">51Talk Management</span>
                                    <div className="w-16 border-t border-slate-350 my-0.5"></div>
                                    <span className="text-[7px] text-slate-400 font-extrabold uppercase">Learn • Teach • Grow</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-2.5 pb-5 px-6 justify-center w-full z-10 relative">
                        <button
                            onClick={() => {
                                alert(localT('learning_hub.cert_downloading', '荣誉证书下载中... 已自动存入您的相册。', i18n));
                            }}
                            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-extrabold text-xs py-2.5 px-6 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all w-full sm:w-auto"
                        >
                            <Download className="w-4 h-4" /> {localT('learning_hub.cert_download', '保存证书至相册', i18n)}
                        </button>
                        
                        <button
                            onClick={() => {
                                const shareUrl = window.location.href;
                                const text = encodeURIComponent(`Hi! I just achieved the rank of ${currentLevelInfo.title} at 51Talk! 🏆🎓`);
                                window.open(`https://api.whatsapp.com/send?text=${text}%20${shareUrl}`);
                            }}
                            className="bg-slate-150 hover:bg-slate-200 border border-slate-200 text-slate-700 font-extrabold text-xs py-2.5 px-6 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all w-full sm:w-auto"
                        >
                            <Share2 className="w-4 h-4" /> {localT('learning_hub.cert_share_whatsapp', '分享至 WhatsApp', i18n)}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderRulesModal = () => {
        if (!showRulesModal) return null;

        return (
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
                <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                    {/* Close Button */}
                    <button 
                        onClick={() => setShowRulesModal(false)}
                        className="absolute top-6 end-6 p-2 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <h3 className="text-xl font-extrabold text-deep-teal dark:text-white mb-6 pe-8">
                        {localT('learning_hub.rules_title', '绿洲荣誉机制规则说明', i18n)}
                    </h3>

                    <div className="space-y-6 text-sm">
                        {/* Streak */}
                        <div className="flex gap-3">
                            <div className="text-2xl">☕</div>
                            <div>
                                <h4 className="font-bold text-deep-teal dark:text-white mb-1">
                                    {localT('learning_hub.rules_streak_title', '每日咖啡连击', i18n)}
                                </h4>
                                <p className="text-arabian-night/70 dark:text-slate-350 leading-relaxed text-xs">
                                    {localT('learning_hub.rules_streak_desc', '每天学习任一课程即可完成今日打卡，连续打卡可累积咖啡连击天数。', i18n)}
                                </p>
                            </div>
                        </div>

                        {/* Caravan */}
                        <div className="flex gap-3">
                            <div className="text-2xl">🐫</div>
                            <div>
                                <h4 className="font-bold text-deep-teal dark:text-white mb-1">
                                    {localT('learning_hub.rules_caravan_title', '沙漠商队进度', i18n)}
                                </h4>
                                <p className="text-arabian-night/70 dark:text-slate-350 leading-relaxed text-xs">
                                    {localT('learning_hub.rules_caravan_desc', '累积有效学习时长（分钟），商队将向下一个绿洲进发。学时达到门槛即可解锁更高荣誉等级。', i18n)}
                                </p>
                            </div>
                        </div>

                        {/* Certificate */}
                        <div className="flex gap-3">
                            <div className="text-2xl">🏆</div>
                            <div>
                                <h4 className="font-bold text-deep-teal dark:text-white mb-1">
                                    {localT('learning_hub.rules_cert_title', '荣誉勋章与证书', i18n)}
                                </h4>
                                <p className="text-arabian-night/70 dark:text-slate-350 leading-relaxed text-xs">
                                    {localT('learning_hub.rules_cert_desc', '解锁每个荣誉等级均可获得 51Talk 官方认证的荣誉证书，可下载并分享。', i18n)}
                                </p>
                            </div>
                        </div>

                        {/* Level Thresholds */}
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                            <h4 className="font-extrabold text-deep-teal dark:text-white text-xs mb-2">
                                {localT('learning_hub.rules_levels_title', '荣誉等级门槛：', i18n)}
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-arabian-night/80 dark:text-slate-400">
                                <div className="flex items-center gap-1">🌱 {localT('level.apprentice.title', '寻宝新手', i18n)}: <span className="font-mono text-desert-gold font-bold">0+ mins</span></div>
                                <div className="flex items-center gap-1">🐫 {localT('level.voyager.title', '沙漠追踪者', i18n)}: <span className="font-mono text-desert-gold font-bold">600+ mins</span></div>
                                <div className="flex items-center gap-1">🐎 {localT('level.knight.title', '佩特拉开拓者', i18n)}: <span className="font-mono text-desert-gold font-bold">1800+ mins</span></div>
                                <div className="flex items-center gap-1">🦅 {localT('level.falcon.title', '精英猎人', i18n)}: <span className="font-mono text-desert-gold font-bold">3600+ mins</span></div>
                                <div className="flex items-center gap-1 col-span-2">💎 {localT('level.guardian.title', '宝库传奇', i18n)}: <span className="font-mono text-desert-gold font-bold">7200+ mins</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };



    // Leaderboard should only show on the main tab without active searches
    const showLeaderboard = activeTab === 'all' && sortType !== 'leaderboard' && !searchQuery && !taskId && !targetRecordingId;

    return (
        <div className={`space-y-8 animate-in fade-in duration-500 pb-12 overflow-x-hidden ${isNative ? 'pt-2' : ''}`}>
            {!taskId && !targetRecordingId ? (
                <div className="flex flex-col lg:flex-row gap-6 items-stretch w-full relative z-30">
                    <div className={`flex-1 relative transition-all duration-700 ${
                        isNative 
                            ? 'p-0 border-0 bg-transparent shadow-none'
                            : `backdrop-blur-xl rounded-[2.5rem] border p-6 sm:p-8 md:p-10 overflow-hidden ${
                                businessType === 'leader'
                                    ? 'bg-gradient-to-r from-teal-950 via-deep-teal to-desert-gold/20 shadow-[0_12px_50px_rgba(203,161,53,0.15)] border-desert-gold/30'
                                    : 'bg-gradient-to-br from-white/92 via-[#FCFAF5]/88 to-[#F5ECE2]/80 border-[#E6DFD3]/80 shadow-[0_16px_45px_rgba(139,92,26,0.06)] backdrop-blur-2xl'
                              }`
                    }`}>
                        {/* Premium Decorative Background Elements */}
                        {!isNative && (
                            businessType === 'leader' ? (
                                <>
                                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-desert-gold/30 via-yellow-500/10 to-transparent rounded-full -translate-y-1/3 translate-x-1/4 pointer-events-none blur-3xl animate-pulse duration-[8000ms]"></div>
                                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-yellow-600/15 to-transparent rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none blur-2xl"></div>
                                </>
                            ) : (
                                <>
                                    <div className="absolute top-0 right-0 w-[650px] h-[650px] bg-gradient-to-bl from-desert-gold/15 via-amber-500/5 to-transparent rounded-full -translate-y-1/3 translate-x-1/4 pointer-events-none blur-3xl animate-pulse duration-[10000ms]"></div>
                                    <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-gradient-to-tr from-deep-teal/10 via-teal-500/5 to-transparent rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none blur-3xl"></div>
                                </>
                            )
                        )}
                        
                        <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 relative z-30">
                            <div>
                                <div className="flex flex-col">
                                    <h2 className={isNative ? "text-3xl font-black text-slate-800 tracking-tight" : "text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-deep-teal to-teal-800 tracking-tight"}>{t('learning_hub.explore')}</h2>
                                    {!isNative && (
                                        <div className="mt-3 flex items-center gap-3">
                                            <span className="w-10 h-1 bg-gradient-to-r from-desert-gold to-yellow-500 rounded-full shadow-sm"></span>
                                            <p className="text-base font-extrabold text-desert-gold tracking-wide italic bg-clip-text text-transparent bg-gradient-to-r from-desert-gold to-yellow-600">
                                                "{t('learning_hub.slogan')}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Actions Right Side */}
                            <div className="flex flex-col gap-4 w-full md:w-auto items-end">
                                {allowedTabs.length > 1 ? (
                                    <div className="p-1 rounded-full flex items-center w-full md:w-auto self-start md:self-end overflow-x-auto whitespace-nowrap scrollbar-none bg-white/70 backdrop-blur-md border border-white/50 shadow-sm">
                                        {allowedTabs.map(tab => (
                                            <button
                                                key={tab.type}
                                                onClick={() => {
                                                    if (tab.type === 'referral') {
                                                        navigate('/referrals');
                                                    } else {
                                                        setBusinessType(tab.type);
                                                        setActiveTab('all');
                                                        setSelectedLecturer('');
                                                    }
                                                }}
                                                className={`flex-1 md:flex-none px-4 md:px-6 py-2 md:py-2.5 rounded-full font-extrabold transition-all duration-300 text-xs sm:text-sm select-none cursor-pointer ${
                                                    businessType === tab.type 
                                                        ? `bg-gradient-to-r ${tab.gradient} text-white shadow-md shadow-slate-900/10 scale-[1.02] transform`
                                                        : 'text-arabian-night/65 hover:text-arabian-night hover:bg-white/40'
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : allowedTabs.length === 1 ? (
                                    <div className={`bg-gradient-to-r ${allowedTabs[0].gradient} text-white px-6 md:px-8 py-2 md:py-3 rounded-full font-extrabold text-xs sm:text-sm md:text-base shadow-lg shadow-black/10 flex items-center gap-2 select-none self-start md:self-end`}>
                                        <span>✨</span>
                                        <span>{allowedTabs[0].label}</span>
                                    </div>
                                ) : null}

                                {/* Search Bar */}
                                <div ref={searchRef} className="relative w-full md:w-80 lg:w-[420px] shrink-0 group z-50">
                                    <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none transition-colors group-focus-within:text-desert-gold">
                                        <Search className={`h-5 w-5 transition-colors group-focus-within:text-desert-gold ${
                                            businessType === 'leader' ? 'text-white/40' : 'text-arabian-night/40'
                                        }`} />
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
                                        className={`w-full ps-12 pe-5 py-3 border rounded-full transition-all text-sm font-semibold outline-none ${
                                            businessType === 'leader'
                                                ? 'bg-teal-950/60 border-desert-gold/30 text-white placeholder:text-white/40 focus:ring-4 focus:ring-desert-gold/30 focus:border-desert-gold'
                                                : 'bg-white border-[#E6DFD3] text-arabian-night placeholder:text-arabian-night/30 focus:ring-4 focus:ring-desert-gold/20 focus:border-desert-gold hover:bg-white shadow-sm'
                                        }`}
                                    />

                                    {/* Autocomplete Suggestions Panel */}
                                    {showSuggestions && searchQuery.trim().length > 0 && (matchingLecturers.length > 0 || matchingTitles.length > 0) && (
                                        <div className={`absolute top-full left-0 right-0 mt-2 backdrop-blur-xl border rounded-2xl shadow-xl py-3 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50 max-h-[380px] overflow-y-auto scrollbar-thin ${
                                            businessType === 'leader'
                                                ? 'bg-teal-950/95 border-desert-gold/30 text-white shadow-[0_4px_25px_rgba(203,161,53,0.15)]'
                                                : 'bg-white/95 border-gray-200/60 text-arabian-night shadow-xl'
                                        }`}>
                                            {/* Lecturers Section */}
                                            {matchingLecturers.length > 0 && (
                                                <div className="mb-2">
                                                    <div className={`px-4 py-1.5 text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5 select-none ${
                                                        businessType === 'leader' ? 'text-desert-gold bg-teal-900/40' : 'text-deep-teal bg-gray-50'
                                                    }`}>
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
                                                                className={`px-5 py-2.5 cursor-pointer text-sm font-bold transition-colors flex items-center gap-2 ${
                                                                    businessType === 'leader'
                                                                        ? 'hover:bg-teal-900/40 text-white hover:text-desert-gold'
                                                                        : 'hover:bg-gradient-to-r hover:from-desert-gold/10 hover:to-transparent hover:text-desert-gold text-arabian-night'
                                                                }`}
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
                                                    <div className={`px-4 py-1.5 text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5 select-none ${
                                                        businessType === 'leader' ? 'text-desert-gold bg-teal-900/40' : 'text-deep-teal bg-gray-50'
                                                    }`}>
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
                                                                className={`px-5 py-2.5 cursor-pointer text-sm font-bold transition-colors flex items-center gap-2.5 ${
                                                                    businessType === 'leader'
                                                                        ? 'hover:bg-teal-900/40 text-white hover:text-desert-gold'
                                                                        : 'hover:bg-gradient-to-r hover:from-desert-gold/10 hover:to-transparent hover:text-desert-gold text-arabian-night'
                                                                }`}
                                                            >
                                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-extrabold shrink-0 border ${
                                                                    businessType === 'leader'
                                                                        ? 'bg-teal-900/30 border-desert-gold/20'
                                                                        : 'bg-deep-teal/5 border-deep-teal/10'
                                                                }`}>
                                                                    🎬
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className={`truncate text-sm font-bold ${
                                                                        businessType === 'leader' ? 'text-white' : 'text-arabian-night'
                                                                    }`}>{highlightMatch(rec.title, searchQuery)}</div>
                                                                    {rec.lecturerName && (
                                                                        <div className={`text-[10px] truncate font-semibold mt-0.5 ${
                                                                            businessType === 'leader' ? 'text-white/45' : 'text-arabian-night/50'
                                                                        }`}>{rec.lecturerName}</div>
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
                        </header>

                        {/* Oasis Honor Compact Widget */}
                        <div className="mt-6 z-30 relative">
                            {renderCompactOasisHonorWidget()}
                        </div>

                        {/* Primary Plaza Mode Tab Switcher */}
                        {isNative && (
                            <div className="mt-6 relative z-30 flex bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-1 rounded-2xl border border-[#E6DFD3] dark:border-white/10 w-full md:w-[480px] self-start shadow-sm shadow-[#8b5c1a]/5">
                                <button
                                    onClick={() => setPlazaMode('recordings')}
                                    className={`flex-1 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                                        plazaMode === 'recordings'
                                            ? 'bg-gradient-to-r from-deep-teal to-teal-700 text-white shadow-md'
                                            : 'text-[#0D5C75]/75 hover:text-[#0D5C75] dark:text-slate-400 dark:hover:text-white hover:bg-white/40'
                                    }`}
                                >
                                    <span>🎙️</span> {localT('learning_hub.tab_recordings', '录音广场', i18n)}
                                </button>
                                <button
                                    onClick={() => setPlazaMode('policies')}
                                    className={`flex-1 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                                        plazaMode === 'policies'
                                            ? 'bg-gradient-to-r from-deep-teal to-teal-700 text-white shadow-md'
                                            : 'text-[#0D5C75]/75 hover:text-[#0D5C75] dark:text-slate-400 dark:hover:text-white hover:bg-white/40'
                                    }`}
                                >
                                    <span>📋</span> {localT('learning_hub.tab_policies', '政策激励', i18n)}
                                </button>
                                <button
                                    onClick={() => setPlazaMode('brands')}
                                    className={`flex-1 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                                        plazaMode === 'brands'
                                            ? 'bg-gradient-to-r from-deep-teal to-teal-700 text-white shadow-md'
                                            : 'text-[#0D5C75]/75 hover:text-[#0D5C75] dark:text-slate-400 dark:hover:text-white hover:bg-white/40'
                                    }`}
                                >
                                    <span>🎨</span> {localT('learning_hub.tab_brands', '品牌专栏', i18n)}
                                </button>
                            </div>
                        )}

                        {/* Premium Segmented Switcher for Hub Scopes */}
                        {plazaMode === 'recordings' && (
                            <div className="mt-8 border-t border-deep-teal/5 dark:border-white/5 pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 z-40 relative">
                            {/* Scope Toggle buttons */}
                            <div className="relative flex bg-[#0D5C75]/5 dark:bg-slate-950/40 p-1 rounded-2xl border border-[#0D5C75]/15 dark:border-white/10 w-full md:w-[380px] self-start shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] backdrop-blur-md">
                                {/* Sliding Background Indicator */}
                                <div
                                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-gradient-to-r from-[#0D5C75] to-teal-600 dark:from-desert-gold dark:to-amber-500 shadow-md shadow-teal-900/20 dark:shadow-desert-gold/20 transition-all duration-300 ease-out z-0 ${
                                        i18n.language?.startsWith('ar') ? 'right-1' : 'left-1'
                                    }`}
                                    style={{
                                        transform: i18n.language?.startsWith('ar')
                                            ? (hubScope === 'public' ? 'translateX(0)' : 'translateX(-100%)')
                                            : (hubScope === 'public' ? 'translateX(0)' : 'translateX(100%)'),
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        setHubScope('public');
                                    }}
                                    className={`relative z-10 w-1/2 py-2.5 rounded-xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                                        hubScope === 'public'
                                            ? 'text-white dark:text-arabian-night'
                                            : 'text-[#0D5C75]/60 hover:text-[#0D5C75] dark:text-slate-400 dark:hover:text-white'
                                    }`}
                                >
                                    <span className={`transition-transform duration-300 ${hubScope === 'public' ? 'scale-110 rotate-12' : ''}`}>🌍</span>
                                    {t('learning_hub.public_hub', '公共学习中心')}
                                </button>
                                <button
                                    onClick={() => {
                                        setHubScope('team');
                                        if (profile?.role === 'sm') {
                                            setActiveSmId(profile.crmId || '');
                                        }
                                    }}
                                    className={`relative z-10 w-1/2 py-2.5 rounded-xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                                        hubScope === 'team'
                                            ? 'text-white dark:text-arabian-night'
                                            : 'text-[#0D5C75]/60 hover:text-[#0D5C75] dark:text-slate-400 dark:hover:text-white'
                                    }`}
                                >
                                    <span className={`transition-transform duration-300 ${hubScope === 'team' ? 'scale-110 -rotate-12' : ''}`}>👥</span>
                                    {t('learning_hub.team_hub', '团队学习中心')}
                                </button>
                            </div>

                            {/* Team Dropdown Filter (Visible to SD / Super Admin in Team Scope) */}
                            {hubScope === 'team' && (profile?.role === 'super_admin' || profile?.role === 'sd') && (
                                <div className="flex items-center gap-2.5 text-sm font-bold text-deep-teal self-start md:self-end">
                                    <span>🎯 {t('learning_hub.select_sm_team', '所属团队')}:</span>
                                    <select
                                        value={activeSmId}
                                        onChange={(e) => setActiveSmId(e.target.value)}
                                        className="bg-white/80 border border-gray-200 rounded-xl px-4 py-2 outline-none text-sm font-bold text-deep-teal cursor-pointer shadow-sm focus:ring-2 focus:ring-desert-gold focus:border-transparent"
                                    >
                                        <option value="all">
                                            {i18n.language === 'ar' ? 'جميع الفرق' : i18n.language === 'en' ? 'All Teams' : '所有团队'}
                                        </option>
                                        {systemUsers
                                            .filter(u => u.role === 'sm' && (profile?.role === 'super_admin' || u.sd === profile?.crmId))
                                            .map(u => (
                                                <option key={u.crmId} value={u.crmId}>
                                                    {u.name || u.crmId} ({u.crmId})
                                                </option>
                                            ))
                                        }
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                    </div>
                </div>
            ) : (
                /* Focused view: taskId or targetRecordingId is present */
                <div className={`relative transition-all duration-700 ${
                    isNative 
                        ? 'p-0 border-0 bg-transparent shadow-none'
                        : `backdrop-blur-xl rounded-[2.5rem] border p-6 sm:p-8 md:p-10 overflow-hidden ${
                            businessType === 'leader'
                                ? 'bg-gradient-to-r from-teal-950 via-deep-teal to-desert-gold/20 shadow-[0_12px_50px_rgba(203,161,53,0.15)] border-desert-gold/30'
                                : 'bg-[#F8F5F0]/95 border-[#E6DFD3] shadow-[0_12px_45px_rgba(139,92,26,0.05)]'
                          }`
                }`}>
                    {/* Premium Decorative Background Elements */}
                    {!isNative && (
                        businessType === 'leader' ? (
                            <>
                                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-desert-gold/30 via-yellow-500/10 to-transparent rounded-full -translate-y-1/3 translate-x-1/4 pointer-events-none blur-3xl animate-pulse duration-[8000ms]"></div>
                                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-yellow-600/15 to-transparent rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none blur-2xl"></div>
                            </>
                        ) : (
                            <>
                                <div className="absolute top-0 right-0 w-[650px] h-[650px] bg-gradient-to-bl from-desert-gold/15 via-amber-500/5 to-transparent rounded-full -translate-y-1/3 translate-x-1/4 pointer-events-none blur-3xl animate-pulse duration-[10000ms]"></div>
                                <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-gradient-to-tr from-deep-teal/10 via-teal-500/5 to-transparent rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none blur-3xl"></div>
                            </>
                        )
                    )}
                    
                    <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 relative z-30">
                        <div>
                            {taskId ? (
                                <>
                                    <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-deep-teal to-teal-700">{t('learning_hub.task_exclusive')}</h2>
                                    <p className="text-arabian-night/60 mt-2 font-medium">{t('learning_hub.task_need_listen')} <span className="font-bold text-arabian-night">{taskTitle}</span></p>
                                    <button onClick={() => setSearchParams({})} className="text-sm font-bold text-desert-gold mt-3 hover:text-yellow-600 transition-colors flex items-center gap-1 group">
                                        <span className="group-hover:-translate-x-1 transition-transform">←</span> {t('learning_hub.back_to_courses')}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-deep-teal to-teal-700">{t('learning_hub.shared_recording_title', '推荐学习素材')}</h2>
                                    <p className="text-arabian-night/60 mt-2 font-medium">{t('learning_hub.shared_recording_desc', '正在播放为您推荐的精品销售实战录音，助推专业成长！')}</p>
                                    <button onClick={() => setSearchParams({})} className="text-sm font-bold text-desert-gold mt-3 hover:text-yellow-600 transition-colors flex items-center gap-1 group">
                                        <span className="group-hover:-translate-x-1 transition-transform">←</span> {t('learning_hub.back_to_courses')}
                                    </button>
                                </>
                            )}
                        </div>
                    </header>
                </div>
            )}

            {!taskId && !targetRecordingId ? (
                <div className="space-y-8 mt-8 animate-in slide-in-from-bottom-4 duration-700">
                        {/* Rolling Banner Slider */}
                        {displayBanners.length > 0 && (
                            <div className="relative w-full rounded-3xl overflow-hidden glass-panel border border-white/60 bg-white/40 shadow-xl group aspect-[21/9] sm:aspect-[21/7] md:aspect-[21/6] z-10 animate-in fade-in duration-500">
                                {/* Slides container */}
                                <div className="relative w-full h-full">
                                    {displayBanners.map((banner, index) => (
                                        <div
                                            key={banner.id}
                                            onClick={() => handleBannerClick(banner)}
                                            className={`absolute inset-0 w-full h-full cursor-pointer transition-all duration-700 ease-in-out transform flex items-center justify-center ${
                                                index === currentBannerIndex 
                                                    ? 'opacity-100 scale-100 pointer-events-auto' 
                                                    : 'opacity-0 scale-[1.03] pointer-events-none'
                                            }`}
                                        >
                                            {/* Slide image */}
                                            <img 
                                                src={banner.imageUrl} 
                                                alt={banner.title} 
                                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-[1.02]"
                                            />
                                            
                                            {/* Glassmorphic Overlay Text Panel */}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 text-white flex flex-col justify-end h-2/3">
                                                <div className="max-w-xl space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-3 py-1 bg-desert-gold text-deep-teal font-black text-[10px] rounded-full uppercase tracking-wider shadow-sm">
                                                            {banner.categoryName || t('common.uncategorized')}
                                                        </span>
                                                        {banner.linkedTaskId && (
                                                            <span className="px-3 py-1 bg-rose-600 text-white font-black text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm animate-pulse">
                                                                <span>🎯</span>
                                                                <span>{t('learning_hub.team_task_badge', '团队任务')}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-md line-clamp-1">
                                                        {banner.title}
                                                    </h3>
                                                    {banner.linkedTaskId && (
                                                        <p className="text-xs text-white/80 font-semibold drop-shadow-sm truncate">
                                                            {t('banner_manager.task')}: {banner.linkedTaskTitle}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Left/Right Chevron Navigation */}
                                {displayBanners.length > 1 && (
                                    <>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentBannerIndex(prev => (prev - 1 + displayBanners.length) % displayBanners.length);
                                            }}
                                            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition-all cursor-pointer opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 shadow-md border border-white/10 animate-in fade-in duration-300"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentBannerIndex(prev => (prev + 1) % displayBanners.length);
                                            }}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition-all cursor-pointer opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 shadow-md border border-white/10 animate-in fade-in duration-300"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </button>

                                        {/* Bottom Indicator Dots */}
                                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                                            {displayBanners.map((_, index) => (
                                                <button
                                                    key={index}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setCurrentBannerIndex(index);
                                                    }}
                                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                                        index === currentBannerIndex 
                                                            ? 'bg-desert-gold w-6 shadow-md' 
                                                            : 'bg-white/50 hover:bg-white/80'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Super Admin / SD Scoping Filter Dropdown */}
                        {(profile?.role === 'super_admin' || profile?.role === 'sd') && smListForPreview.length > 0 && (
                            <div className="flex items-center justify-end gap-2 text-xs font-bold text-arabian-night/60 animate-in fade-in duration-300">
                                <span>👁️ {t('banner_manager.scope', '可见团队/范围')}:</span>
                                <select
                                    value={previewSmFilter}
                                    onChange={(e) => setPreviewSmFilter(e.target.value)}
                                    className="bg-white/50 border border-gray-200/50 rounded-lg px-2.5 py-1 outline-none text-xs font-bold text-deep-teal cursor-pointer"
                                >
                                    <option value="all">{t('banner_manager.all_teams', '全局 / 所有团队')}</option>
                                    {smListForPreview.map(smId => (
                                        <option key={smId} value={smId}>{t('banner_manager.team_exclusive', { sm: smId })}</option>
                                    ))}
                                </select>
                            </div>
                        )}



                        {/* Main Content & Sidebar Columns */}
                        <div className="flex flex-col xl:flex-row gap-8 items-start">
                            {/* Left Column */}
                            <div className="flex-1 w-full min-w-0 space-y-8">
                                {plazaMode === 'recordings' && (
                                    <>
                                        {/* Category Tabs */}
                                <div className={`pt-2 relative z-10 ${
                            businessType === 'leader' ? 'border-t border-desert-gold/20' : 'border-t border-[#E6DFD3]'
                        }`}>
                            <div className={`flex gap-2.5 py-2 overflow-x-auto scrollbar-none ${isNative ? 'w-full pb-3' : 'flex-wrap'}`}>
                                <button
                                    onClick={() => { setActiveTab('all'); setSelectedLecturer(''); if (sortType === 'leaderboard') setSortType('latest'); }}
                                    className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 whitespace-nowrap cursor-pointer ${
                                        activeTab === 'all' 
                                            ? businessType === 'leader'
                                                ? 'bg-gradient-to-r from-desert-gold to-yellow-600 text-white shadow-lg shadow-yellow-600/30 scale-105 border-transparent font-black'
                                                : 'bg-gradient-to-r from-deep-teal to-teal-700 text-white shadow-md shadow-teal-900/20 scale-[1.03] border-transparent font-black' 
                                            : businessType === 'leader'
                                                ? 'bg-teal-950/40 backdrop-blur-sm text-white/70 border border-desert-gold/30 hover:border-desert-gold hover:text-white hover:bg-teal-900/60 hover:-translate-y-0.5 hover:shadow-md'
                                                : 'bg-white border border-[#E6DFD3] text-slate-800 hover:border-desert-gold/60 hover:text-desert-gold hover:-translate-y-0.5 hover:shadow-sm'
                                    }`}
                                >
                                    {t('learning_hub.all_content')}
                                </button>
                                {categories.filter(cat => (cat.businessType || 'kid') === businessType).map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => { setActiveTab(cat.id); setSelectedLecturer(''); if (sortType === 'leaderboard') setSortType('latest'); }}
                                        className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 whitespace-nowrap cursor-pointer ${
                                            activeTab === cat.id 
                                                ? businessType === 'leader'
                                                    ? 'bg-gradient-to-r from-desert-gold to-yellow-600 text-white shadow-lg shadow-yellow-600/30 scale-105 border-transparent font-black'
                                                    : 'bg-gradient-to-r from-deep-teal to-teal-700 text-white shadow-md shadow-teal-900/20 scale-[1.03] border-transparent font-black' 
                                                : businessType === 'leader'
                                                    ? 'bg-teal-950/40 backdrop-blur-sm text-white/70 border border-desert-gold/30 hover:border-desert-gold hover:text-white hover:bg-teal-900/60 hover:-translate-y-0.5 hover:shadow-md'
                                                    : 'bg-white border border-[#E6DFD3] text-slate-800 hover:border-desert-gold/60 hover:text-desert-gold hover:-translate-y-0.5 hover:shadow-sm'
                                        }`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Lecturers Filter */}
                        {activeTab !== 'leaderboard' && sortedLecturers.length > 0 && (
                            <div className={`pt-5 border-t relative z-10 animate-in fade-in duration-700 ${
                                businessType === 'leader' ? 'border-desert-gold/20' : 'border-gray-100/60'
                            }`}>
                                <h4 className={`text-sm font-extrabold mb-4 flex items-center gap-2 ${
                                    businessType === 'leader' ? 'text-desert-gold' : 'text-deep-teal'
                                }`}>
                                    <span className={`w-6 h-6 rounded-md flex items-center justify-center ${
                                        businessType === 'leader' ? 'bg-desert-gold/20' : 'bg-desert-gold/10'
                                    }`}>
                                        <User className="w-4 h-4 text-desert-gold" />
                                    </span>
                                    {t('learning_hub.popular_lecturers', 'Top Lecturers')}
                                </h4>
                                <div className={`flex gap-3 py-2 pb-4 overflow-x-auto scrollbar-none ${isNative ? 'w-full pb-3' : 'flex-wrap'}`}>
                                    {(showAllLecturers ? sortedLecturers : sortedLecturers.slice(0, 10)).map(lecturer => (
                                        <button
                                            key={lecturer}
                                            onClick={() => setSelectedLecturer(selectedLecturer === lecturer ? '' : lecturer)}
                                            className={`flex shrink-0 items-center gap-2 pr-5 pl-1.5 py-1.5 rounded-full font-bold transition-all duration-300 group cursor-pointer ${
                                                selectedLecturer === lecturer 
                                                    ? 'bg-gradient-to-r from-desert-gold to-yellow-600 text-white scale-105 shadow-lg shadow-yellow-600/20 border-transparent ring-2 ring-yellow-400/30 ring-offset-1' 
                                                    : businessType === 'leader'
                                                        ? 'bg-teal-950/40 border border-desert-gold/20 text-white/70 hover:border-desert-gold/80 hover:bg-teal-900/40 hover:text-white'
                                                        : 'bg-white/80 backdrop-blur-sm text-arabian-night/80 border border-gray-200/80 hover:border-desert-gold/50 hover:bg-white hover:-translate-y-1 hover:shadow-md'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-300 shadow-sm overflow-hidden border-2 ${
                                                selectedLecturer === lecturer 
                                                    ? 'border-white/40 bg-white/20 text-white' 
                                                    : businessType === 'leader'
                                                        ? 'border-desert-gold/30 bg-teal-950 text-desert-gold'
                                                        : 'border-transparent bg-gray-100 text-gray-500 group-hover:border-desert-gold/30 group-hover:bg-desert-gold/5'
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
                                            className="flex shrink-0 items-center gap-2 px-5 py-2.5 rounded-full font-extrabold text-sm transition-all duration-300 bg-white/80 backdrop-blur-sm text-desert-gold border border-gray-200/80 hover:border-desert-gold/50 hover:bg-white hover:-translate-y-1 hover:shadow-md cursor-pointer group shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
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

                        {/* Recordings list container */}
                        {loading ? (
                            <div className="flex justify-center py-20">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-desert-gold"></div>
                            </div>
                        ) : filteredRecordings.length === 0 && sortType !== 'leaderboard' ? (
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
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 pb-2 border-b border-gray-100">
                                    <div className="flex items-center gap-3 pl-3 border-l-4 border-deep-teal">
                                        <h3 className="text-xl font-extrabold text-deep-teal">
                                            {activeTab === 'all' 
                                                ? t('learning_hub.discover_content', '发现内容')
                                                : categories.find(c => c.id === activeTab)?.name || t('learning_hub.discover_content', '发现内容')}
                                        </h3>
                                    </div>
                                    <div className="flex bg-gray-100/70 p-1.5 rounded-xl shrink-0 border border-gray-200/50 shadow-inner max-w-full overflow-x-auto scrollbar-none">
                                        <button 
                                            onClick={() => setSortType('latest')}
                                            className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-[15px] font-extrabold transition-all flex items-center gap-1.5 ${sortType === 'latest' ? 'bg-white text-deep-teal shadow-md border border-gray-200/50 scale-105' : 'text-arabian-night/60 hover:text-deep-teal hover:bg-white/50'}`}
                                        >
                                            <span className="text-lg">🆕</span> {t('common.sort_newest', '最新排序')}
                                        </button>
                                        <button 
                                            onClick={() => setSortType('popular')}
                                            className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-[15px] font-extrabold transition-all flex items-center gap-1.5 ${sortType === 'popular' ? 'bg-white text-desert-gold shadow-md border border-gray-200/50 scale-105' : 'text-arabian-night/60 hover:text-desert-gold hover:bg-white/50'}`}
                                        >
                                            <span className="text-lg">🔥</span> {t('common.sort_popular', '最热排行')}
                                        </button>
                                        <button 
                                            onClick={() => setSortType('leaderboard')}
                                            className={`xl:hidden px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-[15px] font-extrabold transition-all flex items-center gap-1.5 ${sortType === 'leaderboard' ? 'bg-white text-desert-gold shadow-md border border-gray-200/50 scale-105' : 'text-arabian-night/60 hover:text-desert-gold hover:bg-white/50'}`}
                                        >
                                            <span className="text-lg">🏆</span> {t('learning_hub.leaderboard')}
                                        </button>
                                    </div>
                                </div>

                                {sortType === 'leaderboard' ? (
                                    <div className="w-full py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {renderLeaderboardWidget(true)}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
                                        {displayedRecordings.map(rec => (
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
                                                    onViewTranscript={setActiveTranscriptRecording}
                                                    onShare={setShareRecording}
                                                    isUnlocked={completedAudioIds.includes(rec.id)}
                                                    className="w-full h-full"
                                                    commentCount={globalCommentCounts[rec.id] || 0}
                                                    isLeader={isLeader}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

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
                        )}
                                    </>
                                )}

                                {plazaMode === 'policies' && renderFullPoliciesPlaza()}
                                {plazaMode === 'brands' && renderFullBrandsPlaza()}
                            </div>

                            {/* Right Column / Sidebar (25%) */}
                            {plazaMode === 'recordings' && (
                                <div className="w-full xl:w-[320px] 2xl:w-[360px] shrink-0 flex flex-col gap-6">
                                    {/* Compact Policies Widget */}
                                    {renderCompactPoliciesWidget()}

                                    {/* Compact Brands Widget */}
                                    {renderCompactBrandsWidget()}

                                    {/* Leaderboard Widget */}
                                    {showLeaderboard && (
                                        <div className="hidden xl:block">
                                            {renderLeaderboardWidget(false)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
            </div>
            ) : (
                /* Focused Mode: taskId or targetRecordingId is present */
                <div className="space-y-8 mt-8">
                    {/* Task Submission Card */}
                    {taskId && (
                        <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/50 relative z-10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 shadow-sm">
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

                    {/* Recordings List */}
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-desert-gold"></div>
                        </div>
                    ) : (
                        <div className="pt-2">
                            <div className="flex flex-col gap-6">
                                {taskId ? (
                                    validTaskRecordingIds.length === 0 ? (
                                        <div className="text-center py-10 text-arabian-night/50 font-bold">{t('learning_hub.no_recordings_for_task', '该任务没有关联录音，或录音已被管理员删除')}</div>
                                    ) : (
                                        validTaskRecordingIds.map(recId => {
                                            const rec = recordings.find(r => r.id === recId);
                                            if (!rec) return null;
                                            return (
                                                <div key={recId} className="flex flex-col lg:flex-row gap-6 items-stretch bg-white/40 p-4 rounded-3xl border border-white shadow-sm">
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
                                                            onViewTranscript={setActiveTranscriptRecording}
                                                            onShare={setShareRecording}
                                                            disableSeek={!isTaskCompleted}
                                                            isUnlocked={completedAudioIds.includes(rec.id)}
                                                            className="w-full h-full"
                                                            commentCount={globalCommentCounts[recId] || 0}
                                                            isLeader={isLeader}
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
                                                onViewTranscript={setActiveTranscriptRecording}
                                                onShare={setShareRecording}
                                                isUnlocked={completedAudioIds.includes(rec.id)}
                                                className="w-full h-full"
                                                commentCount={globalCommentCounts[rec.id] || 0}
                                                isLeader={isLeader}
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
                    )}

                    {/* Leaderboard Widget */}
                    {showLeaderboard && (
                        <div className="hidden xl:block xl:w-[320px] 2xl:w-[360px] shrink-0">
                            {renderLeaderboardWidget(false)}
                        </div>
                    )}
                </div>
            )}
            {activeVideoRecording && (
                <VideoPlayerModal
                    rec={activeVideoRecording}
                    disableSeek={activeVideoDisableSeek}
                    isUnlocked={isLeader || completedAudioIds.includes(activeVideoRecording.id)}
                    onUnlock={(dur) => handleAudioEnded(activeVideoRecording, dur)}
                    onClose={() => {
                        setActiveVideoRecording(null);
                        if (targetRecordingId && activeVideoRecording.id === targetRecordingId) {
                            setSearchParams(prev => {
                                const newParams = new URLSearchParams(prev);
                                newParams.delete('recordingId');
                                return newParams;
                            });
                        }
                    }}
                    onEnded={(duration, actualSec) => {
                        handleAudioEnded(activeVideoRecording, duration, actualSec);
                    }}
                />
            )}
            {activeTranscriptRecording && (
                <DirectTranscriptModal
                    rec={activeTranscriptRecording}
                    onClose={() => setActiveTranscriptRecording(null)}
                />
            )}
            {shareRecording && (
                <SharePosterModal
                    rec={shareRecording}
                    onClose={() => setShareRecording(null)}
                />
            )}
            {activePolicyItem && (
                <PolicyPreviewModal
                    policy={activePolicyItem}
                    onClose={() => setActivePolicyItem(null)}
                />
            )}
            {showCertificate && renderCertificateModal()}
            {renderRulesModal()}
            {showHonorModal && renderOasisHonorDetailModal()}
        </div>
    );
}
