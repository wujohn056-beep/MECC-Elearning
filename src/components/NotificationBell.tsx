import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Bell, Clock, AlertTriangle, CheckCircle, ChevronRight, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';

interface TaskNotification {
    id: string;
    title: string;
    assignerName: string;
    deadline: any;
    read: boolean;
    status: 'pending' | 'in_progress' | 'completed';
    isUrgent: boolean; // < 3 hours
    isCritical: boolean; // < 1 hour
    createdAt?: Date;
}

interface CommentNotification {
    id: string;
    recipientId: string;
    senderName: string;
    type: 'comment' | 'campaign';
    titleKey: string;
    content: string;
    recordingId?: string;
    campaignId?: string;
    read: boolean;
    createdAt: any;
}

interface UnifiedNotification {
    id: string;
    type: 'task' | 'comment' | 'campaign';
    title: string;
    description?: string;
    senderName: string;
    read: boolean;
    createdAt: Date;
    recordingId?: string; // for comment
    taskId?: string; // for task
    campaignId?: string; // for campaign
    isCritical?: boolean;
    isUrgent?: boolean;
    status?: string;
    deadline?: Date;
}

const isIncompleteTask = (task: { status?: string }) => task.status !== 'completed';

export default function NotificationBell() {
    const { t } = useTranslation();
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<TaskNotification[]>([]);
    const [comments, setComments] = useState<CommentNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [showAlert, setShowAlert] = useState<{message: string, isCritical: boolean} | null>(null);
    const [showGlobalModal, setShowGlobalModal] = useState(false);
    const [hasSeenGlobalModal, setHasSeenGlobalModal] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user) return;
        const myUid = profile?.realUid || user.uid;

        // 1. Listen to learning tasks
        const q1 = query(
            collection(db, 'learning_tasks'),
            where('assigneeIds', 'array-contains', myUid)
        );

        const unsubscribe1 = onSnapshot(q1, (snapshot) => {
            const now = new Date();
            const notifications: TaskNotification[] = [];
            let urgentTaskCount = 0;
            let criticalTaskCount = 0;

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const myStatus = data.assignees[myUid];
                if (!myStatus) return;

                const deadlineDate = data.deadline?.toDate();
                const hoursLeft = deadlineDate ? (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60) : 999;
                
                const isUrgent = myStatus.status === 'pending' && hoursLeft > 0 && hoursLeft <= 3;
                const isCritical = myStatus.status === 'pending' && hoursLeft > 0 && hoursLeft <= 1;

                if (isCritical) criticalTaskCount++;
                else if (isUrgent) urgentTaskCount++;

                notifications.push({
                    id: docSnap.id,
                    title: data.title,
                    assignerName: data.assignerName,
                    deadline: deadlineDate,
                    read: myStatus.read,
                    status: myStatus.status,
                    isUrgent,
                    isCritical,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date())
                });
            });

            setTasks(notifications);

            // Show client-side alert if there are critical/urgent tasks that are unread
            const hasUnreadCritical = notifications.some(n => n.isCritical && !n.read && n.status === 'pending');
            const hasUnreadUrgent = notifications.some(n => n.isUrgent && !n.read && n.status === 'pending');
            
            if (hasUnreadCritical) {
                setShowAlert({ message: t('notifications.critical_alert', { count: criticalTaskCount }), isCritical: true });
            } else if (hasUnreadUrgent) {
                setShowAlert({ message: t('notifications.urgent_alert', { count: urgentTaskCount }), isCritical: false });
            } else {
                setShowAlert(null);
            }
        });

        // 2. Listen to comment notifications
        const q2 = query(
            collection(db, 'user_notifications'),
            where('recipientId', '==', myUid)
        );

        const unsubscribe2 = onSnapshot(q2, (snapshot) => {
            const list: CommentNotification[] = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                list.push({
                    id: docSnap.id,
                    recipientId: data.recipientId,
                    senderName: data.senderName,
                    type: data.type,
                    titleKey: data.titleKey,
                    content: data.content,
                    recordingId: data.recordingId,
                    campaignId: data.campaignId,
                    read: data.read,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date())
                });
            });
            setComments(list);
        });

        return () => {
            unsubscribe1();
            unsubscribe2();
        };
    }, [user, profile, t]);

    // Handle outside click to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Memoize the combined list of notifications
    const unifiedNotifications = useMemo(() => {
        const unified: UnifiedNotification[] = [];
        
        tasks.forEach(t => {
            unified.push({
                id: t.id,
                type: 'task',
                title: t.title,
                senderName: t.assignerName,
                read: t.read,
                createdAt: t.createdAt || new Date(),
                taskId: t.id,
                isCritical: t.isCritical,
                isUrgent: t.isUrgent,
                status: t.status,
                deadline: t.deadline
            });
        });

        comments.forEach(c => {
            unified.push({
                id: c.id,
                type: c.type || 'comment',
                title: c.type === 'campaign'
                    ? t(c.titleKey || 'notifications.new_campaign_title', { commenter: c.senderName })
                    : t(c.titleKey || 'notifications.new_comment_title', { commenter: c.senderName }),
                description: c.content,
                senderName: c.senderName,
                read: c.read,
                createdAt: c.createdAt || new Date(),
                recordingId: c.recordingId,
                campaignId: c.campaignId
            });
        });

        // Sort: unread first, then by createdAt descending
        return unified.sort((a, b) => {
            if (a.read !== b.read) return a.read ? 1 : -1;
            return b.createdAt.getTime() - a.createdAt.getTime();
        });
    }, [tasks, comments, t]);

    const unreadTasksCount = tasks.filter(t => !t.read && isIncompleteTask(t)).length;
    const unreadCommentsCount = comments.filter(c => !c.read).length;
    
    const unreadCount = unreadTasksCount + unreadCommentsCount;
    const pendingCount = tasks.filter(isIncompleteTask).length + unreadCommentsCount;

    useEffect(() => {
        if (unreadTasksCount > 0 && !hasSeenGlobalModal) {
            setShowGlobalModal(true);
        }
    }, [unreadTasksCount, hasSeenGlobalModal]);

    const handleTaskClick = async (task: UnifiedNotification) => {
        setIsOpen(false);
        if (!task.read && user) {
            try {
                const myUid = profile?.realUid || user.uid;
                await updateDoc(doc(db, 'learning_tasks', task.id), {
                    [`assignees.${myUid}.read`]: true
                });
            } catch (error) {
                console.error("Error marking task as read", error);
            }
        }
        if (isIncompleteTask(task)) {
            navigate(`/hub?taskId=${task.id}`);
        }
    };

    const handleCommentClick = async (notif: UnifiedNotification) => {
        setIsOpen(false);
        if (!notif.read) {
            try {
                await updateDoc(doc(db, 'user_notifications', notif.id), {
                    read: true
                });
            } catch (error) {
                console.error("Error marking comment notification as read", error);
            }
        }
        if (notif.type === 'campaign' && notif.campaignId) {
            navigate(`/hub?campaignLearnId=${notif.campaignId}`);
        } else if (notif.recordingId) {
            navigate(`/hub?recordingId=${notif.recordingId}`);
        } else {
            navigate('/hub');
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="relative p-2 rounded-full hover:bg-black/5 transition-colors"
            >
                <Bell className="w-5 h-5 text-arabian-night/80" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1.5 rounded-full bg-gradient-to-r from-rose-500 to-red-600 text-white text-[9px] font-black border border-white shadow-[0_2px_8px_rgba(244,63,94,0.4)] animate-pulse select-none z-30">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="fixed md:absolute right-4 left-4 md:right-0 md:left-auto top-[calc(env(safe-area-inset-top,0px)+3.75rem)] md:top-auto mt-2 w-auto md:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-deep-teal text-white px-4 py-3 flex justify-between items-center">
                        <h3 className="font-bold">{t('notifications.title')}</h3>
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{t('notifications.pending_count', { count: pendingCount })}</span>
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto">
                        {unifiedNotifications.length === 0 ? (
                            <div className="p-8 text-center text-arabian-night/40">
                                <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">{t('notifications.no_new')}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {unifiedNotifications.map(item => {
                                    if (item.type === 'task') {
                                        return (
                                            <button 
                                                key={item.id}
                                                onClick={() => handleTaskClick(item)}
                                                className={`w-full text-left p-4 hover:bg-gray-50 transition-colors flex gap-3 ${!item.read && item.status === 'pending' ? 'bg-blue-50/30' : ''}`}
                                            >
                                                <div className="mt-0.5 shrink-0">
                                                    {item.status === 'completed' ? (
                                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                                    ) : item.isCritical ? (
                                                        <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                                                    ) : item.isUrgent ? (
                                                        <Clock className="w-5 h-5 text-orange-500" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full border-2 border-blue-400"></div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-bold truncate ${item.status === 'completed' ? 'text-gray-400 line-through' : 'text-arabian-night'}`}>
                                                        {item.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {t('notifications.from', { assigner: item.senderName })}
                                                    </p>
                                                    {item.status === 'pending' && item.deadline && (
                                                        <p className={`text-xs font-semibold mt-1 ${item.isCritical ? 'text-red-500' : item.isUrgent ? 'text-orange-500' : 'text-gray-400'}`}>
                                                            {t('account.due')} {item.deadline.toLocaleString()}
                                                        </p>
                                                    )}
                                                </div>
                                                {item.status === 'pending' && (
                                                    <ChevronRight className="w-4 h-4 text-gray-300 self-center shrink-0" />
                                                )}
                                            </button>
                                        );
                                    } else {
                                        return (
                                            <button 
                                                key={item.id}
                                                onClick={() => handleCommentClick(item)}
                                                className={`w-full text-left p-4 hover:bg-gray-50 transition-colors flex gap-3 ${!item.read ? 'bg-blue-50/30 font-bold' : ''}`}
                                            >
                                                <div className="mt-0.5 shrink-0">
                                                    <MessageSquare className={`w-5 h-5 ${!item.read ? 'text-desert-gold' : 'text-gray-400'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm ${!item.read ? 'font-extrabold text-arabian-night' : 'text-arabian-night/80 font-semibold'} truncate`}>
                                                        {item.title}
                                                    </p>
                                                    {item.description && (
                                                        <p className="text-xs text-arabian-night/60 italic truncate mt-1 pl-1.5 border-l-2 border-desert-gold/30">
                                                            {item.description}
                                                        </p>
                                                    )}
                                                    <p className="text-[10px] text-gray-400 mt-1">
                                                        {item.createdAt.toLocaleString()}
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-300 self-center shrink-0" />
                                            </button>
                                        );
                                    }
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Floating Alert for Urgent/Critical tasks using Portal */}
            {showAlert && createPortal(
                <div className={`fixed top-24 right-6 p-4 rounded-xl shadow-xl flex items-center gap-3 animate-bounce max-w-sm border-l-4 z-[9999] ${showAlert.isCritical ? 'bg-red-50 border-red-500 text-red-800' : 'bg-orange-50 border-orange-500 text-orange-800'}`}>
                    <AlertTriangle className={`w-6 h-6 shrink-0 ${showAlert.isCritical ? 'text-red-500' : 'text-orange-500'}`} />
                    <p className="text-sm font-bold">{showAlert.message}</p>
                    <button onClick={() => setShowAlert(null)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-700">✕</button>
                </div>,
                document.body
            )}

            {/* Global Task Alert Modal using Portal */}
            {showGlobalModal && unreadTasksCount > 0 && createPortal(
                <div 
                    onClick={() => {
                        setShowGlobalModal(false);
                        setHasSeenGlobalModal(true);
                    }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 cursor-pointer"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-90 duration-300 cursor-default"
                    >
                        <div className="bg-gradient-to-r from-desert-gold to-yellow-600 p-6 flex flex-col items-center text-white">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
                                <Bell className="w-8 h-8 text-white animate-bounce" />
                            </div>
                            <h2 className="text-2xl font-bold mb-1">{t('notifications.modal_title')}</h2>
                            <p className="text-white/80 text-sm">{t('notifications.modal_desc', { count: unreadTasksCount })}</p>
                        </div>
                        <div className="p-6">
                            <p className="text-arabian-night/80 text-center mb-6 font-medium">{t('notifications.modal_subdesc')}</p>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => {
                                        setShowGlobalModal(false);
                                        setHasSeenGlobalModal(true);
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-100 text-arabian-night font-bold rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
                                >
                                    {t('notifications.view_later')}
                                </button>
                                <button 
                                    onClick={() => {
                                        setShowGlobalModal(false);
                                        setHasSeenGlobalModal(true);
                                        const incompleteTasks = tasks.filter(isIncompleteTask);
                                        if (incompleteTasks.length > 0) {
                                            const item: UnifiedNotification = {
                                                id: incompleteTasks[0].id,
                                                type: 'task',
                                                title: incompleteTasks[0].title,
                                                senderName: incompleteTasks[0].assignerName,
                                                read: incompleteTasks[0].read,
                                                createdAt: incompleteTasks[0].createdAt || new Date(),
                                                status: incompleteTasks[0].status
                                            };
                                            handleTaskClick(item);
                                        } else {
                                            navigate('/account');
                                        }
                                    }}
                                    className="flex-1 px-4 py-3 bg-deep-teal text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-deep-teal/30 cursor-pointer"
                                >
                                    {t('notifications.view_now')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
