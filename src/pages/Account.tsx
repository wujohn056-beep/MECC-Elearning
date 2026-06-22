import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTranslation } from 'react-i18next';
import { User, Clock, BookOpen, Target, ChevronDown, ChevronUp, Heart, PlayCircle, Trash2, Bell, ShieldAlert, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

const TaskCard = ({ task }: { task: any }) => {
    const { t } = useTranslation();
    
    return (
        <Link to={`/hub?taskId=${task.id}`} className="bg-white/70 p-5 rounded-2xl border border-transparent hover:border-desert-gold/30 hover:shadow-md transition-all flex flex-col group block">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h4 className="font-bold text-arabian-night text-base group-hover:text-deep-teal transition-colors">{task.title}</h4>
                    <p className="text-xs font-semibold text-arabian-night/50 mt-1 flex flex-wrap items-center gap-1">
                        {t('account.from')} {task.assignerName} · 
                        {t('account.start_time', 'Started')}: {task.createdAt?.toDate ? task.createdAt.toDate().toLocaleString() : (task.createdAt ? new Date(task.createdAt).toLocaleString() : '-')} · 
                        {t('account.due')} {task.deadline?.toDate().toLocaleString()}
                    </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ml-2 ${
                    task.myStatus === 'completed' 
                        ? 'bg-green-100 text-green-700 border-green-200 shadow-sm' 
                        : 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm'
                }`}>
                    {task.myStatus === 'completed' ? t('account.completed') : t('account.pending')}
                </span>
            </div>
            {task.myStatus === 'completed' && task.reflection && (
                <div className="mt-2 pt-3 border-t border-gray-100/50">
                    <p className="text-xs text-arabian-night/80 italic line-clamp-2">
                        "{task.reflection}"
                    </p>
                    <p className="text-[10px] text-desert-gold mt-2 font-bold flex items-center gap-1">
                        {t('account.view_reflection')} →
                    </p>
                </div>
            )}
            {task.myStatus !== 'completed' && (
                <div className="mt-2 pt-3 border-t border-gray-100/50">
                    <p className="text-[11px] text-orange-500 font-bold flex items-center gap-1">
                        {t('account.pending')} →
                    </p>
                </div>
            )}
        </Link>
    );
};

export default function Account() {
    const { t } = useTranslation();
    const { user, profile } = useAuth();
    const isNative = Capacitor.isNativePlatform();
    const [openSection, setOpenSection] = useState<'tasks' | 'favorites' | 'milestones' | null>('tasks');
    
    // Push Notifications Diagnostic State
    const [pushPermission, setPushPermission] = useState<string>('unknown');
    const [pushToken, setPushToken] = useState<string>('');
    const [apnsToken, setApnsToken] = useState<string>('');
    const [pushError, setPushError] = useState<string>('');
    const [isRegistering, setIsRegistering] = useState<boolean>(false);

    useEffect(() => {
        if (isNative) {
            setPushPermission(localStorage.getItem('native_push_permission') || 'unknown');
            setPushToken(localStorage.getItem('native_push_token') || '');
            setApnsToken(localStorage.getItem('native_apns_token') || '');
            setPushError(localStorage.getItem('native_push_error') || '');
        }
    }, [isNative]);

    const handleRegisterPush = async () => {
        setIsRegistering(true);
        setPushError('');
        try {
            const { PushNotifications } = await import('@capacitor/push-notifications');
            
            console.log('[Account Diagnostic] Checking push permissions...');
            let permStatus = await PushNotifications.checkPermissions();
            localStorage.setItem('native_push_permission', permStatus.receive);
            setPushPermission(permStatus.receive);
            
            if (permStatus.receive !== 'granted') {
                console.log('[Account Diagnostic] Requesting push permissions...');
                permStatus = await PushNotifications.requestPermissions();
                localStorage.setItem('native_push_permission', permStatus.receive);
                setPushPermission(permStatus.receive);
            }
            
            if (permStatus.receive === 'granted') {
                console.log('[Account Diagnostic] Registering for push notifications...');
                // Setup listeners first to catch the events
                await PushNotifications.removeAllListeners();
                
                PushNotifications.addListener('registration', async (token) => {
                    console.log('[Account Diagnostic] APNs Registration successful, token:', token.value);
                    localStorage.setItem('native_apns_token', token.value);
                    setApnsToken(token.value);
                    
                    try {
                        const { FCM } = await import('@capacitor-community/fcm');
                        const fcmTokenResult = await FCM.getToken();
                        const fcmToken = fcmTokenResult.token;
                        console.log('[Account Diagnostic] FCM token retrieved:', fcmToken);
                        localStorage.setItem('native_push_token', fcmToken);
                        setPushToken(fcmToken);
                        localStorage.removeItem('native_push_error');
                        setPushError('');
                        
                        if (user && profile) {
                            const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
                            const targetUid = profile.realUid || user.uid;
                            const userRef = doc(db, 'users', targetUid);
                            await updateDoc(userRef, {
                                deviceTokens: arrayUnion(fcmToken),
                                lastActiveDevice: 'ios'
                            });
                            console.log('[Account Diagnostic] Associated FCM token in Firestore.');
                        }
                    } catch (e: any) {
                        console.error('[Account Diagnostic] Failed to save FCM token in Firestore:', e);
                        const errStr = `FCM/Firestore failed: ${e.message || e}`;
                        localStorage.setItem('native_push_error', errStr);
                        setPushError(errStr);
                    }
                    setIsRegistering(false);
                });
                
                PushNotifications.addListener('registrationError', (err) => {
                    console.error('[Account Diagnostic] Registration error event:', err);
                    const errStr = err.error || JSON.stringify(err);
                    localStorage.setItem('native_push_error', errStr);
                    setPushError(errStr);
                    setIsRegistering(false);
                });
                
                await PushNotifications.register();
            } else {
                const errStr = 'Permission not granted';
                localStorage.setItem('native_push_error', errStr);
                setPushError(errStr);
                setIsRegistering(false);
            }
        } catch (error: any) {
            console.error('[Account Diagnostic] Error during manual registration:', error);
            const errStr = error.message || JSON.stringify(error);
            localStorage.setItem('native_push_error', errStr);
            setPushError(errStr);
            setIsRegistering(false);
        }
    };
    
    // Learning Journey
    const [learningHistory, setLearningHistory] = useState<any[]>([]);
    const [totalHours, setTotalHours] = useState(0);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [ranking, setRanking] = useState<number>(0);
    const [percentile, setPercentile] = useState<number>(0);

    useEffect(() => {
        if (!user) return;
        const fetchHistoryAndRank = async () => {
            try {
                // Fetch all history to calculate ranks
                const allSnapshot = await getDocs(collection(db, 'learning_history'));
                const historyData: any[] = [];
                const userDurations: Record<string, number> = {};
                
                let myTotalDuration = 0;
                
                allSnapshot.forEach(doc => {
                    const data = doc.data();
                    // Aggregate for rank
                    if (data.userId && data.durationSeconds) {
                        userDurations[data.userId] = (userDurations[data.userId] || 0) + data.durationSeconds;
                    }
                    
                    // Filter for my history
                    if (data.userId === user.uid) {
                        historyData.push({ id: doc.id, ...data });
                        if (data.durationSeconds) {
                            myTotalDuration += data.durationSeconds;
                        }
                    }
                });
                
                // Sort my history
                historyData.sort((a, b) => (b.listenedAt?.toDate().getTime() || 0) - (a.listenedAt?.toDate().getTime() || 0));
                
                setLearningHistory(historyData);
                setTotalHours(Math.round((myTotalDuration / 3600) * 10) / 10);

                // Calculate Rank
                // Add current user to map if not present to ensure they rank even with 0 hours
                if (userDurations[user.uid] === undefined) {
                    userDurations[user.uid] = 0;
                }
                
                const sortedDurations = Object.entries(userDurations)
                    .map(([uid, dur]) => ({ uid, dur }))
                    .sort((a, b) => b.dur - a.dur);
                
                const myRankIndex = sortedDurations.findIndex(x => x.uid === user.uid);
                const myRank = myRankIndex >= 0 ? myRankIndex + 1 : sortedDurations.length;
                const totalActiveUsers = sortedDurations.length;
                
                // Calculate percentile (beat X%)
                // If I am rank 1 out of 10, I beat 9 people (90%)
                const beatCount = totalActiveUsers - myRank;
                const calculatedPercentile = totalActiveUsers > 1 ? Math.round((beatCount / (totalActiveUsers - 1)) * 100) : 100;
                
                setRanking(myRank);
                setPercentile(calculatedPercentile);

            } catch (error) {
                console.error("Error fetching learning history", error);
            } finally {
                setHistoryLoading(false);
            }
        };
        fetchHistoryAndRank();
    }, [user]);

    const [myTasks, setMyTasks] = useState<any[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [activeTaskTab, setActiveTaskTab] = useState<'pending' | 'completed'>('pending');

    useEffect(() => {
        if (!user) return;
        const fetchTasks = async () => {
            try {
                const myUid = profile?.realUid || user.uid;
                const q = query(
                    collection(db, 'learning_tasks'),
                    where('assigneeIds', 'array-contains', myUid)
                );
                const snapshot = await getDocs(q);
                const tasksData: any[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const myInfo = data.assignees[myUid];
                    if (myInfo) {
                        tasksData.push({
                            id: doc.id,
                            title: data.title,
                            assignerName: data.assignerName,
                            deadline: data.deadline,
                            createdAt: data.createdAt,
                            myStatus: myInfo.status,
                            reflection: myInfo.reflection,
                            completedAt: myInfo.completedAt
                        });
                    }
                });
                // Sort by time from newest to oldest
                tasksData.sort((a, b) => {
                    const timeA = a.createdAt?.toDate().getTime() || a.deadline?.toDate().getTime() || 0;
                    const timeB = b.createdAt?.toDate().getTime() || b.deadline?.toDate().getTime() || 0;
                    return timeB - timeA;
                });
                setMyTasks(tasksData);
            } catch (error) {
                console.error("Error fetching tasks", error);
            } finally {
                setTasksLoading(false);
            }
        };
        fetchTasks();
    }, [user, profile]);

    const [favRecordings, setFavRecordings] = useState<any[]>([]);
    const [favLoading, setFavLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const fetchFavorites = async () => {
            try {
                const favDoc = await getDoc(doc(db, 'user_favorites', user.uid));
                if (favDoc.exists()) {
                    const recIds = favDoc.data().recordingIds || [];
                    if (recIds.length > 0) {
                        const promises = recIds.map((id: string) => getDoc(doc(db, 'recordings', id)));
                        const docs = await Promise.all(promises);
                        const loadedFavs = docs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() }));
                        setFavRecordings(loadedFavs);
                    } else {
                        setFavRecordings([]);
                    }
                }
            } catch (error) {
                console.error("Error fetching favorites", error);
            } finally {
                setFavLoading(false);
            }
        };
        fetchFavorites();
    }, [user]);

    const handleUnfavorite = async (e: React.MouseEvent, recordingId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) return;
        try {
            const favRef = doc(db, 'user_favorites', user.uid);
            await updateDoc(favRef, {
                recordingIds: arrayRemove(recordingId)
            });
            setFavRecordings(prev => prev.filter(rec => rec.id !== recordingId));
        } catch (error) {
            console.error("Error removing favorite", error);
        }
    };

    return (
        <div className="animate-in fade-in duration-500 space-y-6 max-w-[1400px] mx-auto pb-12 px-4 sm:px-6">
            {/* iOS profile card on native, standard title on web */}
            {isNative ? (
                <div className="glass-panel rounded-3xl p-5 border border-white bg-white/60 flex flex-col shadow-sm animate-in fade-in duration-300">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-desert-gold to-amber-600 flex items-center justify-center text-white text-2xl font-black shadow-md border-2 border-white select-none shrink-0">
                            {profile?.crmId ? profile.crmId.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U')}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-black text-slate-800 truncate">{profile?.crmId || user?.email || 'User'}</h2>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-[10px] font-extrabold text-desert-gold uppercase bg-desert-gold/10 px-2 py-0.5 rounded-full border border-desert-gold/20">
                                    {profile?.role || 'User'}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500">
                                    {profile?.team ? profile.team.replace('小组', ` ${t('common.team')}`) : '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    {(profile?.sd || profile?.sm || profile?.tl) && (
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-slate-100/80 text-center">
                            <div>
                                <span className="block text-[9px] font-bold text-slate-400 uppercase">SD</span>
                                <span className="text-xs font-bold text-slate-700">{profile?.sd || '-'}</span>
                            </div>
                            <div>
                                <span className="block text-[9px] font-bold text-slate-400 uppercase">SM</span>
                                <span className="text-xs font-bold text-slate-700">{profile?.sm || '-'}</span>
                            </div>
                            <div>
                                <span className="block text-[9px] font-bold text-slate-400 uppercase">TL</span>
                                <span className="text-xs font-bold text-slate-700">{profile?.tl || '-'}</span>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <h1 className="text-3xl font-extrabold text-deep-teal">{t('account.title')}</h1>
                    <p className="text-arabian-night/60 mt-1">{t('account.desc')}</p>
                </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3 md:gap-6">
                {/* Stat 1: Total Recordings */}
                <div className="glass-panel rounded-2xl md:rounded-3xl p-3 md:p-6 border border-white flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all shadow-sm">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500 hidden sm:block">
                        <BookOpen className="w-32 h-32 text-blue-900" />
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-3 mb-2 md:mb-4">
                        <div className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                            <BookOpen className="w-3.5 h-3.5 md:w-5 md:h-5" />
                        </div>
                        <p className="text-[10px] md:text-sm font-bold text-arabian-night/50 line-clamp-1">{t('account.listened_recordings')}</p>
                    </div>
                    <p className="text-xl md:text-4xl font-extrabold text-deep-teal tracking-tight truncate">
                        {learningHistory.length} <span className="text-[10px] md:text-base font-semibold text-arabian-night/40 ml-0.5 md:ml-1">{t('account.lessons')}</span>
                    </p>
                </div>

                {/* Stat 2: Total Hours */}
                <div className="glass-panel rounded-2xl md:rounded-3xl p-3 md:p-6 border border-white flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all shadow-sm">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500 hidden sm:block">
                        <Clock className="w-32 h-32 text-green-900" />
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-3 mb-2 md:mb-4">
                        <div className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-sm shrink-0">
                            <Clock className="w-3.5 h-3.5 md:w-5 md:h-5" />
                        </div>
                        <p className="text-[10px] md:text-sm font-bold text-arabian-night/50 line-clamp-1">{t('account.total_time')}</p>
                    </div>
                    <p className="text-xl md:text-4xl font-extrabold text-deep-teal tracking-tight truncate">
                        {totalHours} <span className="text-[10px] md:text-base font-semibold text-arabian-night/40 ml-0.5 md:ml-1">{t('admin_dashboard_page.hours')}</span>
                    </p>
                </div>

                {/* Stat 3: Rank */}
                <div className="glass-panel rounded-2xl md:rounded-3xl p-3 md:p-6 border border-white flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all shadow-sm">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500 hidden sm:block">
                        <Target className="w-32 h-32 text-orange-900" />
                    </div>
                    <div className="flex items-center justify-between mb-2 md:mb-4">
                        <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
                            <div className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm shrink-0">
                                <Target className="w-3.5 h-3.5 md:w-5 md:h-5" />
                            </div>
                            <p className="text-[10px] md:text-sm font-bold text-arabian-night/50 truncate">{t('account.duration_ranking')}</p>
                        </div>
                    </div>
                    <p className="text-xl md:text-4xl font-extrabold text-deep-teal tracking-tight truncate">
                        {t('account.rank', { rank: ranking })}
                    </p>
                    <p className="text-[9px] md:text-xs font-semibold text-arabian-night/50 mt-1 truncate">
                        {t('account.surpassed', { percent: percentile })}
                    </p>
                </div>
            </div>

            {/* Bottom Content Area */}
            {isNative ? (
                <div className="space-y-4">
                    {/* Tasks Group */}
                    <div className="glass-panel rounded-2xl border border-white bg-white/60 overflow-hidden shadow-sm">
                        <button 
                            onClick={() => setOpenSection(openSection === 'tasks' ? null : 'tasks')}
                            className="w-full flex items-center justify-between p-4 bg-white/40 hover:bg-white/60 active:bg-white/80 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-deep-teal/10 flex items-center justify-center text-deep-teal">
                                    <Target className="w-4 h-4" />
                                </div>
                                <span className="font-extrabold text-slate-800 text-sm">{t('account.my_tasks')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-deep-teal/10 text-deep-teal px-2 py-0.5 rounded-full font-bold">
                                    {myTasks.filter(t => t.myStatus === 'pending').length} {t('account.pending')}
                                </span>
                                {openSection === 'tasks' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                        </button>
                        
                        {openSection === 'tasks' && (
                            <div className="p-4 border-t border-slate-100 bg-white/30 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-200">
                                <div className="flex gap-2 bg-gray-50/50 p-1 rounded-xl">
                                    <button 
                                        onClick={() => setActiveTaskTab('pending')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTaskTab === 'pending' ? 'bg-white shadow text-deep-teal font-black' : 'text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        {t('account.pending')} ({myTasks.filter(t => t.myStatus === 'pending').length})
                                    </button>
                                    <button 
                                        onClick={() => setActiveTaskTab('completed')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTaskTab === 'completed' ? 'bg-white shadow text-green-600 font-black' : 'text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        {t('account.completed')} ({myTasks.filter(t => t.myStatus === 'completed').length})
                                    </button>
                                </div>
                                {tasksLoading ? (
                                    <div className="flex justify-center py-6">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-desert-gold"></div>
                                    </div>
                                ) : myTasks.filter(t => t.myStatus === activeTaskTab).length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 text-sm">
                                        <Target className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p className="font-semibold">{t('account.empty_tasks_title')}</p>
                                        <p className="text-xs text-slate-400 mt-1">{t('account.empty_tasks_desc')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {myTasks
                                            .filter(t => t.myStatus === activeTaskTab)
                                            .map((task) => (
                                                <TaskCard key={task.id} task={task} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Favorites Group */}
                    <div className="glass-panel rounded-2xl border border-white bg-white/60 overflow-hidden shadow-sm">
                        <button 
                            onClick={() => setOpenSection(openSection === 'favorites' ? null : 'favorites')}
                            className="w-full flex items-center justify-between p-4 bg-white/40 hover:bg-white/60 active:bg-white/80 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                                    <Heart className="w-4 h-4 fill-rose-500" />
                                </div>
                                <span className="font-extrabold text-slate-800 text-sm">{t('account.my_favorites')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full font-bold">
                                    {favRecordings.length}
                                </span>
                                {openSection === 'favorites' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                        </button>
                        
                        {openSection === 'favorites' && (
                            <div className="p-4 border-t border-slate-100 bg-white/30 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-200">
                                {favLoading ? (
                                    <div className="flex justify-center py-6">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-400"></div>
                                    </div>
                                ) : favRecordings.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 text-sm">
                                        <Heart className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p className="font-semibold">{t('account.empty_fav_title')}</p>
                                        <p className="text-xs text-slate-400 mt-1">{t('account.empty_fav_desc')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {favRecordings.map(rec => (
                                            <Link to={`/hub?recordingId=${rec.id}`} key={rec.id} className="bg-white/70 p-3.5 rounded-xl border border-transparent hover:border-red-200 transition-all flex justify-between items-center group block">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-red-500 transition-colors truncate">{rec.title}</h4>
                                                    <p className="text-xs font-semibold text-slate-500 mt-0.5 truncate">{rec.description}</p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button 
                                                        onClick={(e) => handleUnfavorite(e, rec.id)}
                                                        className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-500 flex items-center justify-center transition-colors text-rose-500 hover:text-white"
                                                        title="Remove favorite"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <div className="w-7 h-7 rounded-full bg-rose-50 group-hover:bg-rose-500 flex items-center justify-center transition-colors">
                                                        <PlayCircle className="w-3.5 h-3.5 text-rose-500 group-hover:text-white" />
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Milestones Group */}
                    <div className="glass-panel rounded-2xl border border-white bg-white/60 overflow-hidden shadow-sm">
                        <button 
                            onClick={() => setOpenSection(openSection === 'milestones' ? null : 'milestones')}
                            className="w-full flex items-center justify-between p-4 bg-white/40 hover:bg-white/60 active:bg-white/80 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-desert-gold/10 flex items-center justify-center text-desert-gold">
                                    <BookOpen className="w-4 h-4" />
                                </div>
                                <span className="font-extrabold text-slate-800 text-sm">{t('account.learning_milestones')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-desert-gold/10 text-desert-gold px-2 py-0.5 rounded-full font-bold">
                                    {learningHistory.length}
                                </span>
                                {openSection === 'milestones' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                        </button>
                        
                        {openSection === 'milestones' && (
                            <div className="p-4 border-t border-slate-100 bg-white/30 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-200">
                                {historyLoading ? (
                                    <div className="flex justify-center py-6">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-desert-gold"></div>
                                    </div>
                                ) : learningHistory.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 text-sm">
                                        <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p className="font-semibold">{t('account.empty_hist_title')}</p>
                                        <p className="text-xs text-slate-400 mt-1">{t('account.empty_hist_desc')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {learningHistory.map((item) => (
                                            <div key={item.id} className="bg-white/70 p-3.5 rounded-xl border border-transparent flex justify-between items-center group">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-deep-teal transition-colors truncate">{item.recordingTitle}</h4>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                                                        {item.lecturerName && (
                                                            <p className="text-[10px] font-bold text-desert-gold flex items-center gap-1">
                                                                <User className="w-3.5 h-3.5" />
                                                                {item.lecturerName}
                                                            </p>
                                                        )}
                                                        <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {item.listenedAt?.toDate().toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 text-[10px] font-extrabold text-desert-gold bg-desert-gold/10 px-2 py-1 rounded-lg border border-desert-gold/25">
                                                    {Math.round(item.durationSeconds / 60)} {t('common.mins')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Push Diagnostics Group */}
                    <div className="glass-panel rounded-2xl border border-white bg-white/60 overflow-hidden shadow-sm">
                        <div className="p-4 bg-white/40 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                                    <Bell className="w-4 h-4" />
                                </div>
                                <span className="font-extrabold text-slate-800 text-sm">
                                    {t('account.push_diagnostics', '推送通知诊断')}
                                </span>
                            </div>
                            <button 
                                onClick={handleRegisterPush}
                                disabled={isRegistering}
                                className="flex items-center gap-1 text-[11px] font-bold text-deep-teal bg-white/80 border border-deep-teal/20 px-2.5 py-1 rounded-lg hover:bg-white active:bg-deep-teal/10 transition-all disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isRegistering ? 'animate-spin' : ''}`} />
                                {isRegistering ? t('account.registering', '注册中...') : t('account.register_push', '请求权限并注册')}
                            </button>
                        </div>
                        <div className="p-4 bg-white/20 space-y-3.5 text-xs text-slate-600">
                            {/* Permission Status */}
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-500">{t('account.permission_status', '系统权限状态')}</span>
                                <span className={`font-black px-2.5 py-0.5 rounded-full border ${
                                    pushPermission === 'granted' 
                                        ? 'bg-green-50 text-green-600 border-green-200' 
                                        : pushPermission === 'denied' 
                                            ? 'bg-red-50 text-red-600 border-red-200'
                                            : 'bg-amber-50 text-amber-600 border-amber-200'
                                }`}>
                                    {pushPermission === 'granted' ? t('account.granted', '已允许 (Granted)') : 
                                     pushPermission === 'denied' ? t('account.denied', '被拒绝 (Denied)') : 
                                     pushPermission === 'prompt' ? t('account.prompt', '询问 (Prompt)') : pushPermission}
                                </span>
                            </div>

                            {/* APNs Token */}
                            <div className="space-y-1">
                                <span className="font-bold text-slate-500 block">{t('account.apns_token', '苹果 APNs Token')}</span>
                                <div className="bg-slate-100/50 p-2 rounded-xl border border-slate-200/50 font-mono text-[10px] break-all select-all min-h-[32px] flex items-center">
                                    {apnsToken || <span className="text-slate-400 font-sans italic">{t('account.not_registered', '未获取，请点击右上方重新注册')}</span>}
                                </div>
                            </div>

                            {/* FCM Token */}
                            <div className="space-y-1">
                                <span className="font-bold text-slate-500 block">{t('account.fcm_token', '谷歌 FCM Token')}</span>
                                <div className="bg-slate-100/50 p-2 rounded-xl border border-slate-200/50 font-mono text-[10px] break-all select-all min-h-[32px] flex items-center">
                                    {pushToken || <span className="text-slate-400 font-sans italic">{t('account.not_registered', '未获取，请点击右上方重新注册')}</span>}
                                </div>
                            </div>

                            {/* Registration Error */}
                            {pushError && (
                                <div className="p-3 bg-red-50/70 border border-red-200/50 rounded-2xl flex items-start gap-2.5">
                                    <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <p className="font-bold text-red-700">{t('account.registration_error', '注册错误信息')}</p>
                                        <p className="text-[10px] font-mono text-red-600/90 break-all">{pushError}</p>
                                    </div>
                                </div>
                            )}

                            {/* Help tips */}
                            <div className="text-[10.5px] leading-relaxed text-slate-500/80 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                                <p className="font-bold text-slate-600 mb-1">💡 APNs / FCM 调试指南：</p>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>如果提示 APNs 错误，可能由于 Apple 开发者账号没有推送权限或 Xcode Capability 未开启。</li>
                                    <li>若 APNs 正常（有 APNs Token）但无 FCM Token，可能为 Firebase 初始化、配置或网络连通性问题。</li>
                                    <li>如果首次打开未弹出权限询问，可在手机设置中找到本应用，手动开启通知权限，并返回本页面重新注册。</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Favorites Panel */}
                    <div className="glass-panel rounded-3xl p-6 border border-white h-[600px] flex flex-col shadow-sm">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                            </div>
                            <h3 className="text-xl font-extrabold text-deep-teal">{t('account.my_favorites')}</h3>
                        </div>
                        
                        {favLoading ? (
                            <div className="flex-1 flex justify-center items-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-400"></div>
                            </div>
                        ) : favRecordings.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-arabian-night/40">
                                <Heart className="w-16 h-16 mb-4 opacity-20" />
                                <p className="text-lg font-semibold">{t('account.empty_fav_title')}</p>
                                <p className="text-sm">{t('account.empty_fav_desc')}</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                                {favRecordings.map(rec => (
                                    <Link to={`/hub?recordingId=${rec.id}`} key={rec.id} className="bg-white/70 p-4 rounded-2xl border border-transparent hover:border-red-200 hover:shadow-md transition-all flex justify-between items-center group block">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <h4 className="font-bold text-arabian-night text-base group-hover:text-red-500 transition-colors truncate">{rec.title}</h4>
                                            <p className="text-xs font-semibold text-arabian-night/50 mt-1 truncate">{rec.description}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={(e) => handleUnfavorite(e, rec.id)}
                                                className="shrink-0 w-8 h-8 rounded-full bg-red-50 hover:bg-red-500 flex items-center justify-center transition-colors text-red-500 hover:text-white"
                                                title="Remove favorite"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <div className="shrink-0 w-8 h-8 rounded-full bg-red-50 group-hover:bg-red-500 flex items-center justify-center transition-colors">
                                                <PlayCircle className="w-4 h-4 text-red-500 group-hover:text-white" />
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Milestones Panel */}
                    <div className="glass-panel rounded-3xl p-6 border border-white h-[600px] flex flex-col shadow-sm">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-desert-gold/10 flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-desert-gold" />
                            </div>
                            <h3 className="text-xl font-extrabold text-deep-teal">{t('account.learning_milestones')}</h3>
                        </div>
                        
                        {historyLoading ? (
                            <div className="flex-1 flex justify-center items-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-desert-gold"></div>
                            </div>
                        ) : learningHistory.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-arabian-night/40">
                                <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                                <p className="text-lg font-semibold">{t('account.empty_hist_title')}</p>
                                <p className="text-sm">{t('account.empty_hist_desc')}</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                {learningHistory.map((item) => (
                                    <div key={item.id} className="bg-white/70 p-4 rounded-2xl border border-transparent hover:border-desert-gold/30 hover:shadow-md transition-all flex justify-between items-center group">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <h4 className="font-bold text-arabian-night text-base group-hover:text-deep-teal transition-colors truncate">{item.recordingTitle}</h4>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                                                {item.lecturerName && (
                                                    <p className="text-xs font-bold text-desert-gold flex items-center gap-1.5">
                                                        <User className="w-3.5 h-3.5" />
                                                        {item.lecturerName}
                                                    </p>
                                                )}
                                                <p className="text-xs font-semibold text-arabian-night/50 flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {item.listenedAt?.toDate().toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-xs font-extrabold text-desert-gold bg-desert-gold/10 px-3 py-1.5 rounded-xl border border-desert-gold/20 shadow-sm">
                                            {Math.round(item.durationSeconds / 60)} {t('common.mins')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* My Tasks Panel */}
                    <div className="glass-panel rounded-3xl p-6 border border-white h-[600px] flex flex-col shadow-sm">
                        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-deep-teal/10 flex items-center justify-center">
                                <Target className="w-5 h-5 text-deep-teal" />
                            </div>
                            <h3 className="text-xl font-extrabold text-deep-teal">{t('account.my_tasks')}</h3>
                        </div>

                        <div className="flex gap-2 mb-4 bg-gray-50/50 p-1 rounded-xl">
                            <button 
                                onClick={() => setActiveTaskTab('pending')}
                                className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTaskTab === 'pending' ? 'bg-white shadow text-deep-teal' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                {t('account.pending')} ({myTasks.filter(t => t.myStatus === 'pending').length})
                            </button>
                            <button 
                                onClick={() => setActiveTaskTab('completed')}
                                className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTaskTab === 'completed' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                {t('account.completed')} ({myTasks.filter(t => t.myStatus === 'completed').length})
                            </button>
                        </div>

                        {tasksLoading ? (
                            <div className="flex-1 flex justify-center items-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-desert-gold"></div>
                            </div>
                        ) : myTasks.filter(t => t.myStatus === activeTaskTab).length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-arabian-night/40">
                                <Target className="w-16 h-16 mb-4 opacity-20" />
                                <p className="text-lg font-semibold">{t('account.empty_tasks_title')}</p>
                                <p className="text-sm">{t('account.empty_tasks_desc')}</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                                {myTasks
                                    .filter(t => t.myStatus === activeTaskTab)
                                    .map((task) => (
                                        <TaskCard key={task.id} task={task} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
