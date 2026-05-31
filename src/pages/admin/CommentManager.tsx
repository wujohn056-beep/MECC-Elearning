import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, doc, updateDoc, getDocs, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
    MessageSquare, ThumbsUp, Flag, Pin, Check, Trash2, 
    AlertTriangle, Search, BookOpen, Clock, Crown, ShieldAlert,
    Filter, RefreshCw, ChevronRight, User
} from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface CommentRecord {
    id: string;
    audioId: string;
    userId: string;
    userName: string;
    userAvatar: string;
    userRole: string;
    userTeam: string;
    content: string;
    createdAt: any; // Firestore Timestamp
    likes: string[];
    parentId: string | null;
    status: 'approved' | 'flagged' | 'deleted';
    isPinned: boolean;
}

interface RecordingRecord {
    id: string;
    title?: string;
    lecturerName?: string;
}

export default function CommentManager() {
    const { t } = useTranslation();
    const { profile, hasPermission } = useAuth();
    
    // Redirect unauthorized users
    if (!hasPermission('manageComments')) {
        return <Navigate to="/admin" replace />;
    }
    
    const canModerate = true;

    const [comments, setComments] = useState<CommentRecord[]>([]);
    const [recordings, setRecordings] = useState<Record<string, RecordingRecord>>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'flagged' | 'pinned'>('flagged');
    const [loadingRecordings, setLoadingRecordings] = useState(true);

    // 1. Fetch all recordings for contextual mapping
    useEffect(() => {
        const fetchRecordings = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'recordings'));
                const recMap: Record<string, RecordingRecord> = {};
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    recMap[doc.id] = {
                        id: doc.id,
                        title: data.title,
                        lecturerName: data.lecturerName
                    };
                });
                setRecordings(recMap);
            } catch (error) {
                console.error("Error fetching recordings mapping:", error);
            } finally {
                setLoadingRecordings(false);
            }
        };

        if (canModerate) {
            fetchRecordings();
        }
    }, [canModerate]);

    // 2. Real-time comments listener
    useEffect(() => {
        if (!canModerate) return;

        // Fetch all comments in real-time
        const q = collection(db, 'comments');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: CommentRecord[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                // We keep flagged and approved, and filter out 'deleted' status
                if (data.status !== 'deleted') {
                    list.push({ id: doc.id, ...data } as CommentRecord);
                }
            });

            // Sort descending by creation date
            list.sort((a, b) => {
                const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
                const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
                return timeB - timeA;
            });

            setComments(list);
            setLoading(false);
        }, (error) => {
            console.error("Error subscribing to comments:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [canModerate]);

    // 3. Quick Actions
    const handleApprove = async (commentId: string) => {
        try {
            const commentRef = doc(db, 'comments', commentId);
            await updateDoc(commentRef, {
                status: 'approved'
            });
        } catch (error: any) {
            console.error("Error approving comment:", error);
            alert(t('common.save_fail', '操作失败：') + error.message);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (window.confirm(t('comment_manager.confirm_delete', '确认下架并永久删除此条互动内容？下架后该内容将无法恢复且对所有用户不可见。'))) {
            try {
                const commentRef = doc(db, 'comments', commentId);
                await updateDoc(commentRef, {
                    status: 'deleted'
                });
            } catch (error: any) {
                console.error("Error deleting comment:", error);
                alert(t('common.save_fail', '操作失败：') + error.message);
            }
        }
    };

    const handleTogglePin = async (commentId: string, currentPinned: boolean) => {
        try {
            const commentRef = doc(db, 'comments', commentId);
            await updateDoc(commentRef, {
                isPinned: !currentPinned
            });
        } catch (error: any) {
            console.error("Error toggling pin status:", error);
            alert(t('common.save_fail', '操作失败：') + error.message);
        }
    };

    // 4. Data Filter & Search
    const filteredComments = useMemo(() => {
        return comments.filter((c) => {
            // Apply active tab filter
            if (activeTab === 'flagged' && c.status !== 'flagged') return false;
            if (activeTab === 'pinned' && !c.isPinned) return false;

            // Apply search query filter
            if (searchQuery.trim()) {
                const queryLower = searchQuery.toLowerCase().trim();
                const matchesUser = c.userName?.toLowerCase().includes(queryLower) || c.userTeam?.toLowerCase().includes(queryLower);
                const matchesContent = c.content?.toLowerCase().includes(queryLower);
                
                // Check if audioId is mapped to recording details that match
                const recording = recordings[c.audioId];
                const matchesRecording = recording 
                    ? recording.title?.toLowerCase().includes(queryLower) || recording.lecturerName?.toLowerCase().includes(queryLower)
                    : false;

                return matchesUser || matchesContent || matchesRecording;
            }

            return true;
        });
    }, [comments, activeTab, searchQuery, recordings]);

    // Build comment map for parent content resolution
    const commentsMap = useMemo(() => {
        const map: Record<string, CommentRecord> = {};
        comments.forEach(c => {
            map[c.id] = c;
        });
        return map;
    }, [comments]);

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'super_admin':
                return 'bg-red-500/10 text-red-600 border border-red-500/20';
            case 'sd':
                return 'bg-gradient-to-r from-desert-gold/15 to-amber-500/10 text-amber-700 border border-desert-gold/30';
            case 'sm':
                return 'bg-blue-500/10 text-blue-600 border border-blue-500/20';
            case 'tl':
                return 'bg-purple-500/10 text-purple-600 border border-purple-500/20';
            default:
                return 'bg-teal-500/10 text-teal-600 border border-teal-500/20';
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'super_admin':
                return 'Super Admin';
            case 'sd':
                return 'SD';
            case 'sm':
                return 'SM';
            case 'tl':
                return 'TL';
            default:
                return t('common.user_role', '销售顾问');
        }
    };

    if (loading || loadingRecordings) {
        return (
            <div className="flex flex-col justify-center items-center h-64 gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-deep-teal"></div>
                <p className="text-sm font-semibold text-arabian-night/60">{t('common.loading', '正在加载互动内容...')}</p>
            </div>
        );
    }

    // Counts for tab metrics
    const flaggedCount = comments.filter(c => c.status === 'flagged').length;
    const pinnedCount = comments.filter(c => c.isPinned).length;
    const allCount = comments.length;

    return (
        <div className="animate-in fade-in duration-500 space-y-6 pb-10">
            {/* Header Title */}
            <div>
                <h1 className="text-3xl font-bold text-deep-teal flex items-center gap-2">
                    <MessageSquare className="w-8 h-8 text-desert-gold" />
                    {t('comment_manager.title', '互动内容审核')}
                </h1>
                <p className="text-arabian-night/60 mt-1">
                    {t('comment_manager.desc', '审核销售学堂各素材下的评论互动，确保合规运营与专业正向学习环境')}
                </p>
            </div>

            {/* Top Control Panel */}
            <div className="glass-panel rounded-2xl p-6 border border-desert-gold/10 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Tab Navigation */}
                    <div className="flex gap-2 bg-white/40 p-1.5 rounded-xl border border-white/50 backdrop-blur-md w-fit">
                        <button
                            onClick={() => setActiveTab('flagged')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-300 flex items-center gap-2 ${
                                activeTab === 'flagged'
                                    ? 'bg-deep-teal text-white shadow-md'
                                    : 'text-arabian-night/70 hover:bg-white/40'
                            }`}
                        >
                            <ShieldAlert className={`w-4 h-4 ${activeTab === 'flagged' ? 'text-white' : 'text-amber-500'}`} />
                            {t('comment_manager.tab_flagged', '被举报审核')}
                            {flaggedCount > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse ${
                                    activeTab === 'flagged' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                                }`}>
                                    {flaggedCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-300 flex items-center gap-2 ${
                                activeTab === 'all'
                                    ? 'bg-deep-teal text-white shadow-md'
                                    : 'text-arabian-night/70 hover:bg-white/40'
                            }`}
                        >
                            <Filter className="w-4 h-4 text-deep-teal/70" />
                            {t('comment_manager.tab_all', '全部活跃互动')}
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full font-bold border border-gray-200">
                                {allCount}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('pinned')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-300 flex items-center gap-2 ${
                                activeTab === 'pinned'
                                    ? 'bg-deep-teal text-white shadow-md'
                                    : 'text-arabian-night/70 hover:bg-white/40'
                            }`}
                        >
                            <Crown className={`w-4 h-4 ${activeTab === 'pinned' ? 'text-white' : 'text-desert-gold'}`} />
                            {t('comment_manager.tab_pinned', '置顶精选')}
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full font-bold border border-gray-200">
                                {pinnedCount}
                            </span>
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full md:w-80">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={t('comment_manager.search_placeholder', '搜索发言人、大组、内容、课程名...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-desert-gold focus:border-transparent outline-none bg-white/60 backdrop-blur-md shadow-inner transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* List & Table Panel */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-xl">
                <div className="space-y-4">
                    {filteredComments.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 bg-white/30 rounded-xl border border-dashed border-gray-200">
                            <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <p className="font-semibold text-sm">
                                {activeTab === 'flagged'
                                    ? t('comment_manager.no_flagged_comments', '好消息！当前没有任何被举报的互动内容。')
                                    : t('comment_manager.no_matching_comments', '未找到匹配的互动讨论记录。')}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredComments.map((comment) => {
                                const recording = recordings[comment.audioId];
                                const parentComment = comment.parentId ? commentsMap[comment.parentId] : null;

                                return (
                                    <div 
                                        key={comment.id} 
                                        className={`bg-white/80 p-5 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md relative overflow-hidden group ${
                                            comment.status === 'flagged' 
                                                ? 'border-red-200 bg-gradient-to-r from-white/95 to-red-50/10'
                                                : comment.isPinned 
                                                    ? 'border-desert-gold bg-gradient-to-r from-white/95 to-desert-gold/5'
                                                    : 'border-white/50'
                                        }`}
                                    >
                                        {/* Status Ribbons */}
                                        {comment.isPinned && (
                                            <div className="absolute top-0 right-0 bg-desert-gold text-white text-[9px] px-3 py-1 rounded-bl-xl font-bold flex items-center gap-1 shadow-sm uppercase tracking-wider">
                                                <Crown className="w-3 h-3" />
                                                {t('learning_hub.featured_crown', '置顶精选')}
                                            </div>
                                        )}
                                        {comment.status === 'flagged' && (
                                            <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] px-3 py-1 rounded-bl-xl font-bold flex items-center gap-1 shadow-sm uppercase tracking-wider animate-pulse">
                                                <ShieldAlert className="w-3 h-3" />
                                                {t('comment_manager.status_flagged', '待核举报')}
                                            </div>
                                        )}

                                        {/* User Identity Info */}
                                        <div className="flex items-start gap-4">
                                            {/* Avatar or Placeholder */}
                                            {comment.userAvatar ? (
                                                <img 
                                                    src={comment.userAvatar} 
                                                    alt={comment.userName} 
                                                    className="w-10 h-10 rounded-full border border-gray-100 object-cover shadow-sm bg-white"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = '';
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-deep-teal/10 text-deep-teal flex items-center justify-center font-bold text-sm shadow-inner border border-white">
                                                    {comment.userName ? comment.userName[0].toUpperCase() : 'U'}
                                                </div>
                                            )}

                                            <div className="flex-1 space-y-1">
                                                {/* Line 1: Name, Badges */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-bold text-arabian-night text-sm">{comment.userName}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm ${getRoleBadgeColor(comment.userRole)}`}>
                                                        {getRoleLabel(comment.userRole)}
                                                    </span>
                                                    {comment.userTeam && (
                                                        <span className="text-[10px] font-semibold text-deep-teal bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
                                                            {comment.userTeam}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-arabian-night/40 flex items-center gap-1 ml-auto">
                                                        <Clock className="w-3 h-3" />
                                                        {comment.createdAt ? comment.createdAt.toDate().toLocaleString() : '-'}
                                                    </span>
                                                </div>

                                                {/* Line 2: Context Material Indicator */}
                                                <div className="flex items-center gap-1 text-[11px] text-arabian-night/60 font-semibold mt-1">
                                                    <BookOpen className="w-3.5 h-3.5 text-desert-gold flex-shrink-0" />
                                                    <span>{t('comment_manager.source_material', '素材课程')}：</span>
                                                    <span className="text-deep-teal hover:underline max-w-[300px] truncate">
                                                        {recording ? `《${recording.title}》` : t('common.unknown_material', '未知音频素材')}
                                                    </span>
                                                    {recording?.lecturerName && (
                                                        <span className="text-gray-400">
                                                            ({t('learning_hub.lecturer', '讲师')}：{recording.lecturerName})
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Parent comment context if threaded reply */}
                                                {parentComment && (
                                                    <div className="mt-2 pl-3 border-l-2 border-gray-200 bg-gray-50/50 p-2 rounded-r-xl text-xs text-arabian-night/70 italic space-y-1">
                                                        <div className="font-semibold text-arabian-night/50 flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            <span>回复 @{parentComment.userName}</span>
                                                        </div>
                                                        <p className="truncate">"{parentComment.content}"</p>
                                                    </div>
                                                )}

                                                {/* Actual Comment Body */}
                                                <div className={`mt-3 p-3 rounded-xl text-sm font-medium border leading-relaxed ${
                                                    comment.status === 'flagged' 
                                                        ? 'bg-red-50/40 text-red-900 border-red-100'
                                                        : 'bg-white/60 text-arabian-night border-gray-100'
                                                }`}>
                                                    <p className="whitespace-pre-wrap">{comment.content}</p>
                                                </div>

                                                {/* Line 4: Stats & Admin Actions */}
                                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100/50">
                                                    {/* Likes Metric */}
                                                    <div className="flex items-center gap-1.5 text-xs text-arabian-night/40 font-semibold select-none">
                                                        <ThumbsUp className="w-3.5 h-3.5" />
                                                        <span>{comment.likes?.length || 0} {t('learning_hub.likes_count', '个赞')}</span>
                                                    </div>

                                                    {/* Moderation Controls */}
                                                    <div className="flex items-center gap-2">
                                                        {/* Action 1: Approve / Pass (Only for flagged comments) */}
                                                        {comment.status === 'flagged' && (
                                                            <button
                                                                onClick={() => handleApprove(comment.id)}
                                                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all hover:scale-105"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                                {t('comment_manager.action_approve', '安全通过')}
                                                            </button>
                                                        )}

                                                        {/* Action 2: Feature Pin (Toggle for primary comments) */}
                                                        {comment.parentId === null && (
                                                            <button
                                                                onClick={() => handleTogglePin(comment.id, comment.isPinned)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all hover:scale-105 ${
                                                                    comment.isPinned
                                                                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
                                                                        : 'bg-white hover:bg-gray-50 text-arabian-night/70 border border-gray-200'
                                                                }`}
                                                            >
                                                                <Pin className="w-3.5 h-3.5" />
                                                                {comment.isPinned 
                                                                    ? t('comment_manager.action_unpin', '取消置顶')
                                                                    : t('comment_manager.action_pin', '置顶精选')}
                                                            </button>
                                                        )}

                                                        {/* Action 3: Delete / Permanent Hide */}
                                                        <button
                                                            onClick={() => handleDelete(comment.id)}
                                                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm border border-red-500/20 hover:border-transparent transition-all hover:scale-105"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            {t('comment_manager.action_delete', '下架清除')}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
