import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, Calendar, Users, Clock, CheckCircle, BarChart3 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

interface UserRecord {
    id: string;
    crmId: string;
    role: string;
    team: string;
    sd: string;
    sm: string;
    tl: string;
    dep?: 'CC' | 'SS' | 'functional';
}

interface LearningLog {
    userId: string;
    durationSeconds: number;
    listenedAt: any; // Firestore Timestamp
}

interface ActivityLog {
    userId: string;
    crmId: string;
    name: string;
    team: string;
    date: string;
    lastLoginAt: any;
}

interface LearningTask {
    id: string;
    createdAt: any; // Firestore Timestamp
    assigneeIds: string[];
    assignees: Record<string, { status: string }>;
    assignerId?: string;
}

interface Recording {
    id: string;
    createdAt: any;
    lecturerName?: string;
    title?: string;
    businessType?: 'kid' | 'adult' | 'ss';
}

export default function AdminDashboard() {
    const { t } = useTranslation();
    const { profile, hasPermission } = useAuth();
    const isSuperAdmin = hasPermission('manageDashboard');
    const dashboardRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(true);
    const [startDateStr, setStartDateStr] = useState<string>(() => {
        const d = startOfMonth(new Date());
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [endDateStr, setEndDateStr] = useState<string>(() => {
        const d = endOfMonth(new Date());
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    
    const [filterSd, setFilterSd] = useState<string>('all');
    const [filterSm, setFilterSm] = useState<string>('all');
    const [filterTeam, setFilterTeam] = useState<string>('all');
    const [filterCc, setFilterCc] = useState<string>('all');
    const [activityTab, setActivityTab] = useState<'logins' | 'never' | 'inactive'>('logins');
    
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [logs, setLogs] = useState<LearningLog[]>([]);
    const [tasks, setTasks] = useState<LearningTask[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [recordings, setRecordings] = useState<Recording[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Users
            const usersSnap = await getDocs(collection(db, 'users'));
            const usersData: UserRecord[] = [];
            usersSnap.forEach(doc => {
                usersData.push({ id: doc.id, ...doc.data() } as UserRecord);
            });
            setUsers(usersData);

            // Fetch Logs
            // Note: In a massive scale app, we would paginate or query by date.
            // For MECC scale, fetching all and filtering in memory is fine and fast.
            const logsSnap = await getDocs(collection(db, 'learning_history'));
            const logsData: LearningLog[] = [];
            logsSnap.forEach(doc => {
                const data = doc.data();
                if (data.listenedAt) {
                    logsData.push({ userId: data.userId, durationSeconds: data.durationSeconds || 0, listenedAt: data.listenedAt });
                }
            });
            setLogs(logsData);

            // Fetch Tasks
            const tasksSnap = await getDocs(collection(db, 'learning_tasks'));
            const tasksData: LearningTask[] = [];
            tasksSnap.forEach(doc => {
                const data = doc.data();
                if (data.createdAt) {
                    tasksData.push({ id: doc.id, createdAt: data.createdAt, assigneeIds: data.assigneeIds || [], assignees: data.assignees || {}, assignerId: data.assignerId });
                }
            });
            setTasks(tasksData);

            // Fetch Activity Logs
            const activitySnap = await getDocs(collection(db, 'user_activity_logs'));
            const activityData: ActivityLog[] = [];
            activitySnap.forEach(doc => {
                activityData.push(doc.data() as ActivityLog);
            });
            setActivityLogs(activityData);

            // Fetch Recordings for Contribution Rankings
            const recSnap = await getDocs(collection(db, 'recordings'));
            const recData: Recording[] = [];
            recSnap.forEach(doc => {
                recData.push({ id: doc.id, ...doc.data() } as Recording);
            });
            setRecordings(recData);
        } catch (error) {
            console.error("Error fetching dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    // 1. Filter Users by Scope
    const scopeUsers = useMemo(() => {
        if (!profile) return [];
        
        let pool = users;
        const absoluteSuperAdmin = profile?.role === 'super_admin';
        if (!absoluteSuperAdmin) {
            const adminDep = profile?.dep || 'CC';
            pool = users.filter(u => (u.dep || 'CC') === adminDep);
        }

        if (absoluteSuperAdmin || isSuperAdmin) return pool;
        
        return pool.filter(u => {
            const loggedInRole = profile?.role;
            const loggedInCrmId = (profile?.crmId || '').trim().toLowerCase();
            const loggedInTeam = (profile?.team || '').trim().toLowerCase();
            const uCrmIdLower = (u.crmId || '').trim().toLowerCase();
            const uIdLower = (u.id || '').trim().toLowerCase();
            const uSdLower = (u.sd || '').trim().toLowerCase();
            const uSmLower = (u.sm || '').trim().toLowerCase();
            const uTlLower = (u.tl || '').trim().toLowerCase();
            const uTeamLower = (u.team || '').trim().toLowerCase();

            if (loggedInRole === 'sd') {
                return uSdLower === loggedInCrmId || uIdLower === loggedInCrmId || uCrmIdLower === loggedInCrmId;
            }
            if (loggedInRole === 'sm') {
                return uSmLower === loggedInCrmId || uIdLower === loggedInCrmId || uCrmIdLower === loggedInCrmId;
            }
            if (loggedInRole === 'tl') {
                return uTlLower === loggedInCrmId || uTeamLower === loggedInTeam || uIdLower === loggedInCrmId || uCrmIdLower === loggedInCrmId;
            }
            return false;
        });
    }, [users, profile, isSuperAdmin]);



    // Derived Options based on current filters and scope
    const availableSds = useMemo(() => Array.from(new Set(scopeUsers.map(u => u.sd?.toUpperCase()).filter(Boolean))).sort(), [scopeUsers]);
    
    const availableSms = useMemo(() => {
        let pool = scopeUsers;
        if (filterSd !== 'all') pool = pool.filter(u => u.sd?.toUpperCase() === filterSd.toUpperCase());
        return Array.from(new Set(pool.map(u => u.sm?.toUpperCase()).filter(Boolean))).sort();
    }, [scopeUsers, filterSd]);

    const availableTeams = useMemo(() => {
        let pool = scopeUsers;
        if (filterSd !== 'all') pool = pool.filter(u => u.sd?.toUpperCase() === filterSd.toUpperCase());
        if (filterSm !== 'all') pool = pool.filter(u => u.sm?.toUpperCase() === filterSm.toUpperCase());
        return Array.from(new Set(pool.map(u => u.team?.toUpperCase()).filter(Boolean))).sort();
    }, [scopeUsers, filterSd, filterSm]);

    const availableCcs = useMemo(() => {
        let pool = scopeUsers;
        if (filterSd !== 'all') pool = pool.filter(u => u.sd?.toUpperCase() === filterSd.toUpperCase());
        if (filterSm !== 'all') pool = pool.filter(u => u.sm?.toUpperCase() === filterSm.toUpperCase());
        if (filterTeam !== 'all') pool = pool.filter(u => u.team?.toUpperCase() === filterTeam.toUpperCase());
        return Array.from(new Set(pool.map(u => u.crmId?.toUpperCase()).filter(Boolean))).sort();
    }, [scopeUsers, filterSd, filterSm, filterTeam]);

    // Apply all filters to get the final displayed users
    const displayedUsers = useMemo(() => {
        return scopeUsers.filter(u => {
            if (filterSd !== 'all' && u.sd?.toUpperCase() !== filterSd.toUpperCase()) return false;
            if (filterSm !== 'all' && u.sm?.toUpperCase() !== filterSm.toUpperCase()) return false;
            if (filterTeam !== 'all' && u.team?.toUpperCase() !== filterTeam.toUpperCase()) return false;
            if (filterCc !== 'all' && u.crmId?.toUpperCase() !== filterCc.toUpperCase()) return false;
            return true;
        });
    }, [scopeUsers, filterSd, filterSm, filterTeam, filterCc]);

    const displayedUserIds = useMemo(() => new Set(displayedUsers.map(u => u.id)), [displayedUsers]);

    // 2. Filter Dates
    const { startDate, endDate } = useMemo(() => {
        const sDate = startDateStr ? startOfDay(new Date(startDateStr)) : new Date(0);
        const eDate = endDateStr ? endOfDay(new Date(endDateStr)) : new Date(3000, 0, 1);
        return { startDate: sDate, endDate: eDate };
    }, [startDateStr, endDateStr]);

    // 3. Filter Logs & Tasks by Date
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            if (!log.listenedAt) return false;
            const d = log.listenedAt.toDate();
            return isWithinInterval(d, { start: startDate, end: endDate }) && displayedUserIds.has(log.userId);
        });
    }, [logs, startDate, endDate, displayedUserIds]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            if (!task.createdAt) return false;
            const d = task.createdAt.toDate();
            const matchesInterval = isWithinInterval(d, { start: startDate, end: endDate });
            if (!matchesInterval) return false;

            const isAbsoluteSuperAdmin = profile?.role === 'super_admin';
            if (!isAbsoluteSuperAdmin) {
                const hasAssigneeInScope = task.assigneeIds?.some(uid => displayedUserIds.has(uid));
                const hasAssignerInScope = task.assignerId && displayedUserIds.has(task.assignerId);
                return hasAssigneeInScope || hasAssignerInScope;
            }
            return true;
        });
    }, [tasks, startDate, endDate, displayedUserIds, profile]);

    const filteredActivities = useMemo(() => {
        return activityLogs.filter(log => {
            if (!log.date) return false;
            const d = new Date(log.date);
            return isWithinInterval(d, { start: startOfDay(startDate), end: endOfDay(endDate) }) && displayedUserIds.has(log.userId);
        }).sort((a, b) => b.lastLoginAt?.toDate?.()?.getTime() - a.lastLoginAt?.toDate?.()?.getTime());
    }, [activityLogs, startDate, endDate, displayedUserIds]);

    const loginAnalysis = useMemo(() => {
        const now = new Date().getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

        const neverLogged: UserRecord[] = [];
        const inactiveSevenDays: (UserRecord & { lastLogin: Date })[] = [];

        displayedUsers.forEach(u => {
            const uLogs = activityLogs.filter(log => log.userId === u.id);
            if (uLogs.length === 0) {
                neverLogged.push(u);
            } else {
                let latestMs = 0;
                let latestLogDate: Date | null = null;
                uLogs.forEach(log => {
                    if (log.lastLoginAt) {
                        const t = log.lastLoginAt.toDate?.()?.getTime() || new Date(log.lastLoginAt).getTime();
                        if (t > latestMs) {
                            latestMs = t;
                            latestLogDate = log.lastLoginAt.toDate?.() || new Date(log.lastLoginAt);
                        }
                    }
                });

                if (latestMs > 0 && (now - latestMs > sevenDaysMs) && latestLogDate) {
                    inactiveSevenDays.push({ ...u, lastLogin: latestLogDate });
                }
            }
        });

        const groupByOrg = (list: any[]) => {
            const groups: Record<string, Record<string, Record<string, any[]>>> = {};
            list.forEach(item => {
                const sdName = (item.sd || t('dashboard.unassigned_sd', '未分配 SD')).trim().toUpperCase();
                const smName = (item.sm || t('dashboard.unassigned_sm', '未分配 SM')).trim().toUpperCase();
                const tlName = (item.tl || t('dashboard.unassigned_tl', '未分配 TL')).trim().toUpperCase();
                
                if (!groups[sdName]) {
                    groups[sdName] = {};
                }
                if (!groups[sdName][smName]) {
                    groups[sdName][smName] = {};
                }
                if (!groups[sdName][smName][tlName]) {
                    groups[sdName][smName][tlName] = [];
                }
                groups[sdName][smName][tlName].push(item);
            });
            return groups;
        };

        return {
            neverLogged: groupByOrg(neverLogged),
            neverLoggedCount: neverLogged.length,
            inactiveSevenDays: groupByOrg(inactiveSevenDays),
            inactiveSevenDaysCount: inactiveSevenDays.length
        };
    }, [displayedUsers, activityLogs]);

    const filteredRecordings = useMemo(() => {
        return recordings.filter(rec => {
            if (!rec.createdAt) return false;
            const d = rec.createdAt.toDate();
            const matchesInterval = isWithinInterval(d, { start: startDate, end: endDate });
            if (!matchesInterval) return false;

            const isAbsoluteSuperAdmin = profile?.role === 'super_admin';
            if (!isAbsoluteSuperAdmin) {
                const adminDep = profile?.dep || 'CC';
                if (adminDep === 'SS') {
                    if (rec.businessType !== 'ss') return false;
                } else {
                    if (rec.businessType === 'ss') return false;
                }
            }
            return true;
        });
    }, [recordings, startDate, endDate, profile]);

    // 4. Aggregations
    const userStats = useMemo(() => {
        const stats: Record<string, { duration: number; tasksAssigned: number; tasksCompleted: number; tasksPublished: number }> = {};
        displayedUsers.forEach(u => stats[u.id] = { duration: 0, tasksAssigned: 0, tasksCompleted: 0, tasksPublished: 0 });

        filteredLogs.forEach(log => {
            if (stats[log.userId]) {
                stats[log.userId].duration += log.durationSeconds;
            }
        });

        filteredTasks.forEach(task => {
            if (task.assignerId && stats[task.assignerId]) {
                stats[task.assignerId].tasksPublished += 1;
            }
            task.assigneeIds.forEach(uid => {
                if (stats[uid]) {
                    stats[uid].tasksAssigned += 1;
                    if (task.assignees[uid]?.status === 'completed') {
                        stats[uid].tasksCompleted += 1;
                    }
                }
            });
        });

        return stats;
    }, [displayedUsers, filteredLogs, filteredTasks]);

    // Top Level Metrics
    const totalDurationSeconds = Object.values(userStats).reduce((acc, curr) => acc + curr.duration, 0);
    const totalDurationHours = (totalDurationSeconds / 3600).toFixed(1);
    const learningUsersCount = Object.values(userStats).filter(curr => curr.duration > 0).length;
    const avgDurationHours = learningUsersCount > 0 ? (totalDurationSeconds / 3600 / learningUsersCount).toFixed(2) : '0.00';
    
    let totalAssigned = 0;
    let totalCompleted = 0;
    Object.values(userStats).forEach(s => {
        totalAssigned += s.tasksAssigned;
        totalCompleted += s.tasksCompleted;
    });
    const avgCompletionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

    // Rankings
    const userRankings = useMemo(() => {
        return [...displayedUsers].map(u => ({
            ...u,
            duration: userStats[u.id]?.duration || 0,
            completionRate: userStats[u.id]?.tasksAssigned > 0 
                ? Math.round((userStats[u.id].tasksCompleted / userStats[u.id].tasksAssigned) * 100) 
                : 0,
            tasksPublished: userStats[u.id]?.tasksPublished || 0
        })).sort((a, b) => b.duration - a.duration);
    }, [displayedUsers, userStats]);

    const smUserRankings = useMemo(() => {
        return userRankings.filter(u => u.role === 'sm');
    }, [userRankings]);

    const tlUserRankings = useMemo(() => {
        return userRankings.filter(u => u.role === 'tl');
    }, [userRankings]);

    // Group Aggregations (Team, SM, SD)
    const aggregateByField = (field: 'team' | 'sm' | 'sd') => {
        const groups: Record<string, { count: number; duration: number; assigned: number; completed: number; published: number }> = {};
        userRankings.forEach(u => {
            let key = u[field];
            if (!key) return;
            key = key.toUpperCase(); // Normalize keys for aggregation
            if (!groups[key]) groups[key] = { count: 0, duration: 0, assigned: 0, completed: 0, published: 0 };
            groups[key].count += 1;
            groups[key].duration += u.duration;
            groups[key].assigned += userStats[u.id]?.tasksAssigned || 0;
            groups[key].completed += userStats[u.id]?.tasksCompleted || 0;
            groups[key].published += userStats[u.id]?.tasksPublished || 0;
        });

        return Object.entries(groups).map(([name, data]) => ({
            name,
            totalDuration: data.duration,
            avgDuration: data.count > 0 ? data.duration / data.count : 0,
            completionRate: data.assigned > 0 ? Math.round((data.completed / data.assigned) * 100) : 0,
            userCount: data.count,
            totalPublished: data.published,
            avgPublished: data.count > 0 ? data.published / data.count : 0
        }));
    };

    const teamRankings = useMemo(() => aggregateByField('team').sort((a,b) => b.totalDuration - a.totalDuration), [userRankings]);
    const smRankings = useMemo(() => aggregateByField('sm').sort((a,b) => b.totalDuration - a.totalDuration), [userRankings]);
    const sdRankings = useMemo(() => aggregateByField('sd').sort((a,b) => b.totalDuration - a.totalDuration), [userRankings]);

    // Contribution Rankings (Uploads)
    const contributionRankings = useMemo(() => {
        const userMap = new Map<string, UserRecord>();
        users.forEach(u => {
            if (u.crmId) userMap.set(u.crmId.toUpperCase(), u);
            userMap.set(u.id, u);
        });

        const ccCounts: Record<string, number> = {};
        const teamCounts: Record<string, number> = {};
        const smCounts: Record<string, number> = {};
        const sdCounts: Record<string, number> = {};

        filteredRecordings.forEach(rec => {
            if (!rec.lecturerName) return;
            const ccName = rec.lecturerName.toUpperCase();
            const user = userMap.get(ccName);
            
            // CC Ranking
            ccCounts[rec.lecturerName] = (ccCounts[rec.lecturerName] || 0) + 1; // Preserve original casing
            
            // Org Ranking
            if (user) {
                if (user.team) teamCounts[user.team] = (teamCounts[user.team] || 0) + 1;
                if (user.sm) smCounts[user.sm] = (smCounts[user.sm] || 0) + 1;
                if (user.sd) sdCounts[user.sd] = (sdCounts[user.sd] || 0) + 1;
            }
        });

        const sortCounts = (counts: Record<string, number>) => Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        return {
            cc: sortCounts(ccCounts),
            team: sortCounts(teamCounts),
            sm: sortCounts(smCounts),
            sd: sortCounts(sdCounts)
        };
    }, [filteredRecordings, users]);

    const handleDownload = async (elementId: string, reportName: string) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        const scrollableNode = el.querySelector('.overflow-y-auto') as HTMLElement;
        const originalMaxHeight = scrollableNode ? scrollableNode.style.maxHeight : '';
        
        if (scrollableNode) {
            scrollableNode.style.maxHeight = 'none';
        }

        try {
            const dataUrl = await toPng(el, { 
                cacheBust: true, 
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                filter: (node) => {
                    if (node instanceof HTMLElement && node.classList.contains('export-ignore')) {
                        return false;
                    }
                    return true;
                }
            });
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${reportName}_${startDateStr}_${endDateStr}_${new Date().getTime()}.png`;
            link.click();
        } catch (err: any) {
            console.error("Export failed", err);
            alert(t('dashboard.export_failed', '导出失败，请重试。') + '\n\n' + (err.message || err.toString()));
        } finally {
            if (scrollableNode) {
                scrollableNode.style.maxHeight = originalMaxHeight;
            }
        }
    };

    const renderOrgGroupedList = (groupedData: Record<string, Record<string, Record<string, any[]>>>, showLastLogin = false) => {
        const sdNames = Object.keys(groupedData).sort();
        if (sdNames.length === 0) {
            return (
                <div className="py-12 text-center text-gray-400 text-sm">
                    {t('common.no_data', '暂无符合条件的数据')}
                </div>
            );
        }

        return (
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                {sdNames.map(sdName => {
                    const sms = groupedData[sdName];
                    const smNames = Object.keys(sms).sort();
                    
                    return (
                        <div key={sdName} className="border border-slate-100 rounded-2xl bg-slate-50/50 p-4 space-y-4">
                            <h3 className="font-extrabold text-sm text-deep-teal border-b border-deep-teal/10 pb-2 flex items-center gap-2">
                                <span className="bg-deep-teal text-white text-[10px] font-black px-2 py-0.5 rounded-full">SD</span>
                                {sdName}
                            </h3>
                            
                            <div className="space-y-4 pl-2">
                                {smNames.map(smName => {
                                    const tls = sms[smName];
                                    const tlNames = Object.keys(tls).sort();
                                    
                                    return (
                                        <div key={smName} className="border border-slate-100/60 rounded-xl bg-white p-3 space-y-3">
                                            <h4 className="font-bold text-xs text-slate-700 flex items-center gap-2">
                                                <span className="bg-desert-gold/10 text-desert-gold text-[10px] font-black px-2 py-0.5 rounded-full">SM</span>
                                                {smName}
                                            </h4>
                                            
                                            <div className="space-y-4 pl-3">
                                                {tlNames.map(tlName => {
                                                    const members = tls[tlName];
                                                    const teamName = members[0]?.team || '';
                                                    
                                                    return (
                                                        <div key={tlName} className="space-y-2 border-l-2 border-slate-100 pl-3">
                                                            <h5 className="font-semibold text-xs text-slate-500 flex items-center gap-2">
                                                                <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.25 rounded">TL</span>
                                                                <span>{tlName}</span>
                                                                {teamName && <span className="text-slate-400 font-normal">({teamName})</span>}
                                                                <span className="text-slate-400 font-normal ml-1">({members.length} {t('dashboard.members', '人')})</span>
                                                            </h5>
                                                            
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                                {members.map(member => (
                                                                    <div key={member.id} className="bg-white p-3 rounded-xl border border-slate-100/60 shadow-sm flex flex-col justify-between gap-1">
                                                                        <div className="flex justify-between items-start">
                                                                            <span className="font-bold text-xs text-slate-800">{member.crmId}</span>
                                                                            <span className="bg-slate-100 text-[10px] font-bold text-slate-500 px-1.5 py-0.5 rounded">
                                                                                {member.role?.toUpperCase()}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-[11px] text-slate-500">
                                                                            {member.name || '-'}
                                                                        </div>
                                                                        {showLastLogin && member.lastLogin && (
                                                                            <div className="text-[10px] text-amber-600 font-semibold mt-1">
                                                                                {t('dashboard.last_login', '最后登录')}: {member.lastLogin.toLocaleDateString()} {member.lastLogin.toLocaleTimeString()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-deep-teal"></div></div>;
    }

    return (
        <div className="animate-in fade-in duration-500 space-y-8 pb-10" ref={dashboardRef}>
            {/* Header & Controls */}
            <div className="export-ignore flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white/40 p-6 rounded-2xl border border-white/50 shadow-sm">
                <div>
                    <h1 className="text-3xl font-bold text-deep-teal mb-2 flex items-center gap-2">
                        <BarChart3 className="w-8 h-8 text-desert-gold" />
                        {t('dashboard.title', '仪表盘总览')}
                    </h1>
                    <p className="text-arabian-night/60">{t('dashboard.desc', '查看各级架构学习时长与任务完成情况')}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0 justify-end">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <div className="flex items-center gap-1">
                            <input 
                                type="date" 
                                value={startDateStr}
                                onChange={e => setStartDateStr(e.target.value)}
                                className="bg-transparent text-sm font-bold text-deep-teal focus:outline-none"
                            />
                            <span className="text-gray-400 text-sm">-</span>
                            <input 
                                type="date" 
                                value={endDateStr}
                                onChange={e => setEndDateStr(e.target.value)}
                                className="bg-transparent text-sm font-bold text-deep-teal focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Role-based Filters */}
                    {isSuperAdmin && (
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                            <span className="text-xs text-gray-500 font-bold">SD</span>
                            <select 
                                value={filterSd} 
                                onChange={e => { setFilterSd(e.target.value); setFilterSm('all'); setFilterTeam('all'); setFilterCc('all'); }}
                                className="bg-transparent text-sm font-bold text-deep-teal focus:outline-none max-w-[100px] truncate"
                            >
                                <option value="all">{t('common.all', '全部')}</option>
                                {availableSds.map(sd => <option key={sd} value={sd}>{sd}</option>)}
                            </select>
                        </div>
                    )}
                    {(isSuperAdmin || profile?.role === 'sd') && (
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                            <span className="text-xs text-gray-500 font-bold">SM</span>
                            <select 
                                value={filterSm} 
                                onChange={e => { setFilterSm(e.target.value); setFilterTeam('all'); setFilterCc('all'); }}
                                className="bg-transparent text-sm font-bold text-deep-teal focus:outline-none max-w-[100px] truncate"
                            >
                                <option value="all">{t('common.all', '全部')}</option>
                                {availableSms.map(sm => <option key={sm} value={sm}>{sm}</option>)}
                            </select>
                        </div>
                    )}
                    {(isSuperAdmin || profile?.role === 'sd' || profile?.role === 'sm') && (
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                            <span className="text-xs text-gray-500 font-bold">Team</span>
                            <select 
                                value={filterTeam} 
                                onChange={e => { setFilterTeam(e.target.value); setFilterCc('all'); }}
                                className="bg-transparent text-sm font-bold text-deep-teal focus:outline-none max-w-[100px] truncate"
                            >
                                <option value="all">{t('common.all', '全部')}</option>
                                {availableTeams.map(team => <option key={team} value={team}>{team}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                        <span className="text-xs text-gray-500 font-bold">CC</span>
                        <select 
                            value={filterCc} 
                            onChange={e => setFilterCc(e.target.value)}
                            className="bg-transparent text-sm font-bold text-deep-teal focus:outline-none max-w-[100px] truncate"
                        >
                            <option value="all">{t('common.all', '全部')}</option>
                            {availableCcs.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Top Level Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><Users className="w-24 h-24" /></div>
                    <p className="text-sm font-semibold text-arabian-night/50 mb-1">{t('dashboard.total_users', '范围内总人数')}</p>
                    <p className="text-3xl font-bold text-deep-teal">{displayedUsers.length}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><Clock className="w-24 h-24" /></div>
                    <p className="text-sm font-semibold text-arabian-night/50 mb-1">{t('dashboard.total_hours', '总学习时长')}</p>
                    <p className="text-3xl font-bold text-desert-gold">{totalDurationHours} <span className="text-sm">{t('dashboard.hours', '小时')}</span></p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><BarChart3 className="w-24 h-24" /></div>
                    <p className="text-sm font-semibold text-arabian-night/50 mb-1">{t('dashboard.avg_hours', '人均时长')}</p>
                    <p className="text-3xl font-bold text-desert-gold">{avgDurationHours} <span className="text-sm">{t('dashboard.hours', '小时')}</span></p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><CheckCircle className="w-24 h-24" /></div>
                    <p className="text-sm font-semibold text-arabian-night/50 mb-1">{t('dashboard.avg_completion', '平均任务完成率')}</p>
                    <p className="text-3xl font-bold text-deep-teal">{avgCompletionRate}%</p>
                </div>
            </div>

            {/* Login & Activity Records Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative mt-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                    <h2 className="text-lg font-bold text-deep-teal flex items-center gap-2">
                        <Users className="w-5 h-5 text-desert-gold" />
                        {t('dashboard.login_activity_records', '团队活跃与登录分析 (Active Users & Logins)')}
                    </h2>
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold self-start sm:self-auto">
                        <button
                            onClick={() => setActivityTab('logins')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${activityTab === 'logins' ? 'bg-white shadow text-deep-teal font-black' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {t('dashboard.activity_logins', '登录流水记录')} ({filteredActivities.length})
                        </button>
                        <button
                            onClick={() => setActivityTab('never')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${activityTab === 'never' ? 'bg-white shadow text-red-600 font-black' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {t('dashboard.activity_never', '从未登录')} ({loginAnalysis.neverLoggedCount})
                        </button>
                        <button
                            onClick={() => setActivityTab('inactive')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${activityTab === 'inactive' ? 'bg-white shadow text-amber-600 font-black' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {t('dashboard.activity_inactive_7d', '7天以上未登录')} ({loginAnalysis.inactiveSevenDaysCount})
                        </button>
                    </div>
                </div>

                {activityTab === 'logins' && (
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="sticky top-0 bg-white/95 backdrop-blur-sm text-arabian-night/60 font-bold border-b border-gray-100 z-10 shadow-sm">
                                <tr>
                                    <th className="py-3 px-4 rounded-tl-xl bg-white/95 backdrop-blur-sm">CRM ID</th>
                                    <th className="py-3 px-4 bg-white/95 backdrop-blur-sm">{t('common.name', '姓名')}</th>
                                    <th className="py-3 px-4 bg-white/95 backdrop-blur-sm">Team</th>
                                    <th className="py-3 px-4 bg-white/95 backdrop-blur-sm">{t('dashboard.date', '日期')}</th>
                                    <th className="py-3 px-4 rounded-tr-xl bg-white/95 backdrop-blur-sm">{t('dashboard.last_login_time', '最后登录时间')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredActivities.slice(0, 100).map((act, i) => (
                                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3 px-4 font-semibold">{act.crmId || act.userId}</td>
                                        <td className="py-3 px-4">{act.name || act.crmId || '-'}</td>
                                        <td className="py-3 px-4">
                                            <span className="bg-gray-100 text-arabian-night/70 px-2 py-0.5 rounded text-xs font-semibold">
                                                {act.team || '-'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 font-bold text-deep-teal">{act.date}</td>
                                        <td className="py-3 px-4 text-arabian-night/70">
                                            {act.lastLoginAt ? (act.lastLoginAt.toDate ? act.lastLoginAt.toDate().toLocaleString() : new Date(act.lastLoginAt).toLocaleString()) : '-'}
                                        </td>
                                    </tr>
                                ))}
                                {filteredActivities.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-gray-400">
                                            {t('common.no_data', '暂无数据')}
                                        </td>
                                    </tr>
                                )}
                                {filteredActivities.length > 100 && (
                                    <tr>
                                        <td colSpan={5} className="py-4 text-center text-sm font-semibold text-desert-gold">
                                            {t('dashboard.showing_top_100', '仅显示最近 100 条记录')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activityTab === 'never' && renderOrgGroupedList(loginAnalysis.neverLogged, false)}

                {activityTab === 'inactive' && renderOrgGroupedList(loginAnalysis.inactiveSevenDays, true)}
            </div>

            {/* Render SD Level Rankings if user is Super Admin */}
            {isSuperAdmin && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div id="chart-sd-duration" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-deep-teal">{t('dashboard.sd_duration_ranking', 'SD架构总学习时长排行')}</h2>
                            <button onClick={() => handleDownload('chart-sd-duration', 'SD_Duration_Ranking')} className="export-ignore p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-desert-gold" title={t('dashboard.download_report', '导出报表')}>
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            {sdRankings.map((sdRank, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-6 text-center font-bold text-gray-400">{i + 1}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold">{sdRank.name}</span>
                                            <span className="text-desert-gold font-bold">{(sdRank.totalDuration / 3600).toFixed(1)} h</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-desert-gold h-2 rounded-full" style={{ width: `${Math.min((sdRank.totalDuration / Math.max(sdRankings[0]?.totalDuration || 1, 1)) * 100, 100)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {sdRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                        </div>
                    </div>
                    
                    <div id="chart-sd-avg" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-deep-teal">{t('dashboard.sd_avg_ranking', 'SD架构人均学习时长排行')}</h2>
                            <button onClick={() => handleDownload('chart-sd-avg', 'SD_Avg_Ranking')} className="export-ignore p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-desert-gold" title={t('dashboard.download_report', '导出报表')}>
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            {[...sdRankings].sort((a,b) => b.avgDuration - a.avgDuration).map((sdRank, i, arr) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-6 text-center font-bold text-gray-400">{i + 1}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold">{sdRank.name}</span>
                                            <span className="text-deep-teal font-bold">{(sdRank.avgDuration / 3600).toFixed(2)} h</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-deep-teal h-2 rounded-full" style={{ width: `${Math.min((sdRank.avgDuration / Math.max(arr[0]?.avgDuration || 1, 1)) * 100, 100)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                             {sdRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                        </div>
                    </div>

                    <div id="chart-sd-completion" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-deep-teal">{t('dashboard.sd_completion_ranking', 'SD架构平均任务完成率排行')}</h2>
                            <button onClick={() => handleDownload('chart-sd-completion', 'SD_Completion_Ranking')} className="export-ignore p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-desert-gold" title={t('dashboard.download_report', '导出报表')}>
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            {[...sdRankings].sort((a,b) => b.completionRate - a.completionRate).map((sdRank, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-6 text-center font-bold text-gray-400">{i + 1}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold">{sdRank.name}</span>
                                            <span className="text-green-600 font-bold">{sdRank.completionRate}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${sdRank.completionRate}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                             {sdRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* Render SM Level Rankings if user is SD or Super Admin */}
            {(profile?.role === 'sd' || isSuperAdmin) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div id="chart-sm-duration" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-deep-teal">{t('dashboard.sm_duration_ranking', '各大组总学习时长排行')}</h2>
                            <button onClick={() => handleDownload('chart-sm-duration', 'SM_Duration_Ranking')} className="export-ignore p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-desert-gold" title={t('dashboard.download_report', '导出报表')}>
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            {smRankings.map((smRank, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-6 text-center font-bold text-gray-400">{i + 1}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold">{smRank.name}</span>
                                            <span className="text-desert-gold font-bold">{(smRank.totalDuration / 3600).toFixed(1)} h</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-desert-gold h-2 rounded-full" style={{ width: `${Math.min((smRank.totalDuration / Math.max(smRankings[0]?.totalDuration || 1, 1)) * 100, 100)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {smRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                        </div>
                    </div>
                    
                    <div id="chart-sm-avg" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-deep-teal">{t('dashboard.sm_avg_ranking', '各大组人均学习时长排行')}</h2>
                            <button onClick={() => handleDownload('chart-sm-avg', 'SM_Avg_Ranking')} className="export-ignore p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-desert-gold" title={t('dashboard.download_report', '导出报表')}>
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            {[...smRankings].sort((a,b) => b.avgDuration - a.avgDuration).map((smRank, i, arr) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-6 text-center font-bold text-gray-400">{i + 1}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold">{smRank.name}</span>
                                            <span className="text-deep-teal font-bold">{(smRank.avgDuration / 3600).toFixed(2)} h</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-deep-teal h-2 rounded-full" style={{ width: `${Math.min((smRank.avgDuration / Math.max(arr[0]?.avgDuration || 1, 1)) * 100, 100)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                             {smRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                        </div>
                    </div>

                    <div id="chart-sm-completion" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-deep-teal">{t('dashboard.sm_completion_ranking', '各大组平均任务完成率排行')}</h2>
                            <button onClick={() => handleDownload('chart-sm-completion', 'SM_Completion_Ranking')} className="export-ignore p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-desert-gold" title={t('dashboard.download_report', '导出报表')}>
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            {[...smRankings].sort((a,b) => b.completionRate - a.completionRate).map((smRank, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-6 text-center font-bold text-gray-400">{i + 1}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold">{smRank.name}</span>
                                            <span className="text-green-600 font-bold">{smRank.completionRate}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${smRank.completionRate}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                             {smRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* Render Team Level Rankings if user is SM, SD, or Super Admin */}
            {(profile?.role === 'sm' || profile?.role === 'sd' || isSuperAdmin) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div id="chart-team-duration" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-deep-teal">{t('dashboard.team_duration_ranking', '各小组总学习时长排行')}</h2>
                            <button onClick={() => handleDownload('chart-team-duration', 'Team_Duration_Ranking')} className="export-ignore p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-desert-gold" title={t('dashboard.download_report', '导出报表')}>
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            {teamRankings.map((tRank, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-6 text-center font-bold text-gray-400">{i + 1}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold">{tRank.name}</span>
                                            <span className="text-desert-gold font-bold">{(tRank.totalDuration / 3600).toFixed(1)} h</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-desert-gold h-2 rounded-full" style={{ width: `${Math.min((tRank.totalDuration / Math.max(teamRankings[0]?.totalDuration || 1, 1)) * 100, 100)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {teamRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                        </div>
                    </div>
                    
                    <div id="chart-team-avg" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-deep-teal">{t('dashboard.team_avg_ranking', '各小组人均学习时长排行')}</h2>
                            <button onClick={() => handleDownload('chart-team-avg', 'Team_Avg_Ranking')} className="export-ignore p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-desert-gold" title={t('dashboard.download_report', '导出报表')}>
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            {[...teamRankings].sort((a,b) => b.avgDuration - a.avgDuration).map((tRank, i, arr) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-6 text-center font-bold text-gray-400">{i + 1}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold">{tRank.name}</span>
                                            <span className="text-deep-teal font-bold">{(tRank.avgDuration / 3600).toFixed(2)} h</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-deep-teal h-2 rounded-full" style={{ width: `${Math.min((tRank.avgDuration / Math.max(arr[0]?.avgDuration || 1, 1)) * 100, 100)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                             {teamRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                        </div>
                    </div>

                    <div id="chart-team-completion" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-deep-teal">{t('dashboard.team_completion_ranking', '各小组平均任务完成率排行')}</h2>
                            <button onClick={() => handleDownload('chart-team-completion', 'Team_Completion_Ranking')} className="export-ignore p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-desert-gold" title={t('dashboard.download_report', '导出报表')}>
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            {[...teamRankings].sort((a,b) => b.completionRate - a.completionRate).map((tRank, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-6 text-center font-bold text-gray-400">{i + 1}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold">{tRank.name}</span>
                                            <span className="text-green-600 font-bold">{tRank.completionRate}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${tRank.completionRate}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                             {teamRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* Individual Rankings (Visible to all leaders) */}
            <div id="chart-user-duration" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-deep-teal">{t('dashboard.user_duration_ranking', '个人学习时长排行榜')}</h2>
                    <button onClick={() => handleDownload('chart-user-duration', 'User_Ranking')} className="export-ignore p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-desert-gold" title={t('dashboard.download_report', '导出报表')}>
                        <Download className="w-4 h-4" />
                    </button>
                </div>
                <div className="max-h-[600px] overflow-y-auto overflow-x-auto pr-2">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-arabian-night/70 font-bold">
                            <tr>
                                <th className="p-3 rounded-tl-lg">#</th>
                                <th className="p-3">CRM ID</th>
                                <th className="p-3">Team</th>
                                <th className="p-3 text-right">{t('dashboard.total_duration', '总时长')}</th>
                                <th className="p-3 text-right rounded-tr-lg">{t('dashboard.completion_rate', '任务完成率')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {userRankings.map((u, i) => (
                                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                    <td className="p-3 font-bold text-gray-400">{i + 1}</td>
                                    <td className="p-3 font-bold text-deep-teal">{u.crmId}</td>
                                    <td className="p-3 text-gray-500">{u.team || '-'}</td>
                                    <td className="p-3 text-right font-bold text-desert-gold">{(u.duration / 3600).toFixed(1)} h</td>
                                    <td className="p-3 text-right">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${u.completionRate >= 80 ? 'bg-green-100 text-green-700' : u.completionRate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                            {u.completionRate}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {userRankings.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400">No data available for this period</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SM & TL Individual Rankings Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 my-8 export-ignore">
                {/* Card 1: SM Individual Learning Ranking */}
                <div id="chart-sm-user-duration" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-deep-teal">{t('dashboard.sm_user_duration_ranking', 'SM 个人学习排行榜')}</h2>
                        <button onClick={() => handleDownload('chart-sm-user-duration', 'SM_User_Ranking')} className="export-ignore p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-desert-gold" title={t('dashboard.download_report', '导出报表')}>
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto overflow-x-auto pr-2">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-arabian-night/70 font-bold sticky top-0 bg-white z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 rounded-tl-lg">#</th>
                                    <th className="p-3">CRM ID</th>
                                    <th className="p-3">SD (大区)</th>
                                    <th className="p-3 text-right">{t('dashboard.total_duration', '总时长')}</th>
                                    <th className="p-3 text-right rounded-tr-lg">{t('dashboard.completion_rate', '任务完成率')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {smUserRankings.map((u, i) => (
                                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="p-3 font-bold text-gray-400">{i + 1}</td>
                                        <td className="p-3 font-bold text-deep-teal">{u.crmId}</td>
                                        <td className="p-3 text-gray-500">{u.sd || '-'}</td>
                                        <td className="p-3 text-right font-bold text-desert-gold">{(u.duration / 3600).toFixed(1)} h</td>
                                        <td className="p-3 text-right">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${u.completionRate >= 80 ? 'bg-green-100 text-green-700' : u.completionRate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                {u.completionRate}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {smUserRankings.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-400">No data available for this period</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Card 2: TL Individual Learning Ranking */}
                <div id="chart-tl-user-duration" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-deep-teal">{t('dashboard.tl_user_duration_ranking', 'TL 个人学习排行榜')}</h2>
                        <button onClick={() => handleDownload('chart-tl-user-duration', 'TL_User_Ranking')} className="export-ignore p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-desert-gold" title={t('dashboard.download_report', '导出报表')}>
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto overflow-x-auto pr-2">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-arabian-night/70 font-bold sticky top-0 bg-white z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 rounded-tl-lg">#</th>
                                    <th className="p-3">CRM ID</th>
                                    <th className="p-3">Team</th>
                                    <th className="p-3 text-right">{t('dashboard.total_duration', '总时长')}</th>
                                    <th className="p-3 text-right rounded-tr-lg">{t('dashboard.completion_rate', '任务完成率')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tlUserRankings.map((u, i) => (
                                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="p-3 font-bold text-gray-400">{i + 1}</td>
                                        <td className="p-3 font-bold text-deep-teal">{u.crmId}</td>
                                        <td className="p-3 text-gray-500">{u.team || '-'}</td>
                                        <td className="p-3 text-right font-bold text-desert-gold">{(u.duration / 3600).toFixed(1)} h</td>
                                        <td className="p-3 text-right">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${u.completionRate >= 80 ? 'bg-green-100 text-green-700' : u.completionRate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                {u.completionRate}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {tlUserRankings.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-400">No data available for this period</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Task Publishing Rankings Section */}
            <div className="pt-6 border-t border-gray-100">
                <h2 className="text-2xl font-bold text-deep-teal mb-6 flex items-center gap-2">
                    <span className="bg-desert-gold p-1.5 rounded-lg text-white">📋</span>
                    {t('dashboard.task_publishing_rankings', '任务发布排行榜')}
                </h2>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
                    {/* Total Published Column */}
                    <div>
                        <h3 className="text-lg font-bold text-arabian-night mb-4">{t('dashboard.total_published', '总发布任务量排行')}</h3>
                        <div className="grid grid-cols-1 gap-6">
                            {/* SD Total Published */}
                            {isSuperAdmin && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                                    <h3 className="text-base font-bold text-deep-teal mb-4">{t('dashboard.sd_published', '大区任务发布榜')}</h3>
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                        {[...sdRankings].sort((a,b) => b.totalPublished - a.totalPublished).map((rank, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-semibold">{rank.name}</span>
                                                        <span className="text-deep-teal font-bold">{rank.totalPublished}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                        <div className="bg-deep-teal h-1.5 rounded-full" style={{ width: `${Math.min((rank.totalPublished / Math.max(Math.max(...sdRankings.map(r=>r.totalPublished)) || 1, 1)) * 100, 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {sdRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                                    </div>
                                </div>
                            )}

                            {/* SM Total Published */}
                            {(isSuperAdmin || profile?.role === 'sd') && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                                    <h3 className="text-base font-bold text-deep-teal mb-4">{t('dashboard.sm_published', '大组任务发布榜')}</h3>
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                        {[...smRankings].sort((a,b) => b.totalPublished - a.totalPublished).map((rank, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-semibold">{rank.name}</span>
                                                        <span className="text-blue-600 font-bold">{rank.totalPublished}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min((rank.totalPublished / Math.max(Math.max(...smRankings.map(r=>r.totalPublished)) || 1, 1)) * 100, 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {smRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                                    </div>
                                </div>
                            )}

                            {/* Team Total Published */}
                            {(isSuperAdmin || profile?.role === 'sd' || profile?.role === 'sm') && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                                    <h3 className="text-base font-bold text-deep-teal mb-4">{t('dashboard.team_published', '小组任务发布榜')}</h3>
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                        {[...teamRankings].sort((a,b) => b.totalPublished - a.totalPublished).map((rank, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-semibold">{rank.name}</span>
                                                        <span className="text-orange-500 font-bold">{rank.totalPublished}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                        <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${Math.min((rank.totalPublished / Math.max(Math.max(...teamRankings.map(r=>r.totalPublished)) || 1, 1)) * 100, 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {teamRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Avg Published Column */}
                    <div>
                        <h3 className="text-lg font-bold text-arabian-night mb-4">{t('dashboard.avg_published', '人均发布任务量排行')}</h3>
                        <div className="grid grid-cols-1 gap-6">
                            {/* SD Avg Published */}
                            {isSuperAdmin && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                                    <h3 className="text-base font-bold text-deep-teal mb-4">{t('dashboard.sd_avg_published', '大区人均发布榜')}</h3>
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                        {[...sdRankings].sort((a,b) => b.avgPublished - a.avgPublished).map((rank, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-semibold">{rank.name}</span>
                                                        <span className="text-deep-teal font-bold">{rank.avgPublished.toFixed(2)}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                        <div className="bg-deep-teal h-1.5 rounded-full" style={{ width: `${Math.min((rank.avgPublished / Math.max(Math.max(...sdRankings.map(r=>r.avgPublished)) || 1, 1)) * 100, 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {sdRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                                    </div>
                                </div>
                            )}

                            {/* SM Avg Published */}
                            {(isSuperAdmin || profile?.role === 'sd') && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                                    <h3 className="text-base font-bold text-deep-teal mb-4">{t('dashboard.sm_avg_published', '大组人均发布榜')}</h3>
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                        {[...smRankings].sort((a,b) => b.avgPublished - a.avgPublished).map((rank, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-semibold">{rank.name}</span>
                                                        <span className="text-blue-600 font-bold">{rank.avgPublished.toFixed(2)}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min((rank.avgPublished / Math.max(Math.max(...smRankings.map(r=>r.avgPublished)) || 1, 1)) * 100, 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {smRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                                    </div>
                                </div>
                            )}

                            {/* Team Avg Published */}
                            {(isSuperAdmin || profile?.role === 'sd' || profile?.role === 'sm') && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                                    <h3 className="text-base font-bold text-deep-teal mb-4">{t('dashboard.team_avg_published', '小组人均发布榜')}</h3>
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                        {[...teamRankings].sort((a,b) => b.avgPublished - a.avgPublished).map((rank, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-semibold">{rank.name}</span>
                                                        <span className="text-orange-500 font-bold">{rank.avgPublished.toFixed(2)}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                        <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${Math.min((rank.avgPublished / Math.max(Math.max(...teamRankings.map(r=>r.avgPublished)) || 1, 1)) * 100, 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {teamRankings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recording Contribution Rankings Section */}
            <div className="pt-6 border-t border-gray-100">
                <h2 className="text-2xl font-bold text-deep-teal mb-6 flex items-center gap-2">
                    <span className="bg-desert-gold p-1.5 rounded-lg text-white">🎤</span>
                    {t('dashboard.contribution_rankings', '录音贡献排行榜')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* SD Contribution */}
                    {isSuperAdmin && (
                        <div id="chart-sd-contribution" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-base font-bold text-deep-teal">{t('dashboard.sd_contribution', '大区贡献榜')}</h3>
                                <button onClick={() => handleDownload('chart-sd-contribution', 'SD_Contribution')} className="export-ignore p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-desert-gold">
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                {contributionRankings.sd.map((rank, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-semibold">{rank.name}</span>
                                                <span className="text-purple-600 font-bold">{rank.count}</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min((rank.count / Math.max(contributionRankings.sd[0]?.count || 1, 1)) * 100, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {contributionRankings.sd.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                            </div>
                        </div>
                    )}

                    {/* SM Contribution */}
                    {(isSuperAdmin || profile?.role === 'sd') && (
                        <div id="chart-sm-contribution" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-base font-bold text-deep-teal">{t('dashboard.sm_contribution', '大组贡献榜')}</h3>
                                <button onClick={() => handleDownload('chart-sm-contribution', 'SM_Contribution')} className="export-ignore p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-desert-gold">
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                {contributionRankings.sm.map((rank, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-semibold">{rank.name}</span>
                                                <span className="text-blue-600 font-bold">{rank.count}</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min((rank.count / Math.max(contributionRankings.sm[0]?.count || 1, 1)) * 100, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {contributionRankings.sm.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                            </div>
                        </div>
                    )}

                    {/* Team Contribution */}
                    {(isSuperAdmin || profile?.role === 'sd' || profile?.role === 'sm') && (
                        <div id="chart-team-contribution" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-base font-bold text-deep-teal">{t('dashboard.team_contribution', '小组贡献榜')}</h3>
                                <button onClick={() => handleDownload('chart-team-contribution', 'Team_Contribution')} className="export-ignore p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-desert-gold">
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                {contributionRankings.team.map((rank, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-semibold">{rank.name}</span>
                                                <span className="text-orange-500 font-bold">{rank.count}</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${Math.min((rank.count / Math.max(contributionRankings.team[0]?.count || 1, 1)) * 100, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {contributionRankings.team.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                            </div>
                        </div>
                    )}

                    {/* Individual Contribution */}
                    <div id="chart-cc-contribution" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-base font-bold text-deep-teal">{t('dashboard.cc_contribution', '个人贡献榜')}</h3>
                            <button onClick={() => handleDownload('chart-cc-contribution', 'CC_Contribution')} className="export-ignore p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-desert-gold">
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {contributionRankings.cc.map((rank, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold">{rank.name}</span>
                                            <span className="text-desert-gold font-bold">{rank.count}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                                            <div className="bg-desert-gold h-1.5 rounded-full" style={{ width: `${Math.min((rank.count / Math.max(contributionRankings.cc[0]?.count || 1, 1)) * 100, 100)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {contributionRankings.cc.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
