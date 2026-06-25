import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { Award, Trophy, Users, Check, X, Plus, Trash2, Calendar, Search, BookOpen, Clock, LayoutTemplate, UserCheck, RefreshCw } from 'lucide-react';

interface Campaign {
    id: string;
    title: string;
    creatorId: string;
    creatorRole: 'TL' | 'SM' | 'SD' | 'super_admin';
    creatorName: string;
    teamIds: string[];
    userIds?: string[];
    startDate: any;
    endDate: any;
    conditions: {
        category?: string;
        requiredMinutes?: number;
        requiredTaskIds?: string[];
    };
    certConfig: {
        bannerTitle: string;
        bannerSubTitle: string;
        trainingName: string;
        durationText: string;
        achievementText: string;
        encouragementText: string;
        issuedBy: string;
    };
}

interface Category {
    id: string;
    name: string;
}

interface Recording {
    id: string;
    title: string;
    categoryId?: string;
}

interface SystemUser {
    id: string;
    crmId: string;
    name: string;
    role: string;
    team: string;
    email?: string;
    sd?: string;
    sm?: string;
    tl?: string;
}

// Localized translation helper for Campaign Manager
const localT = (key: string, defaultVal: string, i18n: any) => {
    const lang = i18n?.language || 'zh';
    const dict: Record<string, Record<string, string>> = {
        zh: {
            'campaign.manager_title': '专项挑战与荣誉证书管理',
            'campaign.manager_subtitle': '为您的团队或特定员工发布针对性的学习任务，并定制颁发专属荣誉证书。',
            'campaign.publish_btn': '发布专项挑战',
            'campaign.tab_active': '进行中',
            'campaign.tab_expired': '已截止',
            'campaign.loading': '加载中...',
            'campaign.empty_state': '🏜️ 暂无符合条件的专项挑战',
            'campaign.audience': '受众',
            'campaign.audience_individual': '个人',
            'campaign.people': '人',
            'campaign.deadline': '截止',
            'campaign.publisher': '发布者',
            'campaign.delete_btn': '删除挑战',
            'campaign.tracking_title': '挑战达标追踪',
            'campaign.tracking_placeholder_title': '👉 请从左侧列表选择一个专项挑战',
            'campaign.tracking_placeholder_desc': '可追踪团队内所有成员的学时达标状态。',
            'campaign.tracking_loading': '统计中...',
            'campaign.tracking_audience': '受众',
            'campaign.tracking_completed_count': '达标人数',
            'campaign.minutes_unit': '分钟',
            'campaign.courses_unit': '门课',
            'campaign.modal_title': '创建与定制发布专项学习挑战',
            'campaign.modal_subtitle': '配置挑战条件受众，并利用证书可视化看板预览定制的证书样式。',
            'campaign.modal_step1': '1. 基础信息配置',
            'campaign.form_title': '挑战标题 *',
            'campaign.form_title_placeholder': '如：First Call 专项通关挑战',
            'campaign.form_start_date': '开始日期',
            'campaign.form_end_date': '截止日期',
            'campaign.form_audience_label': '选择目标受众 (按团队与个人展示) *',
            'campaign.form_audience_placeholder': '输入名字/CRM/部门搜索员工',
            'campaign.modal_step2': '2. 达标通关规则',
            'campaign.rule_by_duration': '按特定分类学习时长',
            'campaign.rule_by_courses': '按指定课程通关',
            'campaign.form_category': '指定课程分类',
            'campaign.form_required_minutes': '要求累计学时 (分钟)',
            'campaign.form_select_courses': '勾选指定必听录音/课时 (多选)',
            'campaign.form_search_courses_placeholder': '搜索录音标题',
            'campaign.modal_step3': '3. 荣誉证书定制化设计',
            'campaign.form_cert_banner_title': '主横幅荣誉称号 (Banner Title)',
            'campaign.form_cert_desc': '荣誉详情说明 (Description)',
            'campaign.form_cert_training': '项目名 (Training)',
            'campaign.form_cert_duration': '时长展示 (Duration)',
            'campaign.form_cert_achievement': '成就名称 (Achievement)',
            'campaign.form_cert_encouragement': '底部鼓励语 (Encouragement)',
            'campaign.form_cert_issued_by': '授权签发人 (Issued By)',
            'campaign.form_publishing': '发布中...',
            'campaign.form_publish_confirm': '确认发布此专项学习挑战',
            'campaign.preview_title': '证书实时效果预览 (PORTRAIT MOCKUP)',
            'campaign.alert_enter_title': '请输入挑战标题',
            'campaign.alert_select_audience': '请至少选择一个受众团队或个人',
            'campaign.alert_publish_success': '专项证书挑战发布成功！已向相关学员发送通知。',
            'campaign.alert_publish_failed': '发布失败，请重试',
            'campaign.confirm_delete': '确认要删除这个专项挑战吗？删除后，已达标用户将无法再查看或保存对应的证书。',
            'campaign.alert_delete_success': '删除成功',
            'campaign.alert_delete_failed': '删除失败，请重试'
        },
        en: {
            'campaign.manager_title': 'Exclusive Challenge & Certificate Management',
            'campaign.manager_subtitle': 'Publish targeted learning challenges for your team or individuals and customize their certificates of honor.',
            'campaign.publish_btn': 'Publish Challenge',
            'campaign.tab_active': 'Active',
            'campaign.tab_expired': 'Expired',
            'campaign.loading': 'Loading...',
            'campaign.empty_state': '🏜️ No challenges found',
            'campaign.audience': 'Audience',
            'campaign.audience_individual': 'Individual',
            'campaign.people': 'people',
            'campaign.deadline': 'Deadline',
            'campaign.publisher': 'Publisher',
            'campaign.delete_btn': 'Delete Challenge',
            'campaign.tracking_title': 'Challenge Progress Tracking',
            'campaign.tracking_placeholder_title': '👉 Select a challenge from the list',
            'campaign.tracking_placeholder_desc': 'Track the learning progress of all members in your team.',
            'campaign.tracking_loading': 'Calculating...',
            'campaign.tracking_audience': 'Audience',
            'campaign.tracking_completed_count': 'Completed',
            'campaign.minutes_unit': 'mins',
            'campaign.courses_unit': 'courses',
            'campaign.modal_title': 'Create & Customize Learning Challenge',
            'campaign.modal_subtitle': 'Configure target audience and rules, and preview customized certificates in real-time.',
            'campaign.modal_step1': '1. Basic Configuration',
            'campaign.form_title': 'Challenge Title *',
            'campaign.form_title_placeholder': 'e.g., First Call Special Challenge',
            'campaign.form_start_date': 'Start Date',
            'campaign.form_end_date': 'End Date',
            'campaign.form_audience_label': 'Target Audience (By Team or User) *',
            'campaign.form_audience_placeholder': 'Search by Name, CRM ID, or Department',
            'campaign.modal_step2': '2. Passing Rules',
            'campaign.rule_by_duration': 'By Learning Duration in Category',
            'campaign.rule_by_courses': 'By Specifying Course Completion',
            'campaign.form_category': 'Specify Category',
            'campaign.form_required_minutes': 'Required Learning Time (Minutes)',
            'campaign.form_select_courses': 'Select Specifying Courses (Multiple)',
            'campaign.form_search_courses_placeholder': 'Search course title',
            'campaign.modal_step3': '3. Certificate Customization',
            'campaign.form_cert_banner_title': 'Banner Title',
            'campaign.form_cert_desc': 'Description',
            'campaign.form_cert_training': 'Training Name',
            'campaign.form_cert_duration': 'Duration',
            'campaign.form_cert_achievement': 'Achievement',
            'campaign.form_cert_encouragement': 'Encouragement Text',
            'campaign.form_cert_issued_by': 'Issued By',
            'campaign.form_publishing': 'Publishing...',
            'campaign.form_publish_confirm': 'Confirm & Publish Challenge',
            'campaign.preview_title': 'Live Certificate Preview (PORTRAIT MOCKUP)',
            'campaign.alert_enter_title': 'Please enter the challenge title',
            'campaign.alert_select_audience': 'Please select at least one team or individual',
            'campaign.alert_publish_success': 'Exclusive challenge published successfully! Notifications sent to target users.',
            'campaign.alert_publish_failed': 'Failed to publish, please try again',
            'campaign.confirm_delete': 'Are you sure you want to delete this challenge? Once deleted, qualified users will no longer be able to view or save the certificate.',
            'campaign.alert_delete_success': 'Deleted successfully',
            'campaign.alert_delete_failed': 'Failed to delete, please try again'
        },
        ar: {
            'campaign.manager_title': 'إدارة التحديات والشهادات الحصرية',
            'campaign.manager_subtitle': 'انشر مهام تعليمية مخصصة لفريقك أو لموظفين محددين، وقم بتخصيص شهادات شرفية حصرية.',
            'campaign.publish_btn': 'نشر التحدي',
            'campaign.tab_active': 'نشط',
            'campaign.tab_expired': 'منتهي',
            'campaign.loading': 'جاري التحميل...',
            'campaign.empty_state': '🏜️ لا توجد تحديات مخصصة مطابقة',
            'campaign.audience': 'الجمهور',
            'campaign.audience_individual': 'فردي',
            'campaign.people': 'أشخاص',
            'campaign.deadline': 'الموعد النهائي',
            'campaign.publisher': 'الناشر',
            'campaign.delete_btn': 'حذف التحدي',
            'campaign.tracking_title': 'تتبع تحقيق التحدي',
            'campaign.tracking_placeholder_title': '👉 يرجى تحديد تحدٍ من القائمة اليسرى',
            'campaign.tracking_placeholder_desc': 'يمكنك تتبع حالة إنجاز الساعات التعليمية لجميع أعضاء الفريق.',
            'campaign.tracking_loading': 'جاري الإحصاء...',
            'campaign.tracking_audience': 'الجمهور',
            'campaign.tracking_completed_count': 'عدد المؤهلين',
            'campaign.minutes_unit': 'دقائق',
            'campaign.courses_unit': 'دورات',
            'campaign.modal_title': 'إنشاء وتخصيص تحدي تعليمي خاص',
            'campaign.modal_subtitle': 'قم بتهيئة جمهور التحدي وشروطه، واستخدم لوحة معاينة الشهادات لمراجعة تصميم الشهادة.',
            'campaign.modal_step1': '1. تهيئة المعلومات الأساسية',
            'campaign.form_title': 'عنوان التحدي *',
            'campaign.form_title_placeholder': 'مثال: تحدي اجتياز First Call الخاص',
            'campaign.form_start_date': 'تاريخ البدء',
            'campaign.form_end_date': 'تاريخ الانتهاء',
            'campaign.form_audience_label': 'اختر الجمهور المستهدف (حسب الفريق أو الأفراد) *',
            'campaign.form_audience_placeholder': 'ابحث بالاسم أو CRM أو القسم',
            'campaign.modal_step2': '2. قواعد الاجتياز والتأهل',
            'campaign.rule_by_duration': 'حسب مدة التعلم في تصنيف محدد',
            'campaign.rule_by_courses': 'حسب اجتياز دورات محددة',
            'campaign.form_category': 'تصنيف الدورات المحدد',
            'campaign.form_required_minutes': 'الساعات المطلوبة (بالدقائق)',
            'campaign.form_select_courses': 'اختر الدورات/التسجيلات المحددة (متعدد)',
            'campaign.form_search_courses_placeholder': 'ابحث عن عنوان التسجيل',
            'campaign.modal_step3': '3. تصميم مخصص للشهادة الشرفية',
            'campaign.form_cert_banner_title': 'عنوان الشرف الرئيسي (Banner Title)',
            'campaign.form_cert_desc': 'وصف تفاصيل الشرف (Description)',
            'campaign.form_cert_training': 'اسم التدريب (Training)',
            'campaign.form_cert_duration': 'المدة المعروضة (Duration)',
            'campaign.form_cert_achievement': 'اسم الإنجاز (Achievement)',
            'campaign.form_cert_encouragement': 'عبارة التشجيع في الأسفل (Encouragement)',
            'campaign.form_cert_issued_by': 'الجهة المانحة المعتمدة (Issued By)',
            'campaign.form_publishing': 'جاري النشر...',
            'campaign.form_publish_confirm': 'تأكيد ونشر هذا التحدي التعليمي',
            'campaign.preview_title': 'معاينة حية للشهادة (PORTRAIT MOCKUP)',
            'campaign.alert_enter_title': 'يرجى إدخال عنوان التحدي',
            'campaign.alert_select_audience': 'يرجى تحديد فريق أو مستخدم واحد على الأقل',
            'campaign.alert_publish_success': 'تم نشر التحدي بنجاح! تم إرسال إشعارات للطلاب المعنيين.',
            'campaign.alert_publish_failed': 'فشل النشر، يرجى المحاولة مرة أخرى',
            'campaign.confirm_delete': 'هل أنت متأكد من رغبتك في حذف هذا التحدي؟ بعد الحذف، لن يتمكن المستخدمون المؤهلون من عرض الشهادة أو حفظها.',
            'campaign.alert_delete_success': 'تم الحذف بنجاح',
            'campaign.alert_delete_failed': 'فشل الحذف، يرجى المحاولة مرة أخرى'
        }
    };
    const currentLang = dict[lang] ? lang : 'zh';
    return dict[currentLang][key] || defaultVal || key;
};

export default function CampaignManager() {
    const { t, i18n } = useTranslation();
    const { profile, isLeader } = useAuth();

    const todayStr = useMemo(() => {
        const currentLocale = i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'en' ? 'en-US' : 'zh-CN';
        return new Date().toLocaleDateString(currentLocale, { year: 'numeric', month: 'short', day: 'numeric' });
    }, [i18n.language]);
    
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Form States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active');
    const [campaignTitle, setCampaignTitle] = useState('');
    const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d.toISOString().split('T')[0];
    });
    
    // Conditions Form States
    const [conditionType, setConditionType] = useState<'category' | 'specific_tasks'>('category');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [requiredMinutes, setRequiredMinutes] = useState(120);
    const [selectedRecordingIds, setSelectedRecordingIds] = useState<string[]>([]);
    const [recordingSearchQuery, setRecordingSearchQuery] = useState('');
    const [userSearchQuery, setUserSearchQuery] = useState('');
    
    // Certificate Customization States
    const [bannerTitle, setBannerTitle] = useState('MASTER OF THE FIRST CALL');
    const [bannerSubTitle, setBannerSubTitle] = useState('for successfully completing the First Call Training Program and demonstrating excellence in the First Call process.');
    const [trainingName, setTrainingName] = useState('First Call Training');
    const [durationText, setDurationText] = useState('2 Hours');
    const [achievementText, setAchievementText] = useState('Master of the First Call');
    const [encouragementText, setEncouragementText] = useState('Your dedication to learning and commitment to excellence reflect the true spirit of 51Talk. Keep up the great work!');
    const [issuedBy, setIssuedBy] = useState('51Talk Management');

    // Tracking View States
    const [selectedCampaignForTracking, setSelectedCampaignForTracking] = useState<Campaign | null>(null);
    const [trackingProgressList, setTrackingProgressList] = useState<any[]>([]);
    const [loadingTracking, setLoadingTracking] = useState(false);

    if (!isLeader) {
        return <Navigate to="/hub" replace />;
    }

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch campaigns
            const campaignSnapshot = await getDocs(collection(db, 'campaigns'));
            const campaignData: Campaign[] = [];
            campaignSnapshot.forEach(doc => {
                campaignData.push({ id: doc.id, ...doc.data() } as Campaign);
            });
            setCampaigns(campaignData);

            // 2. Fetch categories
            const categorySnapshot = await getDocs(collection(db, 'categories'));
            const categoryData: Category[] = [];
            categorySnapshot.forEach(doc => {
                categoryData.push({ id: doc.id, name: doc.data().name });
            });
            setCategories(categoryData);
            if (categoryData.length > 0) {
                setSelectedCategory(categoryData[0].id);
            }

            // 3. Fetch recordings
            const recordingsSnapshot = await getDocs(collection(db, 'recordings'));
            const recData: Recording[] = [];
            recordingsSnapshot.forEach(doc => {
                const data = doc.data();
                recData.push({ id: doc.id, title: data.title, categoryId: data.categoryId });
            });
            setRecordings(recData);

            // 4. Fetch users
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersData: SystemUser[] = [];
            usersSnapshot.forEach(doc => {
                const data = doc.data();
                usersData.push({
                    id: doc.id,
                    crmId: data.crmId || '',
                    name: data.name || '',
                    role: data.role || 'user',
                    team: data.team || '',
                    email: data.email || '',
                    sd: data.sd || '',
                    sm: data.sm || '',
                    tl: data.tl || ''
                });
            });

            // Filter users based on leader's scope (exactly like TeamTasks.tsx)
            const loggedInRole = String(profile?.role).trim().toLowerCase();
            const loggedInCrmId = (profile?.crmId || '').trim().toLowerCase();
            const loggedInTeam = (profile?.team || '').trim().toLowerCase();

            const filteredUsers = usersData.filter(u => {
                const uTeam = (u.team || '').trim();
                const uTeamLower = uTeam.toLowerCase();
                const uCrmId = (u.crmId || '').trim().toLowerCase();

                const uSd = (u.sd || '').trim().toLowerCase();
                const uSm = (u.sm || '').trim().toLowerCase();
                const uTl = (u.tl || '').trim().toLowerCase();

                // 1. Super Admin / Admin: Show all users (excluding themselves)
                if (loggedInRole === 'super_admin' || loggedInRole === 'admin') {
                    return uCrmId !== loggedInCrmId;
                }

                // 2. SD (Sales Director): Show users under their hierarchy
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

            setSystemUsers(filteredUsers);
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Get unique team names from users for the team selector
    const allUniqueTeams = useMemo(() => {
        return Array.from(new Set(systemUsers.map(u => u.team).filter(t => t)));
    }, [systemUsers]);

    // Handle Campaign Creation
    const handleCreateCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!campaignTitle.trim()) {
            alert(localT('campaign.alert_enter_title', '请输入挑战标题', i18n));
            return;
        }
        if (selectedTeams.length === 0 && selectedUsers.length === 0) {
            alert(localT('campaign.alert_select_audience', '请至少选择一个受众团队或个人', i18n));
            return;
        }

        setActionLoading(true);
        try {
            const newCampaign = {
                title: campaignTitle.trim(),
                creatorId: profile?.realUid || profile?.crmId || 'admin',
                creatorRole: (profile?.role || 'TL') as any,
                creatorName: profile?.name || 'Manager',
                teamIds: selectedTeams,
                userIds: selectedUsers,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                conditions: {
                    ...(conditionType === 'category' 
                        ? { category: selectedCategory, requiredMinutes }
                        : { requiredTaskIds: selectedRecordingIds }
                    )
                },
                certConfig: {
                    bannerTitle,
                    bannerSubTitle,
                    trainingName,
                    durationText,
                    achievementText,
                    encouragementText,
                    issuedBy
                },
                createdAt: new Date()
            };

            const docRef = await addDoc(collection(db, 'campaigns'), newCampaign);
            const campaignId = docRef.id;

            // Target users for this campaign
            const targetUids = systemUsers
                .filter(u => selectedTeams.includes(u.team) || selectedUsers.includes(u.id))
                .map(u => u.id);

            // 1. Create in-app notifications in Firestore for each target user in parallel
            if (targetUids.length > 0) {
                try {
                    await Promise.all(
                        targetUids.map(recipientId =>
                            addDoc(collection(db, 'user_notifications'), {
                                recipientId,
                                senderName: profile?.name || 'Manager',
                                type: 'comment', // mapped as comment in NotificationBell to reuse layout/styling
                                titleKey: 'notifications.new_campaign_title',
                                content: campaignTitle.trim(),
                                read: false,
                                createdAt: new Date()
                            })
                        )
                    );
                } catch (notifErr) {
                    console.error("Failed to create in-app notifications:", notifErr);
                }
            }

            // 2. Trigger DingTalk & FCM push notification via Serverless function
            if (targetUids.length > 0) {
                try {
                    const res = await fetch('/.netlify/functions/dingtalk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'notifyCampaign',
                            title: campaignTitle.trim(),
                            bannerTitle: bannerTitle,
                            creatorName: profile?.name || 'Manager',
                            endDate: endDate,
                            assigneeIds: targetUids
                        })
                    });
                    
                    if (!res.ok) {
                        throw new Error('Serverless function returned non-ok status');
                    }
                    const notifyData = await res.json();
                    console.log("[CampaignManager] Notification trigger result:", notifyData);
                } catch (pushErr) {
                    console.error("DingTalk/FCM campaign notification failed:", pushErr);
                }
            }
            
            // Reset states
            setCampaignTitle('');
            setSelectedTeams([]);
            setSelectedUsers([]);
            setSelectedRecordingIds([]);
            setShowCreateModal(false);
            
            // Re-fetch data
            await fetchData();
            alert(localT('campaign.alert_publish_success', '专项证书挑战发布成功！已向相关学员发送通知。', i18n));
        } catch (error) {
            console.error("Error creating campaign:", error);
            alert(localT('campaign.alert_publish_failed', '发布失败，请重试', i18n));
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Campaign Deletion
    const handleDeleteCampaign = async (campaignId: string) => {
        if (!window.confirm(localT('campaign.confirm_delete', '确认要删除这个专项挑战吗？删除后，已达标用户将无法再查看或保存对应的证书。', i18n))) return;
        try {
            await deleteDoc(doc(db, 'campaigns', campaignId));
            setCampaigns(prev => prev.filter(c => c.id !== campaignId));
            if (selectedCampaignForTracking?.id === campaignId) {
                setSelectedCampaignForTracking(null);
            }
            alert(localT('campaign.alert_delete_success', '删除成功', i18n));
        } catch (error) {
            console.error("Error deleting campaign:", error);
            alert(localT('campaign.alert_delete_failed', '删除失败，请重试', i18n));
        }
    };

    // Load progress list for a campaign
    const handleTrackCampaign = async (campaign: Campaign) => {
        setSelectedCampaignForTracking(campaign);
        setLoadingTracking(true);
        try {
            // Get all learning history logs
            const historySnap = await getDocs(collection(db, 'learning_history'));
            const logs: any[] = [];
            historySnap.forEach(d => {
                logs.push({ id: d.id, ...d.data() });
            });

            // Target users for this campaign
            const targetUsers = systemUsers.filter(u => {
                const inTeam = campaign.teamIds.includes(u.team);
                const inUsers = campaign.userIds?.includes(u.id);
                return inTeam || inUsers;
            });

            // Calculate progress for each user
            const trackingData = targetUsers.map(user => {
                const userLogs = logs.filter(log => log.userId === user.id);
                
                let completed = false;
                let progressText = '';
                let progressPercent = 0;

                if (campaign.conditions.category) {
                    // Category-based
                    const catRecs = recordings.filter(r => r.categoryId === campaign.conditions.category);
                    const catRecIds = catRecs.map(r => r.id);
                    // Find completed recordings in this category
                    // We check unique completed recording IDs from user's history
                    const completedInCat = Array.from(new Set(
                        userLogs
                            .filter(log => catRecIds.includes(log.recordingId))
                            .map(log => log.recordingId)
                    ));
                    
                    const progressMins = completedInCat.length * 12; // 12 mins per completed lesson
                    const reqMins = campaign.conditions.requiredMinutes || 120;
                    progressPercent = Math.min(100, Math.round((progressMins / reqMins) * 100));
                    completed = progressPercent >= 100;
                    progressText = `${progressMins} / ${reqMins} ${localT('campaign.minutes_unit', '分钟', i18n)}`;
                } else if (campaign.conditions.requiredTaskIds) {
                    // Specific checklist
                    const reqIds = campaign.conditions.requiredTaskIds;
                    const completedTasks = Array.from(new Set(
                        userLogs
                            .filter(log => reqIds.includes(log.recordingId))
                            .map(log => log.recordingId)
                    ));
                    progressPercent = Math.min(100, Math.round((completedTasks.length / reqIds.length) * 100));
                    completed = completedTasks.length === reqIds.length;
                    progressText = `${completedTasks.length} / ${reqIds.length} ${localT('campaign.courses_unit', '门课', i18n)}`;
                }

                return {
                    id: user.id,
                    name: user.name,
                    crmId: user.crmId,
                    team: user.team,
                    role: user.role,
                    progressPercent,
                    progressText,
                    completed
                };
            });

            setTrackingProgressList(trackingData);
        } catch (error) {
            console.error("Error loading tracking stats:", error);
        } finally {
            setLoadingTracking(false);
        }
    };

    // Filter campaigns based on expiration
    const filteredCampaigns = campaigns.filter(c => {
        const now = new Date();
        const end = c.endDate ? c.endDate.toDate() : new Date();
        const isExpired = now > end;
        return activeTab === 'expired' ? isExpired : !isExpired;
    });

    // Checkbox togglers
    const handleToggleTeam = (teamName: string) => {
        const teamMembers = systemUsers.filter(u => u.team === teamName).map(u => u.id);
        const isTeamSelected = selectedTeams.includes(teamName);

        if (isTeamSelected) {
            // Unselect team
            setSelectedTeams(prev => prev.filter(t => t !== teamName));
            setSelectedUsers(prev => prev.filter(uid => !teamMembers.includes(uid)));
        } else {
            // Select team
            setSelectedTeams(prev => [...prev, teamName]);
            setSelectedUsers(prev => Array.from(new Set([...prev, ...teamMembers])));
        }
    };

    const handleToggleUser = (userId: string, teamName: string) => {
        const isUserSelected = selectedUsers.includes(userId);
        const teamMembers = systemUsers.filter(u => u.team === teamName).map(u => u.id);

        if (isUserSelected) {
            // Unselect user
            setSelectedUsers(prev => prev.filter(uid => uid !== userId));
            // Since one user is unselected, the team cannot be fully selected
            setSelectedTeams(prev => prev.filter(t => t !== teamName));
        } else {
            // Select user
            const nextUsers = [...selectedUsers, userId];
            setSelectedUsers(nextUsers);
            
            // Check if all team members are now selected
            const allMembersSelected = teamMembers.every(uid => nextUsers.includes(uid));
            if (allMembersSelected) {
                setSelectedTeams(prev => [...prev, teamName]);
            }
        }
    };

    const toggleRecordingSelection = (recId: string) => {
        setSelectedRecordingIds(prev => 
            prev.includes(recId) ? prev.filter(id => id !== recId) : [...prev, recId]
        );
    };

    const filteredRecordings = recordings.filter(r => 
        r.title?.toLowerCase().includes(recordingSearchQuery.toLowerCase())
    );

    const filteredSystemUsers = systemUsers.filter(u => 
        u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
        u.crmId.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.team.toLowerCase().includes(userSearchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/70 backdrop-blur-md rounded-3xl p-6 border border-white/60 shadow-sm">
                <div>
                    <h2 className="text-xl font-extrabold text-deep-teal flex items-center gap-2">
                        <Award className="w-6 h-6 text-desert-gold" />
                        <span>{localT('campaign.manager_title', '专项挑战与荣誉证书管理', i18n)}</span>
                    </h2>
                    <p className="text-slate-500 text-xs mt-1">
                        {localT('campaign.manager_subtitle', '为您的团队或特定员工发布针对性的学习任务，并定制颁发专属荣誉证书。', i18n)}
                    </p>
                </div>
                
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-gradient-to-r from-deep-teal to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-extrabold text-xs py-2.5 px-6 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all shrink-0"
                >
                    <Plus className="w-4 h-4" /> {localT('campaign.publish_btn', '发布专项挑战', i18n)}
                </button>
            </div>

            {/* Main Content Grid: Left List / Right Tracker */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Side: Campaign List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-white/60 shadow-sm flex flex-col h-full">
                        {/* Tabs */}
                        <div className="flex border-b border-slate-100 pb-3 mb-4 gap-4">
                            <button
                                onClick={() => setActiveTab('active')}
                                className={`font-black text-sm pb-1 border-b-2 transition-all cursor-pointer ${
                                    activeTab === 'active' ? 'border-deep-teal text-deep-teal' : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {localT('campaign.tab_active', '进行中', i18n)} ({campaigns.filter(c => new Date() <= (c.endDate ? c.endDate.toDate() : new Date())).length})
                            </button>
                            <button
                                onClick={() => setActiveTab('expired')}
                                className={`font-black text-sm pb-1 border-b-2 transition-all cursor-pointer ${
                                    activeTab === 'expired' ? 'border-deep-teal text-deep-teal' : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {localT('campaign.tab_expired', '已截止', i18n)} ({campaigns.filter(c => new Date() > (c.endDate ? c.endDate.toDate() : new Date())).length})
                            </button>
                        </div>

                        {loading ? (
                            <div className="py-12 flex justify-center items-center text-slate-400 text-sm font-semibold gap-2">
                                <RefreshCw className="w-5 h-5 animate-spin" /> {localT('campaign.loading', '加载中...', i18n)}
                            </div>
                        ) : filteredCampaigns.length === 0 ? (
                            <div className="py-16 text-center text-slate-400 text-sm font-semibold">
                                {localT('campaign.empty_state', '🏜️ 暂无符合条件的专项挑战', i18n)}
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                                {filteredCampaigns.map(campaign => {
                                    const isSelected = selectedCampaignForTracking?.id === campaign.id;
                                    const end = campaign.endDate ? campaign.endDate.toDate() : new Date();
                                    const currentLocale = i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'en' ? 'en-US' : 'zh-CN';
                                    const formattedEndDate = end.toLocaleDateString(currentLocale, { year: 'numeric', month: 'short', day: 'numeric' });
                                    
                                    return (
                                        <div
                                            key={campaign.id}
                                            onClick={() => handleTrackCampaign(campaign)}
                                            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 group ${
                                                isSelected 
                                                    ? 'bg-deep-teal/5 border-deep-teal/30 shadow-sm' 
                                                    : 'bg-white hover:bg-slate-50/50 border-slate-100 hover:border-slate-200'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-extrabold text-sm text-slate-800 group-hover:text-deep-teal transition-colors truncate">
                                                        {campaign.title}
                                                    </h3>
                                                    <span className="text-[10px] font-black text-white bg-desert-gold/90 px-1.5 py-0.5 rounded-md shrink-0">
                                                        {campaign.certConfig.bannerTitle}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400 font-semibold flex-wrap">
                                                    <span className="flex items-center gap-1">
                                                        <Users className="w-3.5 h-3.5" />
                                                        {localT('campaign.audience', '受众', i18n)}: {campaign.teamIds.join(', ') || localT('campaign.audience_individual', '个人', i18n)}
                                                        {campaign.userIds && campaign.userIds.length > 0 && ` (+${campaign.userIds.length} ${localT('campaign.people', '人', i18n)})`}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        {localT('campaign.deadline', '截止', i18n)}: {formattedEndDate}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-slate-500">
                                                        👤 {localT('campaign.publisher', '发布者', i18n)}: {campaign.creatorName} ({campaign.creatorRole.toUpperCase()})
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteCampaign(campaign.id);
                                                    }}
                                                    className="p-2 rounded-xl text-red-500 hover:bg-red-50 active:scale-95 transition-all cursor-pointer"
                                                    title={localT('campaign.delete_btn', '删除挑战', i18n)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Tracking Progress */}
                <div className="lg:col-span-1">
                    <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-white/60 shadow-sm h-full flex flex-col">
                        <h3 className="font-extrabold text-sm text-deep-teal pb-3 border-b border-slate-100 flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-desert-gold" />
                            <span>{localT('campaign.tracking_title', '挑战达标追踪', i18n)}</span>
                        </h3>

                        {!selectedCampaignForTracking ? (
                            <div className="py-24 text-center text-slate-400 text-xs font-bold leading-normal flex-1 flex flex-col justify-center items-center">
                                <span>{localT('campaign.tracking_placeholder_title', '👉 请从左侧列表选择一个专项挑战', i18n)}</span>
                                <span className="mt-1 text-[10px] text-slate-400/80">{localT('campaign.tracking_placeholder_desc', '可追踪团队内所有成员的学时达标状态。', i18n)}</span>
                            </div>
                        ) : loadingTracking ? (
                            <div className="py-12 flex justify-center items-center text-slate-400 text-xs font-semibold gap-2 flex-1">
                                <RefreshCw className="w-4 h-4 animate-spin" /> {localT('campaign.tracking_loading', '统计中...', i18n)}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col mt-4 min-h-0">
                                <div className="mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100/60">
                                    <h4 className="font-black text-xs text-slate-700 truncate">{selectedCampaignForTracking.title}</h4>
                                    <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1.5">
                                        <span>{localT('campaign.tracking_audience', '受众', i18n)}: {selectedCampaignForTracking.teamIds.join(', ') || localT('campaign.audience_individual', '个人', i18n)}</span>
                                        <span className="text-deep-teal">{localT('campaign.tracking_completed_count', '达标人数', i18n)}: {trackingProgressList.filter(u => u.completed).length} / {trackingProgressList.length}</span>
                                    </div>
                                </div>

                                <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1 flex-1">
                                    {trackingProgressList.map(user => (
                                        <div key={user.id} className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between gap-3 text-xs">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-extrabold text-slate-800 truncate">{user.name}</span>
                                                    <span className="text-[10px] font-mono text-slate-400 shrink-0">CRM: {user.crmId}</span>
                                                </div>
                                                
                                                {/* Mini progress bar */}
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-300 ${
                                                                user.completed ? 'bg-emerald-500' : 'bg-gradient-to-r from-deep-teal to-desert-gold'
                                                            }`}
                                                            style={{ width: `${user.progressPercent}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-[9px] font-mono font-bold text-slate-500 shrink-0">{user.progressText}</span>
                                                </div>
                                            </div>

                                            <div className="shrink-0 pl-1">
                                                {user.completed ? (
                                                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs shadow-inner">✓</span>
                                                ) : (
                                                    <span className="w-5 h-5 rounded-full bg-slate-50 text-slate-300 border border-dashed border-slate-200 flex items-center justify-center text-[8px] font-black">⏳</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Create Campaign Modal (Fullscreen overlay designer) */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-8 w-full max-w-5xl shadow-2xl border border-white/60 max-h-[92vh] overflow-y-auto scrollbar-thin flex flex-col">
                        
                        {/* Modal Header */}
                        <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6 shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-deep-teal flex items-center gap-1.5">
                                    <LayoutTemplate className="w-5 h-5 text-desert-gold" />
                                    <span>{localT('campaign.modal_title', '创建与定制发布专项学习挑战', i18n)}</span>
                                </h3>
                                <p className="text-slate-400 text-[10px] font-semibold mt-0.5">{localT('campaign.modal_subtitle', '配置挑战条件受众，并利用证书可视化看板预览定制的证书样式。', i18n)}</p>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer active:scale-95 transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Grid: Form (Left) & Live Certificate Preview (Right) */}
                        <form onSubmit={handleCreateCampaign} className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
                            
                            {/* Left Column: Config Forms */}
                            <div className="space-y-5 overflow-y-auto max-h-[64vh] pr-2 scrollbar-thin">
                                
                                {/* Section 1: Basic Config */}
                                <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider border-b border-slate-200/50 pb-1.5 flex items-center gap-1">
                                        <span>{localT('campaign.modal_step1', '1. 基础信息配置', i18n)}</span>
                                    </h4>
                                    
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-500 mb-1">{localT('campaign.form_title', '挑战标题 *', i18n)}</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder={localT('campaign.form_title_placeholder', '如：First Call 专项通关挑战', i18n)}
                                            value={campaignTitle}
                                            onChange={(e) => setCampaignTitle(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white"
                                        />
                                    </div>

                                    {/* Dates */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-black text-slate-500 mb-1">{localT('campaign.form_start_date', '开始日期', i18n)}</label>
                                            <input
                                                type="date"
                                                required
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-black text-slate-500 mb-1">{localT('campaign.form_end_date', '截止日期', i18n)}</label>
                                            <input
                                                type="date"
                                                required
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white"
                                            />
                                        </div>
                                    </div>

                                    {/* Unified Audience Selector (Grouped by Team) */}
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-500 mb-1.5">
                                            {localT('campaign.form_audience_label', '选择目标受众 (按团队与个人展示) *', i18n)}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={localT('campaign.form_audience_placeholder', '输入名字/CRM/部门搜索员工', i18n)}
                                            value={userSearchQuery}
                                            onChange={(e) => setUserSearchQuery(e.target.value)}
                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white mb-2"
                                        />
                                        
                                        <div className="max-h-64 overflow-y-auto border border-slate-200 p-3 rounded-2xl bg-white scrollbar-thin space-y-3">
                                            {allUniqueTeams.map(teamName => {
                                                const teamMembers = systemUsers.filter(u => u.team === teamName);
                                                const matchesSearch = (user: SystemUser) => {
                                                    if (!userSearchQuery.trim()) return true;
                                                    const query = userSearchQuery.toLowerCase();
                                                    return (
                                                        user.name.toLowerCase().includes(query) ||
                                                        user.crmId.toLowerCase().includes(query) ||
                                                        user.team.toLowerCase().includes(query)
                                                    );
                                                };
                                                const filteredMembers = teamMembers.filter(matchesSearch);
                                                if (filteredMembers.length === 0) return null;

                                                const isTeamSelected = selectedTeams.includes(teamName);
                                                const selectedMembersCount = filteredMembers.filter(u => selectedUsers.includes(u.id)).length;
                                                const isPartiallySelected = selectedMembersCount > 0 && selectedMembersCount < filteredMembers.length;

                                                return (
                                                    <div key={teamName} className="space-y-1">
                                                        {/* Team Header */}
                                                        <div className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                                                            <input 
                                                                 type="checkbox"
                                                                 checked={isTeamSelected}
                                                                 ref={(el) => {
                                                                     if (el) el.indeterminate = isPartiallySelected;
                                                                 }}
                                                                 onChange={() => handleToggleTeam(teamName)}
                                                                 className="rounded border-slate-300 text-deep-teal focus:ring-deep-teal w-3.5 h-3.5 cursor-pointer"
                                                            />
                                                            <span className="text-xs font-black text-slate-800 cursor-pointer flex-1" onClick={() => handleToggleTeam(teamName)}>
                                                                {teamName} ({selectedMembersCount}/{filteredMembers.length})
                                                            </span>
                                                        </div>

                                                        {/* Team Members List */}
                                                        <div className="pl-6 border-l border-slate-100 space-y-1 ml-1.5">
                                                            {filteredMembers.map(u => {
                                                                const isSelected = selectedUsers.includes(u.id);
                                                                return (
                                                                    <label key={u.id} className="flex items-center gap-2 py-0.5 hover:bg-slate-50/50 px-1 rounded cursor-pointer text-[10px] font-semibold text-slate-600">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={isSelected}
                                                                            onChange={() => handleToggleUser(u.id, teamName)}
                                                                            className="rounded border-slate-300 text-deep-teal focus:ring-deep-teal w-3 h-3 shrink-0"
                                                                        />
                                                                        <span className="truncate flex-1">{u.name} (CRM: {u.crmId})</span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Condition Trigger Config */}
                                <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider border-b border-slate-200/50 pb-1.5 flex items-center gap-1">
                                        <span>{localT('campaign.modal_step2', '2. 达标通关规则', i18n)}</span>
                                    </h4>

                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                                            <input 
                                                type="radio" 
                                                checked={conditionType === 'category'} 
                                                onChange={() => setConditionType('category')} 
                                                className="text-deep-teal focus:ring-deep-teal w-3.5 h-3.5"
                                            />
                                            {localT('campaign.rule_by_duration', '按特定分类学习时长', i18n)}
                                        </label>
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                                            <input 
                                                type="radio" 
                                                checked={conditionType === 'specific_tasks'} 
                                                onChange={() => setConditionType('specific_tasks')} 
                                                className="text-deep-teal focus:ring-deep-teal w-3.5 h-3.5"
                                            />
                                            {localT('campaign.rule_by_courses', '按指定课程通关', i18n)}
                                        </label>
                                    </div>

                                    {conditionType === 'category' ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[11px] font-black text-slate-500 mb-1">{localT('campaign.form_category', '指定课程分类', i18n)}</label>
                                                <select
                                                    value={selectedCategory}
                                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white"
                                                >
                                                    {categories.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-black text-slate-500 mb-1">{localT('campaign.form_required_minutes', '要求累计学时 (分钟)', i18n)}</label>
                                                <input
                                                    type="number"
                                                    required
                                                    min={10}
                                                    value={requiredMinutes}
                                                    onChange={(e) => setRequiredMinutes(Number(e.target.value))}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <label className="block text-[11px] font-black text-slate-500 mb-1">{localT('campaign.form_select_courses', '勾选指定必听录音/课时 (多选)', i18n)}</label>
                                            <input
                                                type="text"
                                                placeholder={localT('campaign.form_search_courses_placeholder', '搜索录音标题', i18n)}
                                                value={recordingSearchQuery}
                                                onChange={(e) => setRecordingSearchQuery(e.target.value)}
                                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white mb-2"
                                            />
                                            <div className="max-h-36 overflow-y-auto border border-slate-200 p-2 rounded-xl bg-white scrollbar-thin space-y-1">
                                                {filteredRecordings.map(rec => {
                                                    const isSelected = selectedRecordingIds.includes(rec.id);
                                                    return (
                                                        <label key={rec.id} className="flex items-center gap-2 px-1 py-0.5 hover:bg-slate-50 rounded cursor-pointer text-[10px] font-semibold text-slate-600">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isSelected}
                                                                onChange={() => toggleRecordingSelection(rec.id)}
                                                                className="rounded border-slate-350 text-deep-teal focus:ring-deep-teal shrink-0 w-3 h-3"
                                                            />
                                                            <span className="truncate flex-1">{rec.title}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Section 3: Certificate Template Customizer */}
                                <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider border-b border-slate-200/50 pb-1.5 flex items-center gap-1">
                                        <span>{localT('campaign.modal_step3', '3. 荣誉证书定制化设计', i18n)}</span>
                                    </h4>

                                    <div>
                                        <label className="block text-[11px] font-black text-slate-500 mb-1">{localT('campaign.form_cert_banner_title', '主横幅荣誉称号 (Banner Title)', i18n)}</label>
                                        <input
                                            type="text"
                                            required
                                            value={bannerTitle}
                                            onChange={(e) => setBannerTitle(e.target.value.toUpperCase())}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white uppercase font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-black text-slate-500 mb-1">{localT('campaign.form_cert_desc', '荣誉详情说明 (Description)', i18n)}</label>
                                        <textarea
                                            rows={3}
                                            required
                                            value={bannerSubTitle}
                                            onChange={(e) => setBannerSubTitle(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white leading-normal"
                                        />
                                    </div>

                                    {/* Stats fields customization */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-1">{localT('campaign.form_cert_training', '项目名 (Training)', i18n)}</label>
                                            <input
                                                type="text"
                                                required
                                                value={trainingName}
                                                onChange={(e) => setTrainingName(e.target.value)}
                                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-1">{localT('campaign.form_cert_duration', '时长展示 (Duration)', i18n)}</label>
                                            <input
                                                type="text"
                                                required
                                                value={durationText}
                                                onChange={(e) => setDurationText(e.target.value)}
                                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-1">{localT('campaign.form_cert_achievement', '成就名称 (Achievement)', i18n)}</label>
                                            <input
                                                type="text"
                                                required
                                                value={achievementText}
                                                onChange={(e) => setAchievementText(e.target.value)}
                                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-black text-slate-500 mb-1">{localT('campaign.form_cert_encouragement', '底部鼓励语 (Encouragement)', i18n)}</label>
                                        <input
                                            type="text"
                                            required
                                            value={encouragementText}
                                            onChange={(e) => setEncouragementText(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-black text-slate-500 mb-1">{localT('campaign.form_cert_issued_by', '授权签发人 (Issued By)', i18n)}</label>
                                        <input
                                            type="text"
                                            required
                                            value={issuedBy}
                                            onChange={(e) => setIssuedBy(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="w-full bg-gradient-to-r from-deep-teal to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-98 transition-all disabled:opacity-50"
                                    >
                                        {actionLoading ? localT('campaign.form_publishing', '发布中...', i18n) : localT('campaign.form_publish_confirm', '确认发布此专项学习挑战', i18n)}
                                    </button>
                                </div>
                            </div>

                            {/* Right Column: Live Mockup Certificate Preview */}
                            <div className="hidden lg:flex flex-col items-center justify-center bg-slate-50/60 rounded-3xl border border-slate-100 p-6 relative overflow-hidden select-none">
                                <div className="absolute top-4 left-4 text-slate-400 text-[10px] font-black bg-slate-200/50 px-2 py-0.5 rounded-full z-15">
                                    {localT('campaign.preview_title', '证书实时效果预览 (PORTRAIT MOCKUP)', i18n)}
                                </div>

                                {/* Mockup Printable Frame */}
                                <div className="w-[340px] aspect-[1/1.22] bg-white border border-blue-600/40 rounded-2xl shadow-xl flex flex-col p-3 relative overflow-hidden text-slate-800 scale-90 md:scale-95 transform">
                                    
                                    {/* Mock SVGs Corners */}
                                    <div className="absolute top-0 left-0 w-16 h-16 pointer-events-none z-0">
                                        <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
                                            <path d="M0 0 C 70 0, 80 25, 55 65 C 35 90, 0 90, 0 90 Z" fill="#1e40af" opacity="0.95"/>
                                            <path d="M0 0 C 50 0, 60 20, 40 50 C 25 70, 0 70, 0 70 Z" fill="#eab308" opacity="0.9"/>
                                        </svg>
                                    </div>
                                    <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none z-0">
                                        <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
                                            <path d="M100 0 C 30 0, 20 25, 45 65 C 65 90, 100 90, 100 90 Z" fill="#1e40af" opacity="0.95"/>
                                            <path d="M100 0 C 50 0, 40 20, 60 50 C 75 70, 100 70, 100 70 Z" fill="#eab308" opacity="0.9"/>
                                        </svg>
                                    </div>
                                    <div className="absolute bottom-0 left-0 w-16 h-16 pointer-events-none z-0">
                                        <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
                                            <path d="M0 100 C 70 100, 80 75, 55 35 C 35 10, 0 10, 0 10 Z" fill="#eab308" opacity="0.9"/>
                                            <path d="M0 100 C 50 100, 60 80, 40 50 C 25 30, 0 30, 0 30 Z" fill="#1e40af" opacity="0.95"/>
                                        </svg>
                                    </div>
                                    <div className="absolute bottom-0 right-0 w-16 h-16 pointer-events-none z-0">
                                        <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
                                            <path d="M100 100 C 30 100, 20 75, 45 35 C 65 10, 100 10, 100 10 Z" fill="#eab308" opacity="0.9"/>
                                            <path d="M100 100 C 50 100, 40 80, 60 50 C 75 30, 100 30, 100 30 Z" fill="#1e40af" opacity="0.95"/>
                                        </svg>
                                    </div>

                                    {/* Outer Gold Inner Margin box */}
                                    <div className="m-1.5 border border-yellow-400/40 rounded-xl p-3 flex flex-col items-center justify-between h-full relative z-10 bg-white/95">
                                        
                                        {/* Logo and Mascot */}
                                        <div className="w-full flex justify-between items-center px-1">
                                            <img src="/images/51talk-logo.png" alt="logo" className="h-6 object-contain" />
                                            <img src="/images/51talk-mascot-smiling.png" alt="mascot" className="h-9 object-contain" />
                                        </div>

                                        {/* Certificate Heading */}
                                        <div className="text-center mt-1">
                                            <h2 className="text-blue-900 font-extrabold text-base tracking-widest leading-none">CERTIFICATE</h2>
                                            <p className="text-blue-800 font-bold text-[7px] tracking-[0.25em] uppercase mt-0.5">OF ACHIEVEMENT</p>
                                        </div>

                                        <p className="text-slate-400 text-[8px] font-semibold tracking-wider">This is to certify that</p>
                                        
                                        {/* Recipient Name */}
                                        <h3 className="text-sm font-extrabold text-blue-700 italic border-b border-yellow-400/40 pb-0.5 px-3 min-w-32 text-center truncate max-w-full">
                                            {profile?.name || 'mohserdah'}
                                        </h3>
                                        
                                        <p className="text-slate-400 text-[7px] font-semibold">has successfully completed the</p>

                                        {/* Custom Banner */}
                                        <div className="relative w-full max-w-[260px] bg-gradient-to-r from-blue-700 to-blue-800 text-white font-extrabold text-[8px] sm:text-[9px] py-1 px-3 rounded shadow border-y border-yellow-400/40 text-center truncate uppercase tracking-wide">
                                            ★ {bannerTitle || 'MASTER OF THE FIRST CALL'} ★
                                        </div>

                                        {/* Subtitle / desc */}
                                        <p className="text-[7px] text-slate-500 leading-snug italic text-center max-w-[240px] px-1 line-clamp-2">
                                            {bannerSubTitle || 'for successfully completing the First Call Training Program...'}
                                        </p>

                                        {/* Custom 4 Stats Grid */}
                                        <div className="grid grid-cols-4 gap-1 w-full text-center mt-1">
                                            <div className="flex flex-col items-center p-1 bg-slate-50 border border-slate-100 rounded">
                                                <BookOpen className="w-2.5 h-2.5 text-blue-600 mb-0.5" />
                                                <span className="text-[5px] text-slate-400 font-extrabold uppercase scale-90">Training</span>
                                                <span className="font-extrabold text-[6px] text-blue-950 mt-0.5 truncate w-full">{trainingName}</span>
                                            </div>
                                            <div className="flex flex-col items-center p-1 bg-slate-50 border border-slate-100 rounded">
                                                <Clock className="w-2.5 h-2.5 text-blue-600 mb-0.5" />
                                                <span className="text-[5px] text-slate-400 font-extrabold uppercase scale-90">Duration</span>
                                                <span className="font-extrabold text-[6px] text-blue-950 mt-0.5 truncate w-full">{durationText}</span>
                                            </div>
                                            <div className="flex flex-col items-center p-1 bg-slate-50 border border-slate-100 rounded">
                                                <Award className="w-2.5 h-2.5 text-blue-600 mb-0.5" />
                                                <span className="text-[5px] text-slate-400 font-extrabold uppercase scale-90">Achievement</span>
                                                <span className="font-extrabold text-[6px] text-blue-950 mt-0.5 truncate w-full">{achievementText}</span>
                                            </div>
                                            <div className="flex flex-col items-center p-1 bg-slate-50 border border-slate-100 rounded">
                                                <Calendar className="w-2.5 h-2.5 text-blue-600 mb-0.5" />
                                                <span className="text-[5px] text-slate-400 font-extrabold uppercase scale-90">Issue Date</span>
                                                <span className="font-extrabold text-[6px] text-blue-950 mt-0.5 truncate w-full">{todayStr}</span>
                                            </div>
                                        </div>

                                        {/* Encouragement text */}
                                        <p className="text-[6px] text-slate-400 italic text-center max-w-[240px] px-1 scale-90 leading-tight">
                                            {encouragementText}
                                        </p>

                                        {/* Signatures */}
                                        <div className="w-full flex items-center justify-between border-t border-slate-100 pt-1 text-[7px] px-1 mt-1 shrink-0">
                                            <div className="flex flex-col items-center">
                                                <span className="font-serif italic font-bold text-slate-700 text-[6px]">51Talk Management</span>
                                                <div className="w-10 border-t border-slate-200 my-0.5"></div>
                                                <span className="text-[5px] text-slate-400 font-extrabold scale-90 uppercase">Issued By</span>
                                            </div>

                                            {/* Seal badge mockup */}
                                            <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 border border-yellow-250 flex items-center justify-center text-[4px] font-black text-blue-950 shadow">
                                                ★
                                            </div>

                                            <div className="flex flex-col items-center">
                                                <span className="font-bold text-blue-600 text-[6px] truncate max-w-16">{issuedBy}</span>
                                                <div className="w-10 border-t border-slate-200 my-0.5"></div>
                                                <span className="text-[5px] text-slate-400 font-extrabold scale-90 uppercase">Authorized Signature</span>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
