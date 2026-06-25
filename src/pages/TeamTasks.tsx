import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, addDoc, serverTimestamp, query, where, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTranslation } from 'react-i18next';
import { Users, FileAudio, Calendar, CheckCircle, Clock, AlertCircle, Search, LayoutDashboard, ClipboardList, Edit2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import CampaignManager from './admin/CampaignManager';


interface UserRecord {
    id: string;
    crmId: string;
    role: string;
    team: string;
    sd: string;
    sm: string;
}

interface RecordingInfo {
    id: string;
    title: string;
    displayId?: string;
    createdAt?: any;
}

interface TaskAssignee {
    crmId: string;
    status: 'pending' | 'completed';
    read: boolean;
    reflection?: string;
    reflections?: Record<string, string>;
}

interface LearningTask {
    id: string;
    title: string;
    assignerId: string;
    assignerName: string;
    assigneeIds: string[];
    assignees: Record<string, TaskAssignee>;
    recordingIds: string[];
    deadline: any;
    createdAt: any;
}

export default function TeamTasks() {
    const { t } = useTranslation();
    const { user, profile, isSuperAdmin } = useAuth();
    const isNative = Capacitor.isNativePlatform();
    const [cardTabs, setCardTabs] = useState<Record<string, 'progress' | 'reflections'>>({});

    const getCardTab = (taskId: string) => cardTabs[taskId] || 'progress';
    const setCardTab = (taskId: string, tab: 'progress' | 'reflections') => {
        setCardTabs(prev => ({ ...prev, [taskId]: tab }));
    };
    
    const [tasks, setTasks] = useState<LearningTask[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
    const [allRecordings, setAllRecordings] = useState<RecordingInfo[]>([]);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [editingTask, setEditingTask] = useState<LearningTask | null>(null);
    const [editDeadlineDate, setEditDeadlineDate] = useState('');
    const [editDeadlineTime, setEditDeadlineTime] = useState('');
    const [updatingDeadline, setUpdatingDeadline] = useState(false);
    
    // Tabs state
    const [activeTab, setActiveTab] = useState<'in_progress' | 'expired' | 'campaigns'>('in_progress');
    const [activeSubTab, setActiveSubTab] = useState<'uncompleted' | 'completed'>('uncompleted');
    
    // Form state
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [selectedRecordingIds, setSelectedRecordingIds] = useState<string[]>([]);
    const [deadlineDate, setDeadlineDate] = useState('');
    const [deadlineTime, setDeadlineTime] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [recordingSearchQuery, setRecordingSearchQuery] = useState('');

    const isDeadlineInvalid = React.useMemo(() => {
        if (!deadlineDate || !deadlineTime) return false;
        try {
            const deadlineObj = new Date(`${deadlineDate}T${deadlineTime}`);
            return deadlineObj <= new Date();
        } catch (e) {
            return false;
        }
    }, [deadlineDate, deadlineTime]);

    const isEditDeadlineInvalid = React.useMemo(() => {
        if (!editDeadlineDate || !editDeadlineTime) return false;
        try {
            const deadlineObj = new Date(`${editDeadlineDate}T${editDeadlineTime}`);
            return deadlineObj <= new Date();
        } catch (e) {
            return false;
        }
    }, [editDeadlineDate, editDeadlineTime]);

    useEffect(() => {
        fetchTasks();
        fetchFormData();
    }, [user, profile]);

    const fetchTasks = async () => {
        if (!user) return;
        setLoadingTasks(true);
        try {
            const uidsToQuery = [user.uid];
            // If the user profile contains a real database UID (like Serdah's real UID), add it to the query
            const profileRealUid = (profile as any)?.realUid;
            if (profileRealUid && profileRealUid !== user.uid) {
                uidsToQuery.push(profileRealUid);
            }

            const tasksMap = new Map<string, LearningTask>();
            
            // Execute queries in parallel
            await Promise.all(uidsToQuery.map(async (uid) => {
                const q = query(
                    collection(db, 'learning_tasks'),
                    where('assignerId', '==', uid),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    tasksMap.set(doc.id, { id: doc.id, ...doc.data() } as LearningTask);
                });
            }));

            // Convert map to array and sort by createdAt descending
            const mergedTasks = Array.from(tasksMap.values()).sort((a, b) => {
                const getMillis = (task: LearningTask) => {
                    if (!task.createdAt) return Date.now(); // Fallback for newly created unsynced tasks
                    if (typeof task.createdAt.toMillis === 'function') return task.createdAt.toMillis();
                    if (task.createdAt.seconds) return task.createdAt.seconds * 1000;
                    return 0;
                };
                return getMillis(b) - getMillis(a);
            });

            setTasks(mergedTasks);
        } catch (error) {
            console.error("Error fetching tasks", error);
        } finally {
            setLoadingTasks(false);
        }
    };

    const fetchFormData = async () => {
        try {
            // Fetch users (if not super admin, ideally filter by team, but we'll fetch all and filter client side)
            const usersSnap = await getDocs(collection(db, 'users'));
            const usersData: UserRecord[] = [];
            usersSnap.forEach(doc => {
                usersData.push({ id: doc.id, ...doc.data() } as UserRecord);
            });
            
            // Filter users based on leader's scope
            const filteredUsers = usersData.filter(u => {
                const loggedInRole = String(profile?.role).trim().toLowerCase();
                const loggedInCrmId = (profile?.crmId || '').trim().toLowerCase();
                const loggedInTeam = (profile?.team || '').trim().toLowerCase();

                const uTeam = (u.team || '').trim();
                const uTeamLower = uTeam.toLowerCase();
                const uCrmId = (u.crmId || '').trim().toLowerCase();

                const uSd = (u.sd || '').trim().toLowerCase();
                const uSm = (u.sm || '').trim().toLowerCase();
                const uTl = (u.tl || '').trim().toLowerCase();

                // 1. Super Admin: Show all users (excluding themselves)
                if (loggedInRole === 'super_admin' || isSuperAdmin) {
                    return uCrmId !== loggedInCrmId;
                }

                // 2. SD (Sales Director): Show users under their hierarchy, including SMs (excluding themselves)
                if (loggedInRole === 'sd') {
                    return uSd === loggedInCrmId && uCrmId !== loggedInCrmId;
                }

                // 3. For other roles (SM, TL, etc.), require an active team
                if (!uTeam) return false;

                if (loggedInRole === 'sm') {
                    return uSm === loggedInCrmId && uCrmId !== loggedInCrmId;
                } else if (loggedInRole === 'tl') {
                    return (uTeamLower === loggedInTeam || uTl === loggedInCrmId) && uCrmId !== loggedInCrmId;
                }
                return false;
            });
            setAllUsers(filteredUsers);

            // Fetch recordings
            const recsSnap = await getDocs(collection(db, 'recordings'));
            const recsData: RecordingInfo[] = [];
            recsSnap.forEach(doc => {
                const data = doc.data();
                recsData.push({ 
                    id: doc.id, 
                    title: data.title, 
                    displayId: data.displayId,
                    createdAt: data.createdAt 
                });
            });
            
            // Sort recordings by upload time descending (newest first)
            recsData.sort((a, b) => {
                const getMillis = (rec: RecordingInfo) => {
                    if (!rec.createdAt) return 0;
                    if (typeof rec.createdAt.toMillis === 'function') return rec.createdAt.toMillis();
                    if (rec.createdAt.seconds) return rec.createdAt.seconds * 1000;
                    if (typeof rec.createdAt.toDate === 'function') return rec.createdAt.toDate().getTime();
                    const d = new Date(rec.createdAt);
                    return isNaN(d.getTime()) ? 0 : d.getTime();
                };
                return getMillis(b) - getMillis(a);
            });
            
            setAllRecordings(recsData);
            
        } catch (error) {
            console.error("Error fetching form data", error);
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || selectedUserIds.length === 0 || selectedRecordingIds.length === 0 || !deadlineDate || !deadlineTime) return;

        setSubmitting(true);
        try {
            const deadlineObj = new Date(`${deadlineDate}T${deadlineTime}`);
            
            if (deadlineObj <= new Date()) {
                alert(t('team_tasks.deadline_must_be_future', '截止时间必须晚于当前时间！'));
                setSubmitting(false);
                return;
            }
            
            const assigneesMap: Record<string, TaskAssignee> = {};
            selectedUserIds.forEach(uid => {
                const u = allUsers.find(x => x.id === uid);
                if (u) {
                    assigneesMap[uid] = {
                        crmId: u.crmId,
                        status: 'pending',
                        read: false
                    };
                }
            });

            const docRef = await addDoc(collection(db, 'learning_tasks'), {
                title: newTaskTitle || '学习任务',
                assignerId: user.uid,
                assignerName: profile?.crmId || 'Leader',
                assigneeIds: selectedUserIds,
                assignees: assigneesMap,
                recordingIds: selectedRecordingIds,
                deadline: Timestamp.fromDate(deadlineObj),
                createdAt: serverTimestamp()
            });

            // Trigger DingTalk Task Assignment Notifications via Serverless endpoint
            try {
                const res = await fetch('/.netlify/functions/dingtalk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'notifyTask',
                        title: newTaskTitle || '学习任务',
                        assignerName: profile?.crmId || 'Leader',
                        assigneeIds: selectedUserIds,
                        recordingIds: selectedRecordingIds,
                        deadline: deadlineObj.toLocaleString(),
                        startTime: new Date().toLocaleString(),
                        taskId: docRef.id
                    })
                });

                if (!res.ok) {
                    throw new Error(t('team_tasks.notification_fail', '发送任务通知失败，请检查网络或后台配置。'));
                }

                const data = await res.json();
                console.log("[TeamTasks] Notification trigger result:", data);
                if (data.fcmPush && data.fcmPush.failureCount > 0) {
                    alert(t('team_tasks.fcm_push_error', `任务已创建，但推送通知发送失败：\n${data.fcmPush.error}`));
                } else if (data.fcmPush && data.fcmPush.tokensCount === 0) {
                    alert(t('team_tasks.fcm_no_tokens', '任务已创建，但未找到任何注册了推送通知的 App 设备。'));
                }
            } catch (notifyErr: any) {
                console.error("Failed to initiate DingTalk task notification request:", notifyErr);
                alert(t('team_tasks.notification_error', `发送任务通知时发生网络或服务错误：${notifyErr.message}`));
            }

            setShowCreateModal(false);
            setNewTaskTitle('');
            setSelectedUserIds([]);
            setSelectedRecordingIds([]);
            setDeadlineDate('');
            setDeadlineTime('');
            setRecordingSearchQuery('');
            
            fetchTasks();
        } catch (error) {
            console.error("Error creating task", error);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleUserSelection = (uid: string) => {
        setSelectedUserIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
    };

    const toggleRecordingSelection = (recId: string) => {
        setSelectedRecordingIds(prev => {
            if (prev.includes(recId)) {
                return prev.filter(id => id !== recId);
            } else {
                if (prev.length >= 2) {
                    alert(t('team_tasks.max_recordings_limit', '一次最多只能同时指派2个录音！'));
                    return prev;
                }
                return [...prev, recId];
            }
        });
    };

    const selectAllUsers = () => {
        setSelectedUserIds(allUsers.map(u => u.id));
    };

    const groupedUsers = React.useMemo(() => {
        const groups: Record<string, UserRecord[]> = {};
        allUsers.forEach(u => {
            let teamName = '';
            
            const hasSd = !!u.sd;
            const isSd = u.role === 'sd';
            const isSales = hasSd || isSd;
            
            if (isSales) {
                // If logged-in user is SM or TL, write the SM's name instead of the SD's name (e.g. "JOHN Team")
                const loggedInRole = String(profile?.role).trim().toLowerCase();
                if (loggedInRole === 'sm' || loggedInRole === 'tl') {
                    const smName = (profile?.role === 'sm' ? profile?.crmId : (profile?.sm || u.sm || '')).trim().toUpperCase();
                    if (smName) {
                        teamName = `${smName} Team`;
                    } else {
                        teamName = t('team_tasks.unassigned_team', '未分组');
                    }
                } else {
                    // Sales user: group by SD team
                    const sdName = (u.sd || (isSd ? u.crmId : '')).trim().toUpperCase();
                    if (sdName) {
                        teamName = `${sdName} ${t('team_tasks.team_suffix', 'Team')}`;
                    } else {
                        teamName = t('team_tasks.unassigned_team', '未分组');
                    }
                }
            } else {
                // Non-sales user: group by functional team / department
                const functionalTeam = (u.team || u.dep || '').trim();
                if (functionalTeam) {
                    teamName = functionalTeam;
                } else {
                    teamName = t('team_tasks.unassigned_team', '未分组');
                }
            }
            
            if (!groups[teamName]) groups[teamName] = [];
            groups[teamName].push(u);
        });
        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    }, [allUsers, t, profile]);

    const toggleTeamSelection = (teamUsers: UserRecord[]) => {
        const teamUserIds = teamUsers.map(u => u.id);
        const allSelected = teamUserIds.every(id => selectedUserIds.includes(id));
        if (allSelected) {
            setSelectedUserIds(prev => prev.filter(id => !teamUserIds.includes(id)));
        } else {
            setSelectedUserIds(prev => Array.from(new Set([...prev, ...teamUserIds])));
        }
    };

    const toggleSubGroupSelection = (subGroupUsers: UserRecord[]) => {
        const subGroupUserIds = subGroupUsers.map(u => u.id);
        const allSelected = subGroupUserIds.every(id => selectedUserIds.includes(id));
        if (allSelected) {
            setSelectedUserIds(prev => prev.filter(id => !subGroupUserIds.includes(id)));
        } else {
            setSelectedUserIds(prev => Array.from(new Set([...prev, ...subGroupUserIds])));
        }
    };

    const openEditDeadlineModal = (task: LearningTask) => {
        setEditingTask(task);
        if (task.deadline) {
            const date = task.deadline.toDate();
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const hh = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            setEditDeadlineDate(`${yyyy}-${mm}-${dd}`);
            setEditDeadlineTime(`${hh}:${min}`);
        } else {
            setEditDeadlineDate('');
            setEditDeadlineTime('');
        }
    };

    const handleUpdateDeadline = async () => {
        if (!editingTask || !editDeadlineDate || !editDeadlineTime) return;
        setUpdatingDeadline(true);
        try {
            const deadlineObj = new Date(`${editDeadlineDate}T${editDeadlineTime}`);
            if (deadlineObj <= new Date()) {
                alert(t('team_tasks.deadline_must_be_future', '截止时间必须晚于当前时间！'));
                setUpdatingDeadline(false);
                return;
            }
            await updateDoc(doc(db, 'learning_tasks', editingTask.id), {
                deadline: Timestamp.fromDate(deadlineObj)
            });
            setEditingTask(null);
            fetchTasks();
            alert(t('team_tasks.deadline_update_success', '截止时间修改成功！'));
        } catch (error) {
            console.error("Error updating deadline", error);
            alert(t('common.save_fail', '保存失败'));
        } finally {
            setUpdatingDeadline(false);
        }
    };

    const filteredRecordings = allRecordings.filter(r => 
        r.title.toLowerCase().includes(recordingSearchQuery.toLowerCase()) || 
        (r.displayId && r.displayId.toLowerCase().includes(recordingSearchQuery.toLowerCase()))
    );

    return (
        <div className="animate-in fade-in duration-500 max-w-6xl mx-auto space-y-6">
            {isNative ? (
                <div className="glass-panel rounded-3xl p-5 border border-white bg-white/60 flex items-center justify-between shadow-sm animate-in fade-in duration-300">
                    <div>
                        <h1 className="text-xl font-black text-slate-800">{t('team_tasks.title', '团队任务')}</h1>
                        <p className="text-xs text-slate-500 mt-0.5">{t('team_tasks.desc', '指派学习任务并追踪团队成员进度')}</p>
                    </div>
                    {activeTab !== 'campaigns' && (
                        <button 
                            onClick={() => setShowCreateModal(true)}
                            className="bg-desert-gold text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all shrink-0"
                        >
                            + {t('team_tasks.new_task', '新建')}
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex flex-col mb-6 gap-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-deep-teal">{t('team_tasks.title', '团队任务')}</h1>
                            <p className="text-arabian-night/60 mt-1">{t('team_tasks.desc', '指派学习任务并追踪团队成员进度')}</p>
                        </div>
                        
                        {activeTab !== 'campaigns' && (
                            <button 
                                onClick={() => setShowCreateModal(true)}
                                className="bg-desert-gold text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:bg-yellow-600 transition-colors"
                            >
                                + {t('team_tasks.new_task', '新建任务')}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex flex-col gap-3 mb-6">
                <div className={`p-1 rounded-full flex items-center w-full md:w-auto overflow-x-auto whitespace-nowrap scrollbar-none ${
                    isNative 
                        ? 'bg-slate-200/60 border border-slate-300/10'
                        : 'bg-gray-50/50 w-fit'
                }`}>
                    <button 
                        onClick={() => setActiveTab('in_progress')}
                        className={`flex-1 md:flex-none px-6 py-2 text-sm font-bold rounded-full transition-all ${
                            activeTab === 'in_progress' 
                                ? isNative
                                    ? 'bg-white text-slate-800 shadow-sm font-black'
                                    : 'bg-white shadow text-deep-teal' 
                                : 'text-gray-500 hover:bg-gray-100/50'
                        }`}
                    >
                        {t('team_tasks.tab_in_progress', 'In Progress')} ({loadingTasks ? 0 : tasks.filter(t => t.deadline?.toDate() >= new Date()).length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('expired')}
                        className={`flex-1 md:flex-none px-6 py-2 text-sm font-bold rounded-full transition-all ${
                            activeTab === 'expired' 
                                ? isNative
                                    ? 'bg-white text-slate-800 shadow-sm font-black'
                                    : 'bg-white shadow text-red-500' 
                                : 'text-gray-500 hover:bg-gray-100/50'
                        }`}
                    >
                        {t('team_tasks.tab_expired', 'Expired')} ({loadingTasks ? 0 : tasks.filter(t => t.deadline?.toDate() < new Date()).length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('campaigns')}
                        className={`flex-1 md:flex-none px-6 py-2 text-sm font-bold rounded-full transition-all ${
                            activeTab === 'campaigns' 
                                ? isNative
                                    ? 'bg-white text-slate-800 shadow-sm font-black'
                                    : 'bg-white shadow text-desert-gold' 
                                : 'text-gray-500 hover:bg-gray-100/50'
                        }`}
                    >
                        {t('team_tasks.tab_campaigns', 'Exclusive Challenges')}
                    </button>
                </div>

                {!loadingTasks && tasks.length > 0 && activeTab === 'expired' && (
                    <div className="flex gap-2 ml-1">
                        <button 
                            onClick={() => setActiveSubTab('uncompleted')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeSubTab === 'uncompleted' ? 'bg-red-50 text-red-600 border border-red-200' : 'text-gray-500 hover:bg-gray-100 border border-transparent'}`}
                        >
                            {t('team_tasks.tab_uncompleted', 'Uncompleted')} ({
                                tasks.filter(t => {
                                    if (t.deadline?.toDate() >= new Date()) return false;
                                    const total = t.assigneeIds.length;
                                    const completed = Object.values(t.assignees).filter(a => a.status === 'completed').length;
                                    return total === 0 || completed < total;
                                }).length
                            })
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('completed')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeSubTab === 'completed' ? 'bg-green-50 text-green-600 border border-green-200' : 'text-gray-500 hover:bg-gray-100 border border-transparent'}`}
                        >
                            {t('team_tasks.tab_completed', 'Completed')} ({
                                tasks.filter(t => {
                                    if (t.deadline?.toDate() >= new Date()) return false;
                                    const total = t.assigneeIds.length;
                                    const completed = Object.values(t.assignees).filter(a => a.status === 'completed').length;
                                    return total > 0 && completed === total;
                                }).length
                            })
                        </button>
                    </div>
                )}
            </div>

            {activeTab === 'campaigns' ? (
                <CampaignManager />
            ) : loadingTasks ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-desert-gold"></div>
                </div>
            ) : tasks.length === 0 ? (
                <div className="glass-panel rounded-2xl p-12 text-center text-arabian-night/40 border border-white">
                    <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg">{t('team_tasks.empty_state')}</p>
                </div>
            ) : (() => {
                        const now = new Date();
                        const displayedTasks = tasks.filter(task => {
                            const isExpired = task.deadline?.toDate() < now;
                            if (activeTab === 'in_progress') return !isExpired;
                            
                            if (activeTab === 'expired') {
                                if (!isExpired) return false;
                                const total = task.assigneeIds.length;
                                const completed = Object.values(task.assignees).filter(a => a.status === 'completed').length;
                                const isFullyCompleted = total > 0 && completed === total;
                                if (activeSubTab === 'completed') return isFullyCompleted;
                                return !isFullyCompleted;
                            }
                            return true;
                        });

                        if (displayedTasks.length === 0) {
                            return (
                                <div className="glass-panel rounded-2xl p-12 text-center text-arabian-night/40 border border-white">
                                    <p className="text-lg">{t('common.no_data', 'No Data Available')}</p>
                                </div>
                            );
                        }

                        return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {displayedTasks.map(task => {
                        const total = task.assigneeIds.length;
                        const completed = Object.values(task.assignees).filter(a => a.status === 'completed').length;
                        const isExpired = task.deadline?.toDate() < new Date();
                        
                        return (
                            <div key={task.id} className="glass-panel rounded-2xl p-6 border border-white flex flex-col relative overflow-hidden">
                                {isExpired && <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] px-3 py-1 font-bold rounded-bl-lg">{t('team_tasks.expired')}</div>}
                                
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-bold text-xl text-deep-teal">{task.title}</h3>
                                    <div className="text-right flex flex-col gap-1">
                                        <div>
                                            <p className="text-[10px] font-semibold text-arabian-night/50 uppercase tracking-wider leading-none mb-0.5">{t('team_tasks.start_time', 'Start Time')}</p>
                                            <p className="text-xs font-medium text-arabian-night/75">
                                                {task.createdAt?.toDate ? task.createdAt.toDate().toLocaleString() : (task.createdAt ? new Date(task.createdAt).toLocaleString() : '-')}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold text-arabian-night/50 uppercase tracking-wider leading-none mb-0.5 flex items-center gap-1.5 justify-end">
                                                {t('team_tasks.deadline', 'Deadline')}
                                                {(user?.uid === task.assignerId || profile?.role === 'super_admin' || isSuperAdmin) && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => openEditDeadlineModal(task)} 
                                                        className="text-deep-teal hover:text-desert-gold transition-colors inline-flex cursor-pointer p-0.5 rounded hover:bg-black/5"
                                                        title={t('team_tasks.edit_deadline', '修改截止时间')}
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </p>
                                            <p className={`text-sm font-bold ${isExpired ? 'text-red-500' : 'text-desert-gold'}`}>
                                                {task.deadline?.toDate().toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-4 mb-4 text-sm text-arabian-night/70 bg-white/40 p-3 rounded-lg">
                                    <div className="flex items-center gap-1.5"><FileAudio className="w-4 h-4 text-blue-500" /> {t('team_tasks.recordings_count', { count: task.recordingIds.length })}</div>
                                    <div className="flex items-center gap-1.5"><Users className="w-4 h-4 text-green-500" /> {t('team_tasks.members_count', { count: total })}</div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span className="text-arabian-night/60">{t('team_tasks.progress')}</span>
                                        <span className="text-deep-teal">{completed} / {total}</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden mb-4">
                                        <div 
                                            className="h-full bg-desert-gold transition-all" 
                                            style={{ width: `${(completed / total) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="mt-auto space-y-2.5">
                                    <p className="text-xs font-bold text-arabian-night/50 border-b border-black/5 pb-1">{t('team_tasks.member_status')}</p>
                                    
                                    {/* Tab selection within card to save space on mobile */}
                                    <div className="flex gap-2 p-1 bg-slate-100/60 rounded-xl">
                                        <button 
                                            type="button"
                                            onClick={() => setCardTab(task.id, 'progress')}
                                            className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                                                getCardTab(task.id) === 'progress' 
                                                    ? 'bg-white shadow-sm text-slate-800 font-black' 
                                                    : 'text-slate-400 hover:text-slate-650'
                                            }`}
                                        >
                                            {t('team_tasks.tab_progress', '进度看板')} ({completed} / {total})
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setCardTab(task.id, 'reflections')}
                                            className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                                                getCardTab(task.id) === 'reflections' 
                                                    ? 'bg-white shadow-sm text-desert-gold font-black' 
                                                    : 'text-slate-400 hover:text-slate-650'
                                            }`}
                                        >
                                            {t('team_tasks.reflection', '心得感受')} ({
                                                Object.values(task.assignees).filter((a: any) => a.reflection || a.reflections).length
                                            })
                                        </button>
                                    </div>

                                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                        {getCardTab(task.id) === 'progress' ? (
                                            <div className="space-y-3">
                                                {(() => {
                                                    const completedAssignees = Object.entries(task.assignees).filter(([_, a]) => a.status === 'completed');
                                                    if (completedAssignees.length === 0) return null;
                                                    return (
                                                        <div>
                                                            <span className="text-[10px] font-bold text-green-600 mb-1.5 block">✅ {t('team_tasks.status_completed')} ({completedAssignees.length})</span>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {completedAssignees.map(([uid, a]) => (
                                                                    <span key={uid} className="bg-green-50 text-green-700 text-[10px] font-medium px-2 py-0.5 rounded border border-green-100" title={a.crmId}>
                                                                        {a.crmId}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                                
                                                {(() => {
                                                    const uncompletedAssignees = Object.entries(task.assignees).filter(([_, a]) => a.status !== 'completed');
                                                    if (uncompletedAssignees.length === 0) return null;
                                                    return (
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-500 mb-1.5 block">⏳ {isExpired ? t('team_tasks.status_uncompleted', 'Uncompleted') : t('team_tasks.status_pending')} ({uncompletedAssignees.length})</span>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {uncompletedAssignees.map(([uid, a]) => (
                                                                    <span key={uid} className={`text-[10px] font-medium px-2 py-0.5 rounded border ${isExpired ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-600 border-gray-200'}`} title={a.crmId}>
                                                                        {a.crmId}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {(() => {
                                                    const usersWithReflections = Object.entries(task.assignees).filter(([_, a]) => a.reflection || a.reflections);
                                                    if (usersWithReflections.length === 0) {
                                                        return <p className="text-xs text-slate-400 text-center py-4">{t('team_tasks.no_reflections_yet', '暂无成员提交心得')}</p>;
                                                    }
                                                    return usersWithReflections.map(([uid, a]) => (
                                                        <div key={uid} className="bg-white/50 p-2.5 rounded border border-gray-100 space-y-1">
                                                            <span className="font-bold text-xs text-slate-700 flex items-center gap-1">
                                                                {a.status === 'completed' ? <span className="text-green-500">●</span> : <span className="text-gray-400">●</span>}
                                                                {a.crmId}
                                                            </span>
                                                            {a.reflection && !a.reflections && (
                                                                <div className="text-xs text-slate-500 italic">
                                                                    "{a.reflection}"
                                                                </div>
                                                            )}
                                                            {a.reflections && Object.entries(a.reflections).map(([recId, text]) => {
                                                                const recTitle = allRecordings.find(r => r.id === recId)?.title || recId;
                                                                return (
                                                                    <div key={recId} className="text-xs text-slate-500 italic relative pl-2 border-l-2 border-desert-gold/30">
                                                                        <span className="text-[10px] text-gray-400 block truncate">{recTitle}</span>
                                                                        "{String(text)}"
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        })()}

            {/* Create Task Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-arabian-night/60 backdrop-blur-sm">
                    <div className="bg-warm-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white">
                            <h2 className="text-xl font-bold text-deep-teal">{t('team_tasks.modal_title')}</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-arabian-night/80 mb-2">{t('team_tasks.task_title_label')}</label>
                                <input 
                                    type="text" 
                                    value={newTaskTitle}
                                    onChange={e => setNewTaskTitle(e.target.value)}
                                    placeholder={t('team_tasks.task_title_placeholder')}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold focus:border-transparent outline-none"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="block text-sm font-bold text-arabian-night/80">{t('team_tasks.assign_to_label')}</label>
                                    <button onClick={selectAllUsers} className="text-xs text-desert-gold font-bold hover:underline">{t('team_tasks.select_all')}</button>
                                </div>
                                <div className="max-h-60 overflow-y-auto p-3 bg-white rounded-lg border border-gray-100 space-y-4">
                                     {groupedUsers.map(([teamName, users]) => {
                                         const teamUserIds = users.map(u => u.id);
                                         const allSelected = teamUserIds.every(id => selectedUserIds.includes(id));
                                         // Auto-expand the group by default for SM or TL role, so they don't have to manually expand it every time
                                         const isExpanded = (profile?.role === 'sm' || profile?.role === 'tl')
                                             ? (expandedGroups[teamName] !== false)
                                             : !!expandedGroups[teamName];
                                         
                                         // Sub-grouping within the major group
                                         const subGroups = {};
                                         users.forEach(u => {
                                             const hasSd = !!u.sd;
                                             const isSd = u.role === 'sd';
                                             const isSales = hasSd || isSd;
                                             
                                             let subName = '';
                                             if (isSales) {
                                                 subName = u.team || t('team_tasks.unassigned_team', '未分组');
                                             } else {
                                                 subName = ''; // List functional users directly
                                             }
                                             if (!subGroups[subName]) subGroups[subName] = [];
                                             subGroups[subName].push(u);
                                         });
                                         
                                         return (
                                             <div key={teamName} className="space-y-2 border-b border-gray-100/80 pb-3 last:border-b-0">
                                                 {/* Major Group Collapsible Header */}
                                                 <div 
                                                     onClick={() => setExpandedGroups(prev => ({ ...prev, [teamName]: !prev[teamName] }))}
                                                     className="flex justify-between items-center bg-gray-50/80 p-2 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                                 >
                                                     <div className="flex items-center gap-2">
                                                         <span className="text-[10px] text-gray-400 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>
                                                             ▶
                                                         </span>
                                                         <span className="font-extrabold text-xs text-deep-teal">{teamName}</span>
                                                         <span className="text-[9px] text-gray-400 font-bold bg-white px-1.5 py-0.5 rounded-full border border-gray-100">
                                                             {users.length}
                                                         </span>
                                                     </div>
                                                     <button 
                                                         type="button"
                                                         onClick={(e) => {
                                                             e.stopPropagation();
                                                             toggleTeamSelection(users);
                                                         }} 
                                                         className="text-[10px] text-desert-gold font-bold hover:underline bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100 active:scale-95 transition-all"
                                                     >
                                                         {allSelected ? t('common.deselect_all', '取消全选') : t('common.select_all', '全选本组')}
                                                     </button>
                                                 </div>
                                                 
                                                 {/* Collapsible Content Body */}
                                                 {isExpanded && (
                                                     <div className="pl-3 pr-1 pt-1.5 pb-0.5 space-y-3 border-l border-dashed border-gray-200 ml-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                                         {Object.entries(subGroups).map(([subName, subUsers]) => {
                                                             const subUserIds = subUsers.map(u => u.id);
                                                             const allSubSelected = subUserIds.every(id => selectedUserIds.includes(id));
                                                             
                                                             return (
                                                                 <div key={subName} className="space-y-1.5">
                                                                     {subName && (
                                                                         <div className="flex justify-between items-center bg-gray-50/40 p-1.5 rounded-lg border border-gray-100/50">
                                                                             <span className="font-extrabold text-[11px] text-arabian-night/70 pl-1">{subName}</span>
                                                                             <button 
                                                                                 type="button"
                                                                                 onClick={() => toggleSubGroupSelection(subUsers)} 
                                                                                 className="text-[9px] text-desert-gold font-bold hover:underline bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100"
                                                                             >
                                                                                 {allSubSelected ? t('common.deselect_all', '取消本组') : t('common.select_all', '全选本组')}
                                                                             </button>
                                                                         </div>
                                                                     )}
                                                                     <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-1">
                                                                         {subUsers.map(u => (
                                                                             <label key={u.id} className="flex items-center gap-2 text-xs p-1.5 cursor-pointer hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200/50 transition-all select-none">
                                                                                 <input 
                                                                                     type="checkbox" 
                                                                                     checked={selectedUserIds.includes(u.id)}
                                                                                     onChange={() => toggleUserSelection(u.id)}
                                                                                     className="rounded text-desert-gold focus:ring-desert-gold h-3.5 w-3.5"
                                                                                 />
                                                                                 <span className="truncate flex-1 font-semibold text-arabian-night/80" title={u.crmId}>{u.crmId}</span>
                                                                             </label>
                                                                         ))}
                                                                     </div>
                                                                 </div>
                                                             );
                                                         })}
                                                     </div>
                                                 )}
                                             </div>
                                         );
                                      })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-arabian-night/80 mb-2">{t('team_tasks.select_recordings')}</label>
                                <div className="relative mb-2">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="h-4 w-4 text-arabian-night/40" />
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder={t('team_tasks.search_recording_placeholder')}
                                        value={recordingSearchQuery}
                                        onChange={(e) => setRecordingSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-desert-gold focus:border-transparent text-sm bg-white/50"
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto p-2 bg-white rounded-lg border border-gray-100">
                                    {filteredRecordings.length === 0 ? <p className="text-xs text-gray-400 text-center py-2">{t('team_tasks.no_recordings_found', '未找到匹配的录音')}</p> : 
                                     filteredRecordings.map(r => (
                                        <label key={r.id} className="flex items-center gap-3 text-sm p-2 cursor-pointer hover:bg-gray-50 rounded border border-transparent hover:border-gray-200">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedRecordingIds.includes(r.id)}
                                                onChange={() => toggleRecordingSelection(r.id)}
                                                className="rounded text-desert-gold focus:ring-desert-gold mt-0.5"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-arabian-night truncate">{r.title}</p>
                                                {r.displayId && <p className="text-xs text-gray-400">{r.displayId}</p>}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-arabian-night/80 mb-2">{t('team_tasks.deadline_date')}</label>
                                    <input 
                                        type="date" 
                                        value={deadlineDate}
                                        onChange={e => setDeadlineDate(e.target.value)}
                                        className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-desert-gold outline-none text-sm transition-all ${isDeadlineInvalid ? 'border-red-300 bg-red-50/20' : 'border-gray-200'}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-arabian-night/80 mb-2">{t('team_tasks.deadline_time')}</label>
                                    <input 
                                        type="time" 
                                        value={deadlineTime}
                                        onChange={e => setDeadlineTime(e.target.value)}
                                        className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-desert-gold outline-none text-sm transition-all ${isDeadlineInvalid ? 'border-red-300 bg-red-50/20' : 'border-gray-200'}`}
                                    />
                                </div>
                            </div>
                            {isDeadlineInvalid && (
                                <p className="text-red-500 text-xs font-semibold flex items-center gap-1 mt-1 animate-pulse">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {t('team_tasks.deadline_warning_past', '警告：截止时间不能早于或等于当前时间！')}
                                </p>
                            )}
                        </div>
                        
                        <div className="p-6 border-t border-gray-200 bg-white flex justify-end gap-3">
                            <button 
                                onClick={() => setShowCreateModal(false)}
                                className="px-5 py-2 rounded-lg font-bold text-arabian-night/60 hover:bg-gray-100 transition-colors"
                            >
                                {t('team_tasks.cancel')}
                            </button>
                            <button 
                                onClick={handleCreateTask}
                                disabled={submitting || selectedUserIds.length === 0 || selectedRecordingIds.length === 0 || !deadlineDate || !deadlineTime}
                                className="px-6 py-2 bg-deep-teal text-white rounded-lg font-bold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {submitting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                                {t('team_tasks.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Task Deadline Modal */}
            {editingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-arabian-night/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-warm-white rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white">
                            <h2 className="text-xl font-bold text-deep-teal">{t('team_tasks.edit_deadline_title', '修改截止时间')}</h2>
                            <button onClick={() => setEditingTask(null)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="bg-white/40 p-4 rounded-xl border border-gray-100/50">
                                <h3 className="font-bold text-sm text-deep-teal mb-1">{editingTask.title}</h3>
                                <p className="text-xs text-arabian-night/60 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-desert-gold" />
                                    {t('team_tasks.current_deadline', '当前截止：')}{editingTask.deadline?.toDate().toLocaleString()}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-arabian-night/85 mb-2">{t('team_tasks.new_deadline_date', '新截止日期')}</label>
                                    <input 
                                        type="date" 
                                        value={editDeadlineDate}
                                        onChange={e => setEditDeadlineDate(e.target.value)}
                                        className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-desert-gold outline-none text-sm transition-all ${isEditDeadlineInvalid ? 'border-red-300 bg-red-50/20' : 'border-gray-200'}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-arabian-night/85 mb-2">{t('team_tasks.new_deadline_time', '新截止时间')}</label>
                                    <input 
                                        type="time" 
                                        value={editDeadlineTime}
                                        onChange={e => setEditDeadlineTime(e.target.value)}
                                        className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-desert-gold outline-none text-sm transition-all ${isEditDeadlineInvalid ? 'border-red-300 bg-red-50/20' : 'border-gray-200'}`}
                                    />
                                </div>
                            </div>

                            {isEditDeadlineInvalid && (
                                <p className="text-red-500 text-xs font-semibold flex items-center gap-1 mt-1 animate-pulse">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {t('team_tasks.deadline_warning_past', '警告：截止时间不能早于或等于当前时间！')}
                                </p>
                            )}
                        </div>
                        
                        <div className="p-6 border-t border-gray-200 bg-white flex justify-end gap-3">
                            <button 
                                onClick={() => setEditingTask(null)}
                                className="px-5 py-2 rounded-lg font-bold text-arabian-night/60 hover:bg-gray-100 transition-colors text-sm"
                            >
                                {t('team_tasks.cancel', '取消')}
                            </button>
                            <button 
                                onClick={handleUpdateDeadline}
                                disabled={updatingDeadline || isEditDeadlineInvalid || !editDeadlineDate || !editDeadlineTime}
                                className="px-6 py-2 bg-deep-teal text-white rounded-lg font-bold hover:bg-teal-700 transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
                            >
                                {updatingDeadline && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                                {t('common.submit', '确定')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
