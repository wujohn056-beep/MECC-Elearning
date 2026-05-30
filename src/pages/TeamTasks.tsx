import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, addDoc, serverTimestamp, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTranslation } from 'react-i18next';
import { Users, FileAudio, Calendar, CheckCircle, Clock, AlertCircle, Search, LayoutDashboard, ClipboardList } from 'lucide-react';

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
    
    const [tasks, setTasks] = useState<LearningTask[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
    const [allRecordings, setAllRecordings] = useState<RecordingInfo[]>([]);
    
    // Tabs state
    const [activeTab, setActiveTab] = useState<'in_progress' | 'expired'>('in_progress');
    const [activeSubTab, setActiveSubTab] = useState<'uncompleted' | 'completed'>('uncompleted');
    
    // Form state
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [selectedRecordingIds, setSelectedRecordingIds] = useState<string[]>([]);
    const [deadlineDate, setDeadlineDate] = useState('');
    const [deadlineTime, setDeadlineTime] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [recordingSearchQuery, setRecordingSearchQuery] = useState('');

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
                const uTeam = (u.team || '').trim();
                // Never show users without a team in task assignment to prevent "Unassigned" block
                if (!uTeam) return false;

                if (isSuperAdmin) return true;

                const loggedInRole = String(profile?.role).trim().toLowerCase();
                const loggedInCrmId = (profile?.crmId || '').trim().toLowerCase();
                const loggedInTeam = (profile?.team || '').trim().toLowerCase();

                const uSd = (u.sd || '').trim().toLowerCase();
                const uSm = (u.sm || '').trim().toLowerCase();
                const uTl = (u.tl || '').trim().toLowerCase();
                const uTeamLower = uTeam.toLowerCase();

                if (loggedInRole === 'sd') {
                    return uSd === loggedInCrmId;
                } else if (loggedInRole === 'sm') {
                    return uSm === loggedInCrmId;
                } else if (loggedInRole === 'tl') {
                    return uTeamLower === loggedInTeam || uTl === loggedInCrmId;
                }
                return false;
            });
            setAllUsers(filteredUsers);

            // Fetch recordings
            const recsSnap = await getDocs(collection(db, 'recordings'));
            const recsData: RecordingInfo[] = [];
            recsSnap.forEach(doc => {
                const data = doc.data();
                recsData.push({ id: doc.id, title: data.title, displayId: data.displayId });
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

            await addDoc(collection(db, 'learning_tasks'), {
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
                fetch('/.netlify/functions/dingtalk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'notifyTask',
                        title: newTaskTitle || '学习任务',
                        assignerName: profile?.crmId || 'Leader',
                        assigneeIds: selectedUserIds,
                        recordingIds: selectedRecordingIds,
                        deadline: deadlineObj.toLocaleString()
                    })
                }).catch(err => console.error("DingTalk task notification background error:", err));
            } catch (notifyErr) {
                console.error("Failed to initiate DingTalk task notification request:", notifyErr);
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
            const teamName = u.team || t('team_tasks.unassigned_team', '未分组');
            if (!groups[teamName]) groups[teamName] = [];
            groups[teamName].push(u);
        });
        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    }, [allUsers, t]);

    const toggleTeamSelection = (teamUsers: UserRecord[]) => {
        const teamUserIds = teamUsers.map(u => u.id);
        const allSelected = teamUserIds.every(id => selectedUserIds.includes(id));
        if (allSelected) {
            setSelectedUserIds(prev => prev.filter(id => !teamUserIds.includes(id)));
        } else {
            setSelectedUserIds(prev => Array.from(new Set([...prev, ...teamUserIds])));
        }
    };

    const filteredRecordings = allRecordings.filter(r => 
        r.title.toLowerCase().includes(recordingSearchQuery.toLowerCase()) || 
        (r.displayId && r.displayId.toLowerCase().includes(recordingSearchQuery.toLowerCase()))
    );

    return (
        <div className="animate-in fade-in duration-500 max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col mb-6 gap-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-deep-teal">{t('team_tasks.title', '团队任务')}</h1>
                        <p className="text-arabian-night/60 mt-1">{t('team_tasks.desc', '指派学习任务并追踪团队成员进度')}</p>
                    </div>
                    
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="bg-desert-gold text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:bg-yellow-600 transition-colors"
                    >
                        + {t('team_tasks.new_task', '新建任务')}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            {!loadingTasks && tasks.length > 0 && (
                <div className="flex flex-col gap-3 mb-6">
                    <div className="flex gap-2 bg-gray-50/50 p-1 rounded-xl w-fit">
                        <button 
                            onClick={() => setActiveTab('in_progress')}
                            className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'in_progress' ? 'bg-white shadow text-deep-teal' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            {t('team_tasks.tab_in_progress', 'In Progress')} ({tasks.filter(t => t.deadline?.toDate() >= new Date()).length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('expired')}
                            className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'expired' ? 'bg-white shadow text-red-500' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            {t('team_tasks.tab_expired', 'Expired')} ({tasks.filter(t => t.deadline?.toDate() < new Date()).length})
                        </button>
                    </div>

                    {activeTab === 'expired' && (
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
            )}

            {loadingTasks ? (
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
                                    <div className="text-right">
                                        <p className="text-xs font-semibold text-arabian-night/50">{t('team_tasks.deadline')}</p>
                                        <p className={`text-sm font-bold ${isExpired ? 'text-red-500' : 'text-desert-gold'}`}>
                                            {task.deadline?.toDate().toLocaleString()}
                                        </p>
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

                                <div className="mt-auto space-y-2">
                                    <p className="text-xs font-bold text-arabian-night/50 border-b border-black/5 pb-1">{t('team_tasks.member_status')}</p>
                                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                        {/* Compact tags for members */}
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

                                        {/* Reflections Section */}
                                        {(() => {
                                            const usersWithReflections = Object.entries(task.assignees).filter(([_, a]) => a.reflection || a.reflections);
                                            if (usersWithReflections.length === 0) return null;
                                            return (
                                                <div className="pt-3 mt-3 border-t border-gray-100 space-y-2">
                                                    <span className="text-[10px] font-bold text-desert-gold block">📝 {t('team_tasks.reflection')}</span>
                                                    {usersWithReflections.map(([uid, a]) => (
                                                        <div key={uid} className="bg-white/50 p-2.5 rounded border border-gray-100 space-y-2">
                                                            <span className="font-bold text-xs text-deep-teal flex items-center gap-1">
                                                                {a.status === 'completed' ? <CheckCircle className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-red-400" />}
                                                                {a.crmId}
                                                            </span>
                                                            
                                                            {/* Legacy string reflection */}
                                                            {a.reflection && !a.reflections && (
                                                                <div className="text-xs text-arabian-night/80 italic">
                                                                    {a.reflection}
                                                                </div>
                                                            )}
                                                            
                                                            {/* New per-recording reflections */}
                                                            {a.reflections && Object.entries(a.reflections).map(([recId, text]) => {
                                                                const recTitle = allRecordings.find(r => r.id === recId)?.title || recId;
                                                                return (
                                                                    <div key={recId} className="text-xs text-arabian-night/80 italic relative pl-2 border-l-2 border-desert-gold/30">
                                                                        <span className="text-[10px] text-gray-400 block mb-0.5 truncate">{recTitle}</span>
                                                                        {String(text)}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
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
                                    {allUsers.length === 0 ? <p className="text-xs text-gray-400">{t('team_tasks.no_subordinates')}</p> : 
                                     groupedUsers.map(([teamName, users]) => {
                                        const teamUserIds = users.map(u => u.id);
                                        const allSelected = teamUserIds.every(id => selectedUserIds.includes(id));
                                        
                                        return (
                                            <div key={teamName} className="space-y-2">
                                                <div className="flex justify-between items-center bg-gray-50 p-1.5 rounded">
                                                    <span className="font-bold text-xs text-deep-teal">{teamName}</span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => toggleTeamSelection(users)} 
                                                        className="text-[10px] text-desert-gold font-bold hover:underline bg-white px-2 py-0.5 rounded shadow-sm"
                                                    >
                                                        {allSelected ? t('common.deselect_all', '取消全选') : t('common.select_all', '全选本组')}
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-1">
                                                    {users.map(u => (
                                                        <label key={u.id} className="flex items-center gap-2 text-sm p-1 cursor-pointer hover:bg-gray-50 rounded border border-transparent hover:border-gray-200">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedUserIds.includes(u.id)}
                                                                onChange={() => toggleUserSelection(u.id)}
                                                                className="rounded text-desert-gold focus:ring-desert-gold"
                                                            />
                                                            <span className="truncate flex-1" title={u.crmId}>{u.crmId}</span>
                                                        </label>
                                                    ))}
                                                </div>
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
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold outline-none text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-arabian-night/80 mb-2">{t('team_tasks.deadline_time')}</label>
                                    <input 
                                        type="time" 
                                        value={deadlineTime}
                                        onChange={e => setDeadlineTime(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold outline-none text-sm"
                                    />
                                </div>
                            </div>
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
        </div>
    );
}
