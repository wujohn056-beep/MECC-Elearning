import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth, UserProfile } from '../../contexts/AuthContext';
import { Download, Calendar, Users, Clock, CheckCircle, BarChart3, Filter } from 'lucide-react';
import html2canvas from 'html2canvas';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

interface UserRecord {
    id: string;
    crmId: string;
    role: string;
    team: string;
    sd: string;
    sm: string;
    tl: string;
}

interface LearningLog {
    userId: string;
    durationSeconds: number;
    listenedAt: any; // Firestore Timestamp
}

interface LearningTask {
    id: string;
    createdAt: any; // Firestore Timestamp
    assigneeIds: string[];
    assignees: Record<string, { status: string }>;
}

type DateFilter = 'today' | 'this_week' | 'this_month' | 'all';

export default function AdminDashboard() {
    const { t } = useTranslation();
    const { profile, isSuperAdmin } = useAuth();
    const dashboardRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState<DateFilter>('this_month');
    
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [logs, setLogs] = useState<LearningLog[]>([]);
    const [tasks, setTasks] = useState<LearningTask[]>([]);

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
                    tasksData.push({ id: doc.id, createdAt: data.createdAt, assigneeIds: data.assigneeIds || [], assignees: data.assignees || {} });
                }
            });
            setTasks(tasksData);
        } catch (error) {
            console.error("Error fetching dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    // 1. Filter Users by Scope
    const scopeUsers = useMemo(() => {
        if (!profile) return [];
        if (isSuperAdmin) return users;
        return users.filter(u => {
            if (profile.role === 'sd') return u.sd === profile.crmId || u.id === profile.crmId;
            if (profile.role === 'sm') return u.sm === profile.crmId || u.id === profile.crmId;
            if (profile.role === 'tl') return u.team === profile.team || u.id === profile.crmId;
            return false;
        });
    }, [users, profile, isSuperAdmin]);

    const scopeUserIds = useMemo(() => new Set(scopeUsers.map(u => u.id)), [scopeUsers]);

    // 2. Filter Dates
    const { startDate, endDate } = useMemo(() => {
        const now = new Date();
        switch (dateFilter) {
            case 'today': return { startDate: startOfDay(now), endDate: endOfDay(now) };
            case 'this_week': return { startDate: startOfWeek(now, {weekStartsOn: 1}), endDate: endOfWeek(now, {weekStartsOn: 1}) };
            case 'this_month': return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
            case 'all': default: return { startDate: new Date(0), endDate: new Date(3000, 0, 1) };
        }
    }, [dateFilter]);

    // 3. Filter Logs & Tasks by Date
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            if (!log.listenedAt) return false;
            const d = log.listenedAt.toDate();
            return isWithinInterval(d, { start: startDate, end: endDate }) && scopeUserIds.has(log.userId);
        });
    }, [logs, startDate, endDate, scopeUserIds]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            if (!task.createdAt) return false;
            const d = task.createdAt.toDate();
            return isWithinInterval(d, { start: startDate, end: endDate });
        });
    }, [tasks, startDate, endDate]);

    // 4. Aggregations
    const userStats = useMemo(() => {
        const stats: Record<string, { duration: number; tasksAssigned: number; tasksCompleted: number }> = {};
        scopeUsers.forEach(u => stats[u.id] = { duration: 0, tasksAssigned: 0, tasksCompleted: 0 });

        filteredLogs.forEach(log => {
            if (stats[log.userId]) {
                stats[log.userId].duration += log.durationSeconds;
            }
        });

        filteredTasks.forEach(task => {
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
    }, [scopeUsers, filteredLogs, filteredTasks]);

    // Top Level Metrics
    const totalDurationSeconds = Object.values(userStats).reduce((acc, curr) => acc + curr.duration, 0);
    const totalDurationHours = (totalDurationSeconds / 3600).toFixed(1);
    const avgDurationHours = scopeUsers.length > 0 ? (totalDurationSeconds / 3600 / scopeUsers.length).toFixed(1) : '0';
    
    let totalAssigned = 0;
    let totalCompleted = 0;
    Object.values(userStats).forEach(s => {
        totalAssigned += s.tasksAssigned;
        totalCompleted += s.tasksCompleted;
    });
    const avgCompletionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

    // Rankings
    const userRankings = useMemo(() => {
        return [...scopeUsers].map(u => ({
            ...u,
            duration: userStats[u.id].duration,
            completionRate: userStats[u.id].tasksAssigned > 0 
                ? Math.round((userStats[u.id].tasksCompleted / userStats[u.id].tasksAssigned) * 100) 
                : 0
        })).sort((a, b) => b.duration - a.duration);
    }, [scopeUsers, userStats]);

    // Group Aggregations (Team, SM, SD)
    const aggregateByField = (field: 'team' | 'sm' | 'sd') => {
        const groups: Record<string, { count: number; duration: number; assigned: number; completed: number }> = {};
        userRankings.forEach(u => {
            const key = u[field] || 'Unknown';
            if (!groups[key]) groups[key] = { count: 0, duration: 0, assigned: 0, completed: 0 };
            groups[key].count += 1;
            groups[key].duration += u.duration;
            groups[key].assigned += userStats[u.id].tasksAssigned;
            groups[key].completed += userStats[u.id].tasksCompleted;
        });

        return Object.entries(groups).map(([name, data]) => ({
            name,
            totalDuration: data.duration,
            avgDuration: data.count > 0 ? data.duration / data.count : 0,
            completionRate: data.assigned > 0 ? Math.round((data.completed / data.assigned) * 100) : 0,
            userCount: data.count
        }));
    };

    const teamRankings = useMemo(() => aggregateByField('team').sort((a,b) => b.totalDuration - a.totalDuration), [userRankings]);
    const smRankings = useMemo(() => aggregateByField('sm').sort((a,b) => b.totalDuration - a.totalDuration), [userRankings]);
    const sdRankings = useMemo(() => aggregateByField('sd').sort((a,b) => b.totalDuration - a.totalDuration), [userRankings]);

    const handleDownload = async () => {
        if (!dashboardRef.current) return;
        try {
            const canvas = await html2canvas(dashboardRef.current, { scale: 2, useCORS: true });
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            link.download = `Dashboard_Report_${dateFilter}_${new Date().getTime()}.png`;
            link.click();
        } catch (err) {
            console.error("Export failed", err);
            alert(t('dashboard.export_failed', '导出失败，请重试。'));
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-deep-teal"></div></div>;
    }

    return (
        <div className="animate-in fade-in duration-500 space-y-8 pb-10" ref={dashboardRef}>
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white/40 p-6 rounded-2xl border border-white/50 shadow-sm" data-html2canvas-ignore>
                <div>
                    <h1 className="text-3xl font-bold text-deep-teal mb-2 flex items-center gap-2">
                        <BarChart3 className="w-8 h-8 text-desert-gold" />
                        {t('dashboard.title', '仪表盘总览')}
                    </h1>
                    <p className="text-arabian-night/60">{t('dashboard.desc', '查看各级架构学习时长与任务完成情况')}</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <select 
                            value={dateFilter} 
                            onChange={e => setDateFilter(e.target.value as DateFilter)}
                            className="bg-transparent text-sm font-bold text-deep-teal focus:outline-none"
                        >
                            <option value="today">{t('dashboard.today', '今天')}</option>
                            <option value="this_week">{t('dashboard.this_week', '本周')}</option>
                            <option value="this_month">{t('dashboard.this_month', '本月')}</option>
                            <option value="all">{t('dashboard.all_time', '全部时间')}</option>
                        </select>
                    </div>
                    <button 
                        onClick={handleDownload}
                        className="flex items-center gap-2 bg-desert-gold text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-yellow-600 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        {t('dashboard.download_report', '导出报表')}
                    </button>
                </div>
            </div>

            {/* Top Level Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><Users className="w-24 h-24" /></div>
                    <p className="text-sm font-semibold text-arabian-night/50 mb-1">{t('dashboard.total_users', '范围内总人数')}</p>
                    <p className="text-3xl font-bold text-deep-teal">{scopeUsers.length}</p>
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

            {/* Render Team Level Rankings if user is SM, SD, or Super Admin */}
            {(profile?.role === 'sm' || profile?.role === 'sd' || isSuperAdmin) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h2 className="text-lg font-bold text-deep-teal mb-4">{t('dashboard.team_duration_ranking', '各团队总学习时长排行')}</h2>
                        <div className="space-y-4">
                            {teamRankings.slice(0, 10).map((tRank, i) => (
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
                    
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h2 className="text-lg font-bold text-deep-teal mb-4">{t('dashboard.team_avg_ranking', '各团队人均学习时长排行')}</h2>
                        <div className="space-y-4">
                            {teamRankings.sort((a,b) => b.avgDuration - a.avgDuration).slice(0, 10).map((tRank, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-6 text-center font-bold text-gray-400">{i + 1}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold">{tRank.name}</span>
                                            <span className="text-deep-teal font-bold">{(tRank.avgDuration / 3600).toFixed(1)} h</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-deep-teal h-2 rounded-full" style={{ width: `${Math.min((tRank.avgDuration / Math.max(teamRankings[0]?.avgDuration || 1, 1)) * 100, 100)}%` }}></div>
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-lg font-bold text-deep-teal mb-4">{t('dashboard.user_duration_ranking', '个人学习时长排行榜 (Top 50)')}</h2>
                <div className="overflow-x-auto">
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
                            {userRankings.slice(0, 50).map((u, i) => (
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

            {/* SD Level Rankings for Super Admin */}
            {isSuperAdmin && (
                 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                 <h2 className="text-lg font-bold text-deep-teal mb-4">{t('dashboard.sd_duration_ranking', 'SD架构学习时长排行')}</h2>
                 <div className="space-y-4">
                     {sdRankings.slice(0, 10).map((tRank, i) => (
                         <div key={i} className="flex items-center gap-3">
                             <div className="w-6 text-center font-bold text-gray-400">{i + 1}</div>
                             <div className="flex-1">
                                 <div className="flex justify-between text-sm mb-1">
                                     <span className="font-semibold text-deep-teal">SD: {tRank.name}</span>
                                     <span className="text-desert-gold font-bold">{(tRank.totalDuration / 3600).toFixed(1)} h</span>
                                 </div>
                                 <div className="w-full bg-gray-100 rounded-full h-2">
                                     <div className="bg-gradient-to-r from-desert-gold to-yellow-500 h-2 rounded-full" style={{ width: `${Math.min((tRank.totalDuration / Math.max(sdRankings[0]?.totalDuration || 1, 1)) * 100, 100)}%` }}></div>
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
            )}
        </div>
    );
}
