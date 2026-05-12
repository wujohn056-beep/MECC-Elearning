import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, getDoc, setDoc, increment } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { PlayCircle, Clock, User, Search, Moon, Heart, Headphones, Trophy } from 'lucide-react';
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
    const audioRef = React.useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

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
            </div>
        </div>
    );
};

// Recording Card Component
const RecordingCard = ({ 
    rec, 
    user, 
    favorites, 
    handleToggleFavorite, 
    handleToggleLike, 
    handleAudioEnded,
    disableSeek = false,
    className = ""
}: any) => {
    const { t } = useTranslation();
    const isLiked = rec.likes?.includes(user?.uid || '');
    const isFav = favorites.includes(rec.id);

    return (
        <div className={`glass-panel rounded-xl hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group flex flex-col border border-white/60 overflow-hidden relative ${className}`}>
            {/* Decorative Background Top */}
            <div className="h-14 w-full bg-gradient-to-br from-light-teal to-deep-teal absolute top-0 left-0 z-0">
                <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23d4af37\' fill-opacity=\'1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E')]"></div>
            </div>

            {/* Card Content with Restored Avatar */}
            <div className="relative z-10 p-4 pt-5 flex flex-col flex-1">
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
                                title="收藏"
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
                        </div>
                    </div>
                    
                    <CustomAudioPlayer 
                        src={rec.audioUrl} 
                        onEnded={(duration) => handleAudioEnded(rec, duration)} 
                        disableSeek={disableSeek}
                    />
                </div>
            </div>
        </div>
    );
};

export default function LearningHub() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeTab, setActiveTab] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [sortType, setSortType] = useState<'latest' | 'popular'>('latest');
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
    
    // Leaderboard state
    const [allFavoritesCount, setAllFavoritesCount] = useState<Record<string, number>>({});
    const [leaderboardTab, setLeaderboardTab] = useState<'favorites' | 'likes'>('favorites');

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
                catSnapshot.forEach(doc => catData.push({ id: doc.id, name: doc.data().name }));
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

    const canSubmit = taskId && 
        taskRecordingIds.length > 0 &&
        taskRecordingIds.every(id => completedAudioIds.includes(id) && (reflections[id]?.length || 0) >= 100);

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

    // Filter recordings based on active tab and search query
    const filteredRecordings = recordings.filter(rec => {
        if (taskId && taskRecordingIds.length > 0) {
            return taskRecordingIds.includes(rec.id);
        }
        if (targetRecordingId) {
            return rec.id === targetRecordingId;
        }
        const matchesTab = activeTab === 'all' || rec.categoryId === activeTab;
        const matchesLecturer = selectedLecturer === '' || rec.lecturerName === selectedLecturer;
        const matchesSearch = searchQuery === '' || 
            (rec.lecturerName && rec.lecturerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
            rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (rec.displayId && rec.displayId.toLowerCase().includes(searchQuery.toLowerCase())) ||
            rec.id.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesSearch && matchesLecturer;
    });

    // Derive Top Lecturers from recordings
    const lecturerCounts = recordings.reduce((acc, rec) => {
        if (rec.lecturerName) {
            acc[rec.lecturerName] = (acc[rec.lecturerName] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);
    const sortedLecturers = Object.entries(lecturerCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

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

    // Calculate Leaderboard (Global)
    const displayTopFavorited = [...recordings]
        .sort((a, b) => {
            const countA = allFavoritesCount[a.id] || 0;
            const countB = allFavoritesCount[b.id] || 0;
            if (countB === countA) return (b.playCount || 0) - (a.playCount || 0);
            return countB - countA;
        })
        .slice(0, 10);
    
    const displayTopLiked = [...recordings]
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
                
                <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 relative z-10">
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
                                <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-deep-teal to-teal-700">{t('learning_hub.my_favorite_learning')}</h2>
                                <p className="text-arabian-night/60 mt-2 font-medium">{t('learning_hub.play_favorites_desc')}</p>
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
                    
                    {/* Search Bar */}
                    {!taskId && !targetRecordingId && (
                        <div className="relative w-full md:w-80 lg:w-[420px] shrink-0 group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-desert-gold">
                                <Search className="h-5 w-5 text-arabian-night/40 group-focus-within:text-desert-gold transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder={t('learning_hub.search_placeholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-5 py-3.5 border border-gray-200/80 rounded-full focus:ring-4 focus:ring-desert-gold/20 focus:border-desert-gold bg-white/60 backdrop-blur-md hover:bg-white transition-all shadow-[0_2px_10px_rgb(0,0,0,0.02)] text-sm font-semibold outline-none"
                            />
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
                                onClick={() => setActiveTab('all')}
                                className={`px-6 py-2.5 rounded-full font-bold transition-all duration-300 whitespace-nowrap ${
                                    activeTab === 'all' 
                                        ? 'bg-gradient-to-r from-deep-teal to-teal-700 text-white shadow-lg shadow-teal-900/20 scale-105 border-transparent' 
                                        : 'bg-white/60 backdrop-blur-sm text-arabian-night/60 border border-gray-200/80 hover:border-desert-gold/50 hover:text-desert-gold hover:bg-white hover:-translate-y-0.5 hover:shadow-md'
                                }`}
                            >
                                {t('learning_hub.all_content')}
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveTab(cat.id)}
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
                        <div className="flex overflow-x-auto hide-scrollbar gap-3 py-2 pb-4">
                            {sortedLecturers.map(lecturer => (
                                <button
                                    key={lecturer}
                                    onClick={() => setSelectedLecturer(selectedLecturer === lecturer ? '' : lecturer)}
                                    className={`flex items-center gap-2.5 px-5 py-2 rounded-full font-bold transition-all duration-300 whitespace-nowrap group ${
                                        selectedLecturer === lecturer 
                                            ? 'bg-gradient-to-r from-desert-gold to-yellow-600 text-white scale-105 shadow-lg shadow-yellow-600/20 border-transparent' 
                                            : 'bg-white/60 backdrop-blur-sm text-arabian-night/70 border border-gray-200/80 hover:border-desert-gold/50 hover:bg-white hover:-translate-y-0.5 hover:shadow-md'
                                    }`}
                                >
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors duration-300 shadow-inner ${
                                        selectedLecturer === lecturer ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-desert-gold/10 group-hover:text-desert-gold'
                                    }`}>
                                        {lecturer.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm tracking-wide">{lecturer}</span>
                                    {selectedLecturer === lecturer && <span className="ml-1 text-[10px] bg-white/20 px-2 py-0.5 rounded-md backdrop-blur-sm">{lecturerCounts[lecturer]}</span>}
                                </button>
                            ))}
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
                                    taskRecordingIds.length === 0 ? (
                                        <div className="text-center py-10 text-arabian-night/50 font-bold">{t('learning_hub.no_recordings_for_task', '该任务没有关联录音')}</div>
                                    ) : (
                                        taskRecordingIds.map(recId => {
                                            const rec = recordings.find(r => r.id === recId);
                                            return (
                                                <div key={recId} className="flex flex-col lg:flex-row gap-6 items-stretch bg-white/40 p-4 rounded-3xl border border-white shadow-sm">
                                                    <div className="w-full lg:w-[340px] shrink-0">
                                                        {rec ? (
                                                            <RecordingCard 
                                                                rec={rec} 
                                                                user={user} 
                                                                favorites={favorites}
                                                                handleToggleFavorite={handleToggleFavorite}
                                                                handleToggleLike={handleToggleLike}
                                                                handleAudioEnded={handleAudioEnded}
                                                                disableSeek={!isTaskCompleted}
                                                                className="w-full h-full"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full glass-panel rounded-xl flex items-center justify-center p-6 text-center text-arabian-night/50 border border-white/60">
                                                                {t('learning_hub.recording_deleted', '录音可能已被删除')}
                                                            </div>
                                                        )}
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
        </div>
    );
}
