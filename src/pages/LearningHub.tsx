import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, getDoc, setDoc, increment, where, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { PlayCircle, Clock, User, Search, Moon, Heart, Headphones, Trophy, Play, X, ChevronDown, ChevronUp, Share2, FileText, BookOpen, Lock, LockOpen, Send, MessageSquare, ThumbsUp, Flag, Pin, Check, ChevronLeft, ChevronRight, Download } from 'lucide-react';
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
    transcript?: string;
    transcriptStatus?: string;
    uploaderId?: string;
    uploaderCrmId?: string;
    attachments?: any[];
}

interface Category {
    id: string;
    name: string;
}

const generateMockTranslation = (rec: any) => {
    const displayId = rec.displayId || 'RD';
    const title = rec.title || 'Sales Call';
    const desc = rec.description || 'فهم احتياجات العميل وتقديم الحلول المناسبة لمساعدته في تحقيق أهدافه المهنية وتسريع تطوره';
    const lecturer = rec.lecturerName || 'مستشار مبيعات';
    const category = rec.categoryName || 'مبيعات';

    return `[专业销售培训文档 - 中文对照翻译]
编号：[${displayId}]
培训分类：${category}
主讲人/培训师：${lecturer} 老师
课程主题：${title}

会话背景介绍：
${desc}

--------------------------------------------------
完整对话与互动转写（中文翻译）：

培训师 (${lecturer})：大家好，感谢大家加入 ME Cloud Academy 学习平台。我是你们的培训顾问 ${lecturer}。今天很高兴能和大家一起讨论我们非常重要的实战案例：“${title}”。首先，大家对于这部分内容有什么需要特别关注的吗？
客户/受训销售：您好，${lecturer} 老师。我非常认真地听了“${title}”的相关录音和细节，感觉这方面内容对我们真的非常关键。但我很想请教您：我们如何在日常的实际销售工作中具体融入这些方法，从而提高成单率呢？
培训师 (${lecturer})：这是一个非常棒且极其核心的问题！这正是我们在“${title}”模块中重点关注的内容。核心思想是关于“${desc}”。成功的秘诀不仅在于理论理解，更在于打磨现场演示能力以及应对客户异议时的机敏反应。
客户/受训销售：是的，完全正确。我们在谈判过程中，有时确实很难保持对话的顺畅流动和临场反应，您有什么具体的实战框架推荐吗？
培训师 (${lecturer})：当然有。在“${title}”课程中，我们采用基于真实场景和即时角色扮演的互动教学法。这种高强度的模拟训练将为大家提供超越单纯说教的“超值价值”（Extra Value），让大家能够针对不同类型的客户定制出最具说服力的应答方案。
客户/受训销售：太棒了！我觉得这种循序渐进的方法能够给我们的业绩带来实实在在的提升，非常期待接下来的课程和实际演练。
培训师 (${lecturer})：这正是 ME Cloud Academy 的最高目标！我这就把本次课程的完整指导手册和配套参考附件发送给你，希望能全力支持你的职业发展。欢迎加入我们，让我们立刻开启卓越之旅！`;
};

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
    const isLiked = rec.likes?.includes(user?.uid || '');
    const isFav = favorites.includes(rec.id);
    const isVideo = isVideoUrl(rec.audioUrl);
    const isDoc = isDocUrl(rec.audioUrl) || 
                  rec.categoryName?.toLowerCase() === 'doc' || 
                  rec.categoryName === '文档' || 
                  rec.categoryName === 'ss文档' || 
                  rec.categoryName?.toLowerCase() === 'document';

    return (
        <div className={`glass-panel rounded-2xl hover:-translate-y-2 overflow-hidden relative flex flex-col transition-all duration-500 ease-out group ${className} ${
            rec.businessType === 'leader'
                ? 'border-desert-gold/40 shadow-[0_0_15px_rgba(203,161,53,0.15)] hover:shadow-[0_0_25px_rgba(203,161,53,0.3)] bg-gradient-to-br from-teal-950/20 to-desert-gold/5'
                : 'border-white/60 hover:shadow-[0_25px_60px_rgba(26,43,60,0.06)] shadow-sm bg-white/60'
        }`}>
            {isDoc ? (
                /* Premium Document Cover with sunset-to-indigo gradient and floating glassmorphic shapes */
                <div 
                    onClick={() => onPlayVideo(rec, disableSeek)}
                    className="w-full h-28 bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 relative flex items-center justify-center cursor-pointer overflow-hidden border-b border-white/10 group/doc shrink-0 animate-in fade-in duration-500"
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
            <div className="relative z-10 p-5 flex flex-col flex-1 pt-2">
                {/* Circular Avatar & Category */}
                <div className="-mt-10 relative z-20 flex items-end justify-between px-1 mb-3.5">
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
                        {rec.transcript && (
                            <span 
                                onClick={(e) => {
                                    if (isLeader) {
                                        e.stopPropagation();
                                        onViewTranscript && onViewTranscript(rec);
                                    }
                                }}
                                className={`text-[9.5px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-extrabold shadow-sm flex items-center gap-1.5 shrink-0 select-none backdrop-blur-md transition-all duration-300 ${
                                    isLeader ? 'cursor-pointer hover:bg-emerald-600 hover:text-white hover:border-transparent active:scale-95' : ''
                                }`}
                                title={isLeader ? t('learning_hub.click_to_view_direct', '点击直接查看阿语逐字稿') : ''}
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
                        className={`font-black text-base mb-2 transition-all duration-300 line-clamp-1 cursor-pointer ${
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
                            className="flex items-center gap-1.5 text-[11.5px] font-black text-desert-gold hover:text-amber-600 mb-2 transition-colors duration-300 cursor-pointer hover:underline"
                        >
                            <User className="h-3.5 w-3.5 text-desert-gold shrink-0" />
                            <span>{rec.lecturerName}</span>
                        </div>
                    )}
                    <p className={`text-[12px] mb-4 line-clamp-2 leading-relaxed font-semibold ${
                        rec.businessType === 'leader' ? 'text-white/60' : 'text-slate-500'
                    }`}>
                        {rec.description}
                    </p>
                </div>

                <div className={`mt-auto pt-3 border-t ${
                    rec.businessType === 'leader' ? 'border-desert-gold/15' : 'border-slate-100'
                }`}>
                    <div className="flex justify-between items-center mb-4 text-[11px] font-bold text-deep-teal">
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
                                className={`flex items-center justify-center transition-all duration-300 outline-none p-1.5 rounded-full shadow-sm hover:shadow hover:border-rose-200 active:scale-90 hover:scale-110 hover:bg-rose-50/30 cursor-pointer ${
                                    rec.businessType === 'leader'
                                        ? 'bg-teal-950/60 border-desert-gold/25 text-white/80 border'
                                        : 'bg-white border border-slate-100'
                                }`}
                                title={t('common.favorite', '收藏')}
                            >
                                <Heart className={`h-3.5 w-3.5 transition-all duration-300 ${isFav ? 'fill-rose-500 text-rose-500 scale-110' : 'text-slate-300 hover:text-rose-400'}`} />
                            </button>
                            
                            <button 
                                onClick={() => handleToggleLike(rec.id, rec.likes)}
                                className={`flex items-center gap-1 transition-all duration-300 outline-none px-2.5 py-1 rounded-full border shadow-sm hover:shadow hover:border-desert-gold/30 active:scale-90 hover:scale-110 hover:bg-amber-50/10 cursor-pointer ${
                                    rec.businessType === 'leader'
                                        ? 'bg-teal-950/60 border-desert-gold/25 text-white/80'
                                        : 'bg-white border border-slate-100'
                                }`}
                            >
                                <Moon className={`h-3.5 w-3.5 transition-all duration-300 ${isLiked ? 'fill-desert-gold text-desert-gold scale-110' : 'text-slate-300 hover:text-desert-gold'}`} />
                                <span className={`${isLiked ? 'text-desert-gold font-black' : rec.businessType === 'leader' ? 'text-white/60 font-bold' : 'text-slate-400 font-bold'} text-[11px]`}>
                                    {rec.likes?.length || 0}
                                </span>
                            </button>
                            
                            <button 
                                onClick={() => onShare && onShare(rec)}
                                className={`flex items-center justify-center transition-all duration-300 outline-none p-1.5 rounded-full shadow-sm hover:shadow hover:border-[#008f99]/30 active:scale-90 hover:scale-110 hover:bg-cyan-50/10 cursor-pointer ${
                                    rec.businessType === 'leader'
                                        ? 'bg-teal-950/60 border-desert-gold/25 text-white/80'
                                        : 'bg-white border border-slate-100'
                                }`}
                                title={t('common.share', '分享')}
                            >
                                <Share2 className="h-3.5 w-3.5 text-slate-300 hover:text-[#008f99] transition-all" />
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
                                    className="flex-1 bg-gradient-to-r from-deep-teal via-[#005f66] to-[#124d52] hover:shadow-[0_4px_12px_rgba(0,109,119,0.2)] hover:scale-[1.01] text-white text-[11px] font-bold py-2.5 px-2 rounded-xl shadow-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-all cursor-pointer border border-white/10"
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
                                        className="flex-1 bg-white hover:bg-deep-teal/5 border border-deep-teal/20 text-deep-teal hover:border-deep-teal/40 hover:shadow-sm text-[11px] font-bold py-2.5 px-2 rounded-xl flex items-center justify-center gap-1 active:scale-[0.98] transition-all duration-300 cursor-pointer"
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
                                className="w-full bg-gradient-to-r from-deep-teal via-[#005f66] to-[#124d52] hover:shadow-[0_6px_20px_rgba(0,109,119,0.25)] hover:scale-[1.01] text-white text-xs font-bold py-2.5 px-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer border border-white/10"
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
                                className="w-full bg-white hover:bg-deep-teal/5 border border-deep-teal/20 text-deep-teal hover:border-deep-teal/40 hover:shadow-md text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer text-center"
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

const VideoPlayerModal = ({ rec, disableSeek, isUnlocked, onClose, onEnded, onUnlock }: any) => {
    const { t, i18n } = useTranslation();
    const mediaRef = React.useRef<HTMLMediaElement>(null);
    const lastTimeRef = React.useRef(0);
    const [actualListenedSeconds, setActualListenedSeconds] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const isVideo = isVideoUrl(rec.audioUrl);
    const isDoc = isDocUrl(rec.audioUrl) || 
                  rec.categoryName?.toLowerCase() === 'doc' || 
                  rec.categoryName === '文档' || 
                  rec.categoryName === 'ss文档' || 
                  rec.categoryName?.toLowerCase() === 'document';

    const { user, profile } = useAuth();
    const [comments, setComments] = useState<any[]>([]);
    const [newCommentText, setNewCommentText] = useState('');
    const [replyToId, setReplyToId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [modalCurrentTime, setModalCurrentTime] = useState(0);
    const [attachTimestamp, setAttachTimestamp] = useState(false);
    const [activeModalTab, setActiveModalTab] = useState<'details' | 'ai_analysis' | 'comments'>((isVideo || isDoc) ? 'comments' : 'details');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [recordingAnalysis, setRecordingAnalysis] = useState<any>(null);

    // SD translation bypass states
    const isSDLevel = profile?.role === 'sd' || profile?.role === 'super_admin';
    const [activeVideoTab, setActiveVideoTab] = useState<'arabic' | 'chinese'>('arabic');
    const [videoTranscriptZh, setVideoTranscriptZh] = useState<string>(rec.transcriptZh || '');
    const [loadingVideoTranslation, setLoadingVideoTranslation] = useState(false);

    React.useEffect(() => {
        if (activeVideoTab === 'chinese' && !videoTranscriptZh && isSDLevel) {
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
                console.error("Error loading video translation, executing client fallback:", err);
                const mockZh = generateMockTranslation(rec);
                setVideoTranscriptZh(mockZh);
                rec.transcriptZh = mockZh;
            })
            .finally(() => setLoadingVideoTranslation(false));
        }
    }, [activeVideoTab, rec.id, videoTranscriptZh, isSDLevel]);

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
                    if (target > 0 && prev < target && next >= target && onUnlock) {
                        // Just crossed the threshold! Trigger unlock!
                        setTimeout(() => onUnlock(duration), 0);
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
                        onClick={onClose}
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
                    {isDoc ? (
                        <div className="flex flex-col items-center justify-center gap-6 py-12 w-full bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-indigo-600/10 backdrop-blur-md rounded-3xl border border-white/10 shadow-inner min-h-[300px] md:min-h-[400px] px-8 text-center animate-in fade-in duration-500">
                            <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl relative overflow-hidden transform hover:scale-105 transition-all duration-300 group">
                                <FileText className="w-12 h-12 text-white animate-pulse" />
                            </div>
                            <div className="space-y-3 max-w-md">
                                <span className="inline-flex items-center gap-1.5 text-[10px] bg-black/40 backdrop-blur-md text-white border border-white/10 px-3.5 py-1 rounded-full font-black shadow-sm uppercase tracking-widest select-none">
                                    📄 {t('learning_hub.doc_tag', '学习文档模式')}
                                </span>
                                <h4 className="text-white font-extrabold text-base leading-snug line-clamp-2 px-4">
                                    {rec.title}
                                </h4>
                            </div>
                            <a
                                href={rec.audioUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 hover:shadow-[0_8px_30px_rgba(244,63,94,0.4)] hover:scale-105 active:scale-95 text-white text-xs font-black py-3.5 px-7 rounded-2xl shadow-xl border border-white/15 transition-all duration-300 cursor-pointer"
                            >
                                <BookOpen className="w-4 h-4 shrink-0 text-white fill-white/20 animate-bounce" />
                                <span>{t('learning_hub.read_document', '阅读学习文档')}</span>
                            </a>
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

                    {(isVideo || isDoc) && (
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
                    {!(isVideo || isDoc) && (
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
                    {activeModalTab === 'details' && !(isVideo || isDoc) && (
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
                            {rec.transcript && !isVideo && (
                                <div className="mt-6 border-t border-gray-100 pt-5">
                                    {isUnlocked ? (
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
                                                            🌐 Original
                                                        </button>
                                                        <button
                                                            onClick={() => setActiveVideoTab('chinese')}
                                                            className={`px-2 py-1 rounded-md transition-all duration-200 flex items-center gap-0.5 cursor-pointer ${
                                                                activeVideoTab === 'chinese'
                                                                    ? 'bg-white text-deep-teal shadow-sm border border-gray-200/20'
                                                                    : 'text-gray-400 hover:text-gray-600'
                                                            }`}
                                                        >
                                                            🇨🇳 中文
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
                                                    <span className="text-xs font-bold animate-pulse">正在智能生成中文对照翻译...</span>
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
                                            {isAnalyzing ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                                                    <span>
                                                        {i18n.language?.startsWith('ar')
                                                            ? 'جاري التحليل الذكي...'
                                                            : i18n.language?.startsWith('en')
                                                                ? 'AI Analyzing...'
                                                                : t('learning_hub.analyzing', '智能解析中...')}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>
                                                        {i18n.language?.startsWith('ar')
                                                            ? '✨ بدء تحليل المكالمة بالذكاء الاصطناعي'
                                                            : i18n.language?.startsWith('en')
                                                                ? '✨ Start AI Call Portrait'
                                                                : t('learning_hub.generate_analysis', '启动 AI 通话体检')}
                                                    </span>
                                                </>
                                            )}
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
                                {rec.attachments.map((att: any) => (
                                    <div key={att.id} className="bg-white border border-gray-100/80 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md hover:border-desert-gold/20 transition-all group">
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            <span className="text-2xl shrink-0 select-none" role="img" aria-label="file">
                                                {att.type === 'ppt' ? '📊' : att.type === 'pdf' ? '📕' : att.type === 'image' ? '🖼️' : '📄'}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-extrabold text-xs text-arabian-night line-clamp-2 pr-1" title={att.name}>
                                                    {att.name}
                                                </p>
                                                <span className="text-[10px] font-bold text-arabian-night/40 mt-1 inline-block">
                                                    {att.size || '-'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <a
                                            href={att.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full bg-deep-teal/5 hover:bg-deep-teal hover:text-white text-deep-teal text-center py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-[0.98]"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            <span>{t('common.download_attachment', '下载')}</span>
                                        </a>
                                    </div>
                                ))}
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

const DirectTranscriptModal = ({ rec, onClose }: DirectTranscriptModalProps) => {
    const { t } = useTranslation();
    const { profile } = useAuth();
    const isSDLevel = profile?.role === 'sd' || profile?.role === 'super_admin';
    const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
    const [activeTab, setActiveTab] = useState<'arabic' | 'chinese'>('arabic');
    const [transcriptZh, setTranscriptZh] = useState<string>(rec.transcriptZh || '');
    const [loadingTranslation, setLoadingTranslation] = useState(false);

    useEffect(() => {
        if (activeTab === 'chinese' && !transcriptZh && isSDLevel) {
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
                console.error("Error loading translation, executing client fallback:", err);
                const mockZh = generateMockTranslation(rec);
                setTranscriptZh(mockZh);
                rec.transcriptZh = mockZh;
            })
            .finally(() => setLoadingTranslation(false));
        }
    }, [activeTab, rec.id, transcriptZh, isSDLevel]);

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
                                🌐 Original (العربية)
                            </button>
                            <button
                                onClick={() => setActiveTab('chinese')}
                                className={`px-3 py-1.5 rounded-md transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                                    activeTab === 'chinese'
                                        ? 'bg-white dark:bg-slate-800 text-deep-teal shadow-sm border border-gray-200/20'
                                        : 'text-gray-400 dark:text-slate-400 hover:text-gray-600'
                                }`}
                            >
                                🇨🇳 中文翻译
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
                            <span className="text-xs font-bold animate-pulse">正在智能生成中文对照翻译...</span>
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

export default function LearningHub() {
    const { t } = useTranslation();
    const { user, profile, isLeader } = useAuth();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeTab, setActiveTab] = useState<string>('all');

    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [sortType, setSortType] = useState<'latest' | 'popular'>('latest');
    const [businessType, setBusinessType] = useState<'kid' | 'adult' | 'ss' | 'leader'>('kid');
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
    
    const allowedTabs = React.useMemo(() => {
        const tabs: { type: 'kid' | 'adult' | 'ss' | 'leader'; label: string; gradient: string }[] = [];
        
        // 1. If super admin, they have access to all tabs
        if (profile?.role === 'super_admin') {
            tabs.push({ type: 'kid', label: t('common.type_kid', '青少业务'), gradient: 'from-blue-500 to-blue-600' });
            tabs.push({ type: 'adult', label: t('common.type_adult', '成人业务'), gradient: 'from-purple-500 to-purple-600' });
            tabs.push({ type: 'ss', label: t('common.type_ss', 'SS 业务'), gradient: 'from-orange-500 to-amber-600' });
            tabs.push({ type: 'leader', label: t('common.type_leader', 'Leader 学院'), gradient: 'from-teal-600 to-emerald-600' });
            return tabs;
        }

        // 2. If SS department
        if (profile?.dep === 'SS') {
            tabs.push({ type: 'ss', label: t('common.type_ss', 'SS 业务'), gradient: 'from-orange-500 to-amber-600' });
            if (isLeader) {
                tabs.push({ type: 'leader', label: t('common.type_leader', 'Leader 学院'), gradient: 'from-teal-600 to-emerald-600' });
            }
            return tabs;
        }

        // 3. For CC / standard departments
        tabs.push({ type: 'kid', label: t('common.type_kid', '青少业务'), gradient: 'from-blue-500 to-blue-600' });
        tabs.push({ type: 'adult', label: t('common.type_adult', '成人业务'), gradient: 'from-purple-500 to-purple-600' });
        if (isLeader) {
            tabs.push({ type: 'leader', label: t('common.type_leader', 'Leader 学院'), gradient: 'from-teal-600 to-emerald-600' });
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
        alert(t('learning_hub.unlocked_success', '恭喜！您已成功解锁该录音的阿语逐字稿！'));
        
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
            <div className={`backdrop-blur-xl rounded-[2rem] border p-6 sm:p-8 md:p-10 relative overflow-hidden transition-all duration-700 ${
                businessType === 'leader'
                    ? 'bg-gradient-to-r from-teal-950 via-deep-teal to-desert-gold/20 shadow-[0_12px_50px_rgba(203,161,53,0.15)] border-desert-gold/30'
                    : 'bg-white/80 border-white shadow-[0_8px_40px_rgb(0,0,0,0.04)]'
            }`}>
                {/* Premium Decorative Background Elements */}
                {businessType === 'leader' ? (
                    <>
                        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-desert-gold/30 via-yellow-500/10 to-transparent rounded-full -translate-y-1/3 translate-x-1/4 pointer-events-none blur-3xl animate-pulse duration-[8000ms]"></div>
                        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-yellow-600/15 to-transparent rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none blur-2xl"></div>
                    </>
                ) : (
                    <>
                        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-desert-gold/10 via-teal-500/5 to-transparent rounded-full -translate-y-1/3 translate-x-1/4 pointer-events-none blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-deep-teal/5 to-transparent rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none blur-2xl"></div>
                    </>
                )}
                
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
                            {allowedTabs.length > 1 ? (
                                <div className="bg-white/80 backdrop-blur-xl p-1.5 rounded-full border border-gray-200/60 shadow-md flex items-center w-full md:w-auto self-start md:self-end">
                                    {allowedTabs.map(tab => (
                                        <button
                                            key={tab.type}
                                            onClick={() => { setBusinessType(tab.type); setActiveTab('all'); setSelectedLecturer(''); }}
                                            className={`flex-1 md:flex-none px-8 py-3 rounded-full font-extrabold text-base transition-all duration-300 ${
                                                businessType === tab.type 
                                                    ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg shadow-black/10 scale-105` 
                                                    : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/50'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            ) : allowedTabs.length === 1 ? (
                                <div className={`bg-gradient-to-r ${allowedTabs[0].gradient} text-white px-8 py-3 rounded-full font-extrabold text-base shadow-lg shadow-black/10 flex items-center gap-2 select-none self-start md:self-end`}>
                                    <span>✨</span>
                                    <span>{allowedTabs[0].label}</span>
                                </div>
                            ) : null}

                            {/* Search Bar */}
                            <div ref={searchRef} className="relative w-full md:w-80 lg:w-[420px] shrink-0 group z-50">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-desert-gold">
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
                                    className={`w-full pl-12 pr-5 py-3.5 border rounded-full transition-all text-sm font-semibold outline-none ${
                                        businessType === 'leader'
                                            ? 'bg-teal-950/60 border-desert-gold/30 text-white placeholder:text-white/40 focus:ring-4 focus:ring-desert-gold/30 focus:border-desert-gold'
                                            : 'bg-white/60 backdrop-blur-md border-gray-200/80 text-arabian-night placeholder:text-arabian-night/30 focus:ring-4 focus:ring-desert-gold/20 focus:border-desert-gold hover:bg-white shadow-[0_2px_10px_rgb(0,0,0,0.02)]'
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
                    <div className={`mt-10 pt-6 border-t relative z-10 ${
                        businessType === 'leader' ? 'border-desert-gold/20' : 'border-gray-100/60'
                    }`}>
                        <div className="flex flex-wrap gap-3 py-2">
                            <button
                                onClick={() => { setActiveTab('all'); setSelectedLecturer(''); }}
                                className={`px-6 py-2.5 rounded-full font-bold transition-all duration-300 whitespace-nowrap ${
                                    activeTab === 'all' 
                                        ? businessType === 'leader'
                                            ? 'bg-gradient-to-r from-desert-gold to-yellow-600 text-white shadow-lg shadow-yellow-600/30 scale-105 border-transparent'
                                            : 'bg-gradient-to-r from-deep-teal to-teal-700 text-white shadow-lg shadow-teal-900/20 scale-105 border-transparent' 
                                        : businessType === 'leader'
                                            ? 'bg-teal-950/40 backdrop-blur-sm text-white/70 border border-desert-gold/30 hover:border-desert-gold hover:text-white hover:bg-teal-900/60 hover:-translate-y-0.5 hover:shadow-md'
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
                                            ? businessType === 'leader'
                                                ? 'bg-gradient-to-r from-desert-gold to-yellow-600 text-white shadow-lg shadow-yellow-600/30 scale-105 border-transparent'
                                                : 'bg-gradient-to-r from-deep-teal to-teal-700 text-white shadow-lg shadow-teal-900/20 scale-105 border-transparent' 
                                            : businessType === 'leader'
                                                ? 'bg-teal-950/40 backdrop-blur-sm text-white/70 border border-desert-gold/30 hover:border-desert-gold hover:text-white hover:bg-teal-900/60 hover:-translate-y-0.5 hover:shadow-md'
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
                    <div className={`mt-2 pt-5 border-t relative z-10 animate-in fade-in duration-700 ${
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
                        <div className="flex flex-wrap gap-3 py-2 pb-4">
                            {(showAllLecturers ? sortedLecturers : sortedLecturers.slice(0, 10)).map(lecturer => (
                                <button
                                    key={lecturer}
                                    onClick={() => setSelectedLecturer(selectedLecturer === lecturer ? '' : lecturer)}
                                    className={`flex items-center gap-2 pr-5 pl-1.5 py-1.5 rounded-full font-bold transition-all duration-300 group cursor-pointer ${
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
        </div>
    );
}
