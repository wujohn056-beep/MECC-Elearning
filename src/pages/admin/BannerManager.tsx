import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../services/firebase';
import { Plus, Trash2, Edit2, Save, X, Upload, CheckCircle2, AlertCircle, Image, Sliders, ToggleLeft, ToggleRight } from 'lucide-react';

interface Banner {
    id: string;
    imageUrl: string;
    title: string;
    categoryId: string;
    categoryName: string;
    ownerSm: string;
    ownerSmName: string;
    linkedTaskId?: string;
    linkedTaskTitle?: string;
    active: boolean;
    createdAt?: any;
}

interface Category {
    id: string;
    name: string;
    businessType?: string;
}

interface LearningTask {
    id: string;
    title: string;
    assignerId: string;
    assignerName: string;
}

interface SmUser {
    crmId: string;
    name: string;
}

export default function BannerManager() {
    const { t } = useTranslation();
    const { hasPermission, profile, user } = useAuth();
    
    // Check permission
    if (!hasPermission('manageBanners')) {
        return <Navigate to="/admin" replace />;
    }

    const isSuperAdmin = profile?.role === 'super_admin';
    const isSd = profile?.role === 'sd';
    const isSm = profile?.role === 'sm';

    // State lists
    const [banners, setBanners] = useState<Banner[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [tasks, setTasks] = useState<LearningTask[]>([]);
    const [smList, setSmList] = useState<SmUser[]>([]);

    // Loading states
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // Form inputs
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formCategoryId, setFormCategoryId] = useState('');
    const [formLinkedTaskId, setFormLinkedTaskId] = useState('');
    const [formActive, setFormActive] = useState(true);
    const [formOwnerSm, setFormOwnerSm] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // Feedback states
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    // Fetch lists
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch categories
            const catSnapshot = await getDocs(query(collection(db, 'categories'), orderBy('name')));
            const catData: Category[] = [];
            catSnapshot.forEach(doc => {
                catData.push({ id: doc.id, ...doc.data() });
            });
            setCategories(catData);

            // 2. Fetch learning tasks
            // If super admin or SD, fetch all tasks. If SM, only fetch tasks they assigned.
            let taskQuery = query(collection(db, 'learning_tasks'), orderBy('createdAt', 'desc'));
            if (isSm && user) {
                taskQuery = query(
                    collection(db, 'learning_tasks'),
                    where('assignerId', '==', user.uid)
                );
            }
            const taskSnapshot = await getDocs(taskQuery);
            const taskData: LearningTask[] = [];
            taskSnapshot.forEach(doc => {
                const data = doc.data();
                taskData.push({
                    id: doc.id,
                    title: data.title || '',
                    assignerId: data.assignerId || '',
                    assignerName: data.assignerName || ''
                });
            });
            setTasks(taskData);

            // 3. Fetch SM list (for Super Admin or SD to assign banner ownership)
            if (isSuperAdmin || isSd) {
                const userSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'sm')));
                const smData: SmUser[] = [];
                userSnapshot.forEach(doc => {
                    const data = doc.data();
                    smData.push({
                        crmId: data.crmId || '',
                        name: data.name || data.crmId || ''
                    });
                });
                // Remove duplicates just in case
                const uniqueSm = smData.filter((v, i, a) => a.findIndex(t => t.crmId === v.crmId) === i);
                setSmList(uniqueSm);
            }

            // 4. Fetch banners
            // If SM, only see their own banners. If Super Admin/SD, see all banners.
            let bannerQuery = query(collection(db, 'banners'), orderBy('createdAt', 'desc'));
            if (isSm && profile) {
                bannerQuery = query(
                    collection(db, 'banners'),
                    where('ownerSm', '==', profile.crmId)
                );
            }
            const bannerSnapshot = await getDocs(bannerQuery);
            const bannerData: Banner[] = [];
            bannerSnapshot.forEach(doc => {
                const data = doc.data();
                bannerData.push({
                    id: doc.id,
                    imageUrl: data.imageUrl || '',
                    title: data.title || '',
                    categoryId: data.categoryId || '',
                    categoryName: data.categoryName || '',
                    ownerSm: data.ownerSm || '',
                    ownerSmName: data.ownerSmName || '',
                    linkedTaskId: data.linkedTaskId || '',
                    linkedTaskTitle: data.linkedTaskTitle || '',
                    active: data.active !== false,
                    createdAt: data.createdAt
                });
            });
            setBanners(bannerData);
        } catch (err: any) {
            console.error("Error fetching data:", err);
            setError(`${t('common.load_fail')} ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user, profile]);

    // Handle form reset
    const resetForm = () => {
        setEditingId(null);
        setFormTitle('');
        setFormCategoryId('');
        setFormLinkedTaskId('');
        setFormActive(true);
        setFormOwnerSm(isSm ? (profile?.crmId || '') : 'global');
        setSelectedFile(null);
        setImagePreview(null);
        setUploadProgress(null);
        setUploading(false);
        setShowForm(false);
    };

    // Handle Edit initiation
    const handleEdit = (banner: Banner) => {
        setEditingId(banner.id);
        setFormTitle(banner.title);
        setFormCategoryId(banner.categoryId);
        setFormLinkedTaskId(banner.linkedTaskId || '');
        setFormActive(banner.active);
        setFormOwnerSm(banner.ownerSm || 'global');
        setImagePreview(banner.imageUrl);
        setSelectedFile(null);
        setShowForm(true);
    };

    // Handle Image file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    // Helper: Upload file to storage
    const uploadImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            setUploading(true);
            setUploadProgress(0);
            const fileRef = storageRef(storage, `banners/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(fileRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(Math.round(progress));
                },
                (error) => {
                    setUploading(false);
                    reject(error);
                },
                async () => {
                    const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                    setUploading(false);
                    setUploadProgress(null);
                    resolve(downloadUrl);
                }
            );
        });
    };

    // Handle Submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        // Validation
        if (!formTitle.trim()) {
            setError(t('banner_manager.title_required', '请输入标题'));
            return;
        }
        if (!formCategoryId) {
            setError(t('banner_manager.category_required', '请选择关联分类'));
            return;
        }
        if (!editingId && !selectedFile) {
            setError(t('banner_manager.image_required', '请选择海报图片'));
            return;
        }

        setActionLoading(true);
        try {
            let finalImageUrl = imagePreview || '';

            // 1. Upload new image if selected
            if (selectedFile) {
                finalImageUrl = await uploadImage(selectedFile);
            }

            // Get category name
            const cat = categories.find(c => c.id === formCategoryId);
            const categoryName = cat ? cat.name : '';

            // Get linked task title
            const taskObj = tasks.find(t => t.id === formLinkedTaskId);
            const linkedTaskTitle = taskObj ? taskObj.title : '';

            const ownerSmName = formOwnerSm === 'global' ? 'global' : formOwnerSm;

            const bannerData: any = {
                title: formTitle.trim(),
                imageUrl: finalImageUrl,
                categoryId: formCategoryId,
                categoryName: categoryName,
                linkedTaskId: formLinkedTaskId || '',
                linkedTaskTitle: linkedTaskTitle || '',
                ownerSm: formOwnerSm,
                ownerSmName: ownerSmName,
                active: formActive,
            };

            if (editingId) {
                // Update
                const docRef = doc(db, 'banners', editingId);
                await updateDoc(docRef, bannerData);
                setSuccess(t('banner_manager.save_success', '保存 Banner 成功！'));
            } else {
                // Create
                bannerData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'banners'), bannerData);
                setSuccess(t('banner_manager.save_success', '保存 Banner 成功！'));
            }

            resetForm();
            await fetchData();
        } catch (err: any) {
            console.error("Save error:", err);
            setError(`${t('common.process_fail')} ${err.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    // Toggle Active Status directly
    const toggleActive = async (banner: Banner) => {
        setError(null);
        setSuccess(null);
        try {
            const docRef = doc(db, 'banners', banner.id);
            await updateDoc(docRef, { active: !banner.active });
            setBanners(banners.map(b => b.id === banner.id ? { ...b, active: !banner.active } : b));
            setSuccess(t('banner_manager.save_success'));
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Handle Delete
    const handleDelete = async (banner: Banner) => {
        if (!window.confirm(t('banner_manager.delete_confirm', '确定要删除此 Banner 吗？'))) {
            return;
        }

        setError(null);
        setSuccess(null);
        setActionLoading(true);

        try {
            // 1. Delete image from Storage if exists
            if (banner.imageUrl) {
                try {
                    const fileRef = storageRef(storage, banner.imageUrl);
                    await deleteObject(fileRef);
                } catch (storageErr) {
                    console.warn("Storage deletion warning (might not exist or direct link):", storageErr);
                }
            }

            // 2. Delete document from Firestore
            await deleteDoc(doc(db, 'banners', banner.id));
            setSuccess(t('banner_manager.delete_success', '删除 Banner 成功！'));
            await fetchData();
        } catch (err: any) {
            console.error("Delete error:", err);
            setError(`${t('common.delete_fail')} ${err.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Title Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200/50">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-deep-teal flex items-center gap-2">
                        <Sliders className="w-6 h-6 text-desert-gold" />
                        {t('banner_manager.title', 'Banner 海报管理')}
                    </h1>
                    <p className="text-xs font-semibold text-arabian-night/50 mt-1">
                        {t('banner_manager.subtitle', '设置和管理首页的滚动 Banner 模块。SM 可以维护自己团队的 Banner，并关联学习任务或业务分类。')}
                    </p>
                </div>
                {!showForm && (
                    <button
                        onClick={() => {
                            resetForm();
                            setShowForm(true);
                        }}
                        className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-deep-teal to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white rounded-xl font-bold transition-all shadow-md active:scale-95 text-sm cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        {t('banner_manager.upload_banner', '上传新 Banner')}
                    </button>
                )}
            </div>

            {/* Error and Success Banners */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-600 rounded-xl flex items-center gap-3 text-sm font-bold animate-in fade-in duration-300">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 text-green-600 rounded-xl flex items-center gap-3 text-sm font-bold animate-in fade-in duration-300">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>{success}</span>
                </div>
            )}

            {/* Form Section */}
            {showForm && (
                <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md shadow-lg space-y-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-deep-teal flex items-center gap-2">
                            <Plus className="w-5 h-5 text-desert-gold" />
                            {editingId ? t('banner_manager.edit_banner', '编辑 Banner') : t('banner_manager.upload_banner', '上传新 Banner')}
                        </h3>
                        <button
                            type="button"
                            onClick={resetForm}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column: Image Uploader */}
                        <div className="space-y-3">
                            <label className="block text-xs font-black text-arabian-night/70 uppercase tracking-wider mb-1.5">
                                {t('common.attachments', '海报图片')} <span className="text-red-500">*</span>
                            </label>
                            
                            <div className="relative group border-2 border-dashed border-gray-300 hover:border-desert-gold rounded-xl overflow-hidden bg-white/50 hover:bg-white/80 transition-all aspect-[21/9] flex flex-col items-center justify-center p-4">
                                {imagePreview ? (
                                    <>
                                        <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <label className="px-4 py-2 bg-white/90 hover:bg-white text-deep-teal font-extrabold rounded-lg text-xs cursor-pointer shadow-md transition-all active:scale-95">
                                                <Upload className="w-3.5 h-3.5 inline mr-1" />
                                                {t('common.choose_file', '更换图片')}
                                                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                            </label>
                                        </div>
                                    </>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer py-6">
                                        <Image className="w-10 h-10 text-gray-400 group-hover:text-desert-gold transition-colors mb-2" />
                                        <span className="text-xs font-bold text-gray-500 group-hover:text-desert-gold transition-colors">
                                            {t('banner_manager.select_image', '选择 Banner 海报图片')}
                                        </span>
                                        <span className="text-[10px] text-gray-400 mt-1">
                                            (Recommended aspect ratio: 21:9 or 16:7)
                                        </span>
                                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                    </label>
                                )}
                            </div>

                            {uploading && uploadProgress !== null && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-bold text-gray-500">
                                        <span>{t('banner_manager.uploading', '正在上传海报图片...')}</span>
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                        <div className="bg-desert-gold h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Settings */}
                        <div className="space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-xs font-black text-arabian-night/70 uppercase tracking-wider mb-1.5">
                                    {t('banner_manager.banner_title', 'Banner 标题')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder={t('banner_manager.banner_title')}
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-desert-gold/15 focus:border-desert-gold font-bold text-sm bg-white/80"
                                />
                            </div>

                            {/* Category Selector */}
                            <div>
                                <label className="block text-xs font-black text-arabian-night/70 uppercase tracking-wider mb-1.5">
                                    {t('banner_manager.link_category', '关联学习分类')} <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formCategoryId}
                                    onChange={(e) => setFormCategoryId(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-desert-gold/15 focus:border-desert-gold font-bold text-sm bg-white/80"
                                >
                                    <option value="">{t('banner_manager.select_category_placeholder', '-- 选择学习分类 --')}</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name} ({cat.businessType ? t(`common.type_${cat.businessType}`) : ''})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Linked Task Selector */}
                            <div>
                                <label className="block text-xs font-black text-arabian-night/70 uppercase tracking-wider mb-1.5">
                                    {t('banner_manager.link_task', '关联学习任务 (可选)')}
                                </label>
                                <select
                                    value={formLinkedTaskId}
                                    onChange={(e) => setFormLinkedTaskId(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-desert-gold/15 focus:border-desert-gold font-bold text-sm bg-white/80"
                                >
                                    <option value="">{t('banner_manager.no_task', '无关联任务')}</option>
                                    {tasks.map((task) => (
                                        <option key={task.id} value={task.id}>
                                            {task.title} (by {task.assignerName})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Owner SM Selector (Only for Super Admin or SD) */}
                            {(isSuperAdmin || isSd) && (
                                <div>
                                    <label className="block text-xs font-black text-arabian-night/70 uppercase tracking-wider mb-1.5">
                                        {t('banner_manager.scope', '可见团队/范围')}
                                    </label>
                                    <select
                                        value={formOwnerSm}
                                        onChange={(e) => setFormOwnerSm(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-desert-gold/15 focus:border-desert-gold font-bold text-sm bg-white/80"
                                    >
                                        <option value="global">{t('banner_manager.all_teams', '全局 / 所有团队')}</option>
                                        {smList.map((smUser) => (
                                            <option key={smUser.crmId} value={smUser.crmId}>
                                                {t('banner_manager.team_exclusive', { sm: smUser.name })}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Active Switch */}
                            <div className="flex items-center justify-between p-3 bg-white/50 border border-gray-200/50 rounded-xl">
                                <span className="text-xs font-black text-arabian-night/70 uppercase tracking-wider">
                                    {t('banner_manager.active', '启用状态')}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setFormActive(!formActive)}
                                    className="text-deep-teal hover:text-teal-700 transition-colors focus:outline-none cursor-pointer"
                                >
                                    {formActive ? (
                                        <ToggleRight className="w-10 h-10 text-desert-gold" />
                                    ) : (
                                        <ToggleLeft className="w-10 h-10 text-gray-400" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Actions Form buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200/50">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="px-6 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-xl font-bold transition-all text-sm cursor-pointer"
                            disabled={actionLoading || uploading}
                        >
                            {t('common.cancel', '取消')}
                        </button>
                        <button
                            type="submit"
                            className="px-8 py-2.5 bg-gradient-to-r from-desert-gold to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-deep-teal rounded-xl font-bold transition-all shadow-md active:scale-95 text-sm cursor-pointer"
                            disabled={actionLoading || uploading}
                        >
                            {actionLoading ? t('banner_manager.saving', '保存中...') : t('common.submit', '提交')}
                        </button>
                    </div>
                </form>
            )}

            {/* List and Grid section */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-desert-gold"></div>
                    <span className="text-sm font-semibold text-arabian-night/50">{t('common.loading')}</span>
                </div>
            ) : banners.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-white/30 backdrop-blur-sm rounded-2xl border border-white/40 p-8 shadow-sm">
                    <Image className="w-12 h-12 text-gray-300 mb-3" />
                    <h3 className="text-base font-extrabold text-arabian-night/70">{t('banner_manager.no_banners', '暂无配置 Banner，去上传一个吧！')}</h3>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {banners.map((banner) => (
                        <div
                            key={banner.id}
                            className={`glass-panel rounded-2xl overflow-hidden border bg-white/40 border-white/60 shadow-md hover:shadow-lg transition-all flex flex-col relative ${
                                !banner.active ? 'opacity-65' : ''
                            }`}
                        >
                            {/* Aspect-Ratio Box for Image */}
                            <div className="relative aspect-[21/9] w-full bg-gray-100 overflow-hidden">
                                <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
                                
                                {/* Badge for active/inactive */}
                                <span className={`absolute top-3 right-3 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border shadow-sm ${
                                    banner.active 
                                        ? 'bg-green-150 text-green-700 border-green-200' 
                                        : 'bg-gray-150 text-gray-600 border-gray-200'
                                }`}>
                                    {banner.active ? t('banner_manager.active', 'Active') : t('banner_manager.inactive', 'Inactive')}
                                </span>

                                {/* Scope / Owner Badge */}
                                <span className="absolute bottom-3 left-3 text-[10px] font-black bg-deep-teal/80 text-desert-gold px-2.5 py-1 rounded-md backdrop-blur-sm border border-white/10 uppercase tracking-wider">
                                    {banner.ownerSm === 'global' ? t('banner_manager.global_banner') : `${t('banner_manager.team_banner')}: ${banner.ownerSmName}`}
                                </span>
                            </div>

                            {/* Banner details */}
                            <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                                <div className="space-y-1.5">
                                    <h4 className="text-sm font-extrabold text-deep-teal line-clamp-1">
                                        {banner.title}
                                    </h4>
                                    
                                    <div className="flex flex-wrap gap-1.5">
                                        {/* Category Badge */}
                                        <span className="text-[10px] font-bold bg-white/80 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md">
                                            {t('banner_manager.category')}: <strong className="text-gray-800">{banner.categoryName}</strong>
                                        </span>
                                        
                                        {/* Task Badge */}
                                        {banner.linkedTaskId && (
                                            <span className="text-[10px] font-bold bg-desert-gold/15 border border-desert-gold/30 text-amber-800 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                                                <span>🎯</span>
                                                <span>{t('banner_manager.task')}: <strong className="text-amber-900">{banner.linkedTaskTitle}</strong></span>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Form actions */}
                                <div className="flex items-center justify-between pt-3 border-t border-gray-150/60">
                                    <button
                                        onClick={() => toggleActive(banner)}
                                        className="text-xs font-bold text-gray-500 hover:text-deep-teal flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                        {banner.active ? (
                                            <>
                                                <ToggleRight className="w-5 h-5 text-desert-gold" />
                                                <span>{t('banner_manager.active')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <ToggleLeft className="w-5 h-5 text-gray-400" />
                                                <span>{t('banner_manager.inactive')}</span>
                                            </>
                                        )}
                                    </button>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleEdit(banner)}
                                            className="p-2 bg-white/70 hover:bg-desert-gold hover:text-deep-teal border border-gray-200 text-gray-600 rounded-lg transition-all cursor-pointer active:scale-95"
                                            title={t('common.edit', '编辑')}
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(banner)}
                                            className="p-2 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-200 text-red-500 rounded-lg transition-all cursor-pointer active:scale-95"
                                            title={t('common.delete', '删除')}
                                            disabled={actionLoading}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
