import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Bell, Clock, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';

interface TaskNotification {
    id: string;
    title: string;
    assignerName: string;
    deadline: any;
    read: boolean;
    status: 'pending' | 'completed';
    isUrgent: boolean; // < 3 hours
    isCritical: boolean; // < 1 hour
}

export default function NotificationBell() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<TaskNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [showAlert, setShowAlert] = useState<{message: string, isCritical: boolean} | null>(null);
    const [showGlobalModal, setShowGlobalModal] = useState(false);
    const [hasSeenGlobalModal, setHasSeenGlobalModal] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'learning_tasks'),
            where('assigneeIds', 'array-contains', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const now = new Date();
            const notifications: TaskNotification[] = [];
            let urgentTaskCount = 0;
            let criticalTaskCount = 0;

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const myStatus = data.assignees[user.uid];
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
                    isCritical
                });
            });

            // Sort: pending first, then unread, then by deadline
            notifications.sort((a, b) => {
                if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
                if (a.read !== b.read) return a.read ? 1 : -1;
                return (a.deadline?.getTime() || 0) - (b.deadline?.getTime() || 0);
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

        return () => unsubscribe();
    }, [user]);

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

    const unreadCount = tasks.filter(t => !t.read && t.status === 'pending').length;
    const pendingCount = tasks.filter(t => t.status === 'pending').length;

    useEffect(() => {
        if (unreadCount > 0 && !hasSeenGlobalModal) {
            setShowGlobalModal(true);
        }
    }, [unreadCount, hasSeenGlobalModal]);

    const handleTaskClick = async (task: TaskNotification) => {
        setIsOpen(false);
        if (!task.read && user) {
            try {
                await updateDoc(doc(db, 'learning_tasks', task.id), {
                    [`assignees.${user.uid}.read`]: true
                });
            } catch (error) {
                console.error("Error marking task as read", error);
            }
        }
        if (task.status === 'pending') {
            navigate(`/hub?taskId=${task.id}`);
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
                    <span className="absolute top-1 right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
                    </span>
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-deep-teal text-white px-4 py-3 flex justify-between items-center">
                        <h3 className="font-bold">{t('notifications.title')}</h3>
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{t('notifications.pending_count', { count: pendingCount })}</span>
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto">
                        {tasks.length === 0 ? (
                            <div className="p-8 text-center text-arabian-night/40">
                                <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">{t('notifications.no_new')}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {tasks.map(task => (
                                    <button 
                                        key={task.id}
                                        onClick={() => handleTaskClick(task)}
                                        className={`w-full text-left p-4 hover:bg-gray-50 transition-colors flex gap-3 ${!task.read && task.status === 'pending' ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <div className="mt-0.5 shrink-0">
                                            {task.status === 'completed' ? (
                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                            ) : task.isCritical ? (
                                                <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                                            ) : task.isUrgent ? (
                                                <Clock className="w-5 h-5 text-orange-500" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full border-2 border-blue-400"></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-bold truncate ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-arabian-night'}`}>
                                                {task.title}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {t('notifications.from', { assigner: task.assignerName })}
                                            </p>
                                            {task.status === 'pending' && task.deadline && (
                                                <p className={`text-xs font-semibold mt-1 ${task.isCritical ? 'text-red-500' : task.isUrgent ? 'text-orange-500' : 'text-gray-400'}`}>
                                                    {t('account.due')} {task.deadline.toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                        {task.status === 'pending' && (
                                            <ChevronRight className="w-4 h-4 text-gray-300 self-center shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Floating Alert for Urgent/Critical tasks using Portal to escape parent stacking context */}
            {showAlert && createPortal(
                <div className={`fixed top-24 right-6 p-4 rounded-xl shadow-xl flex items-center gap-3 animate-bounce max-w-sm border-l-4 z-[9999] ${showAlert.isCritical ? 'bg-red-50 border-red-500 text-red-800' : 'bg-orange-50 border-orange-500 text-orange-800'}`}>
                    <AlertTriangle className={`w-6 h-6 shrink-0 ${showAlert.isCritical ? 'text-red-500' : 'text-orange-500'}`} />
                    <p className="text-sm font-bold">{showAlert.message}</p>
                    <button onClick={() => setShowAlert(null)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-700">✕</button>
                </div>,
                document.body
            )}

            {/* Global Task Alert Modal */}
            {showGlobalModal && unreadCount > 0 && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-90 duration-300">
                        <div className="bg-gradient-to-r from-desert-gold to-yellow-600 p-6 flex flex-col items-center text-white">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
                                <Bell className="w-8 h-8 text-white animate-bounce" />
                            </div>
                            <h2 className="text-2xl font-bold mb-1">{t('notifications.modal_title')}</h2>
                            <p className="text-white/80 text-sm">{t('notifications.modal_desc', { count: unreadCount })}</p>
                        </div>
                        <div className="p-6">
                            <p className="text-arabian-night/80 text-center mb-6 font-medium">{t('notifications.modal_subdesc')}</p>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => {
                                        setShowGlobalModal(false);
                                        setHasSeenGlobalModal(true);
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-100 text-arabian-night font-bold rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    {t('notifications.view_later')}
                                </button>
                                <button 
                                    onClick={() => {
                                        setShowGlobalModal(false);
                                        setHasSeenGlobalModal(true);
                                        setIsOpen(true);
                                    }}
                                    className="flex-1 px-4 py-3 bg-deep-teal text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-deep-teal/30"
                                >
                                    {t('notifications.view_now')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
