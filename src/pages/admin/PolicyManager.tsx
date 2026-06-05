import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../services/firebase';
import { 
    FileText, 
    ImageIcon, 
    Video as VideoIcon, 
    Plus, 
    Trash2, 
    Edit2, 
    Eye, 
    EyeOff, 
    Upload, 
    Link2, 
    ArrowUp, 
    ArrowDown, 
    Save, 
    X, 
    AlertCircle,
    Loader2
} from 'lucide-react';

interface PolicyItem {
    id: string;
    title: string;
    description?: string;
    type: 'document' | 'poster' | 'video';
    url: string;
    thumbnailUrl?: string;
    businessType: 'kid' | 'adult' | 'ss' | 'leader' | 'all';
    sortOrder: number;
    visible: boolean;
    createdAt?: any;
    updatedAt?: any;
    updatedBy?: string;
}

export default function PolicyManager() {
    const { t } = useTranslation();
    const { hasPermission, profile } = useAuth();
    
    // State management
    const [policies, setPolicies] = useState<PolicyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    // Form states
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'document' | 'poster' | 'video'>('document');
    const [url, setUrl] = useState('');
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [businessType, setBusinessType] = useState<'kid' | 'adult' | 'ss' | 'leader' | 'all'>('all');
    const [sortOrder, setSortOrder] = useState<number>(0);
    const [visible, setVisible] = useState(true);
    
    // Upload state
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploading, setUploading] = useState(false);

    if (!hasPermission('managePolicies')) {
        return <Navigate to="/admin" replace />;
    }

    const fetchPolicies = async () => {
        setLoading(true);
        setError(null);
        try {
            const q = query(collection(db, 'policies'), orderBy('sortOrder', 'asc'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const data: PolicyItem[] = [];
            snapshot.forEach((doc) => {
                const item = doc.data();
                data.push({
                    id: doc.id,
                    title: item.title || '',
                    description: item.description || '',
                    type: item.type || 'document',
                    url: item.url || '',
                    thumbnailUrl: item.thumbnailUrl || '',
                    businessType: item.businessType || 'all',
                    sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
                    visible: item.visible !== false,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                    updatedBy: item.updatedBy
                });
            });
            setPolicies(data);
        } catch (err: any) {
            console.error("Error fetching policies:", err);
            setError(t('policy_manager.fetch_fail', '获取政策列表失败: ') + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPolicies();
    }, []);

    const resetForm = () => {
        setEditingId(null);
        setTitle('');
        setDescription('');
        setType('document');
        setUrl('');
        setThumbnailUrl('');
        setBusinessType('all');
        setSortOrder(policies.length > 0 ? Math.max(...policies.map(p => p.sortOrder)) + 1 : 1);
        setVisible(true);
        setUploadFile(null);
        setUploadProgress(null);
        setUploading(false);
    };

    useEffect(() => {
        if (!editingId) {
            setSortOrder(policies.length > 0 ? Math.max(...policies.map(p => p.sortOrder)) + 1 : 1);
        }
    }, [policies, editingId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadFile(e.target.files[0]);
        }
    };

    const handleUpload = (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!uploadFile) {
                resolve(url);
                return;
            }
            if (!storage) {
                reject(new Error("Storage is not configured"));
                return;
            }

            setUploading(true);
            setUploadProgress(0);
            const fileRef = ref(storage, `policies/${Date.now()}_${uploadFile.name}`);
            const uploadTask = uploadBytesResumable(fileRef, uploadFile);

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
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        setUploading(false);
                        setUploadFile(null);
                        setUploadProgress(null);
                        resolve(downloadURL);
                    } catch (err) {
                        setUploading(false);
                        reject(err);
                    }
                }
            );
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError(t('policy_manager.title_required', '请输入标题'));
            return;
        }

        setActionLoading(true);
        setError(null);
        setSuccess(null);

        try {
            let finalUrl = url;
            if (uploadFile) {
                finalUrl = await handleUpload();
            }

            if (!finalUrl.trim()) {
                throw new Error(t('policy_manager.url_required', '请上传文件或输入资源链接'));
            }

            const itemData = {
                title: title.trim(),
                description: description.trim(),
                type,
                url: finalUrl.trim(),
                thumbnailUrl: thumbnailUrl.trim(),
                businessType,
                sortOrder: Number(sortOrder) || 0,
                visible,
                updatedAt: serverTimestamp(),
                updatedBy: profile?.crmId || 'admin'
            };

            if (editingId) {
                await updateDoc(doc(db, 'policies', editingId), itemData);
                setSuccess(t('policy_manager.update_success', '保存成功'));
            } else {
                await addDoc(collection(db, 'policies'), {
                    ...itemData,
                    createdAt: serverTimestamp()
                });
                setSuccess(t('policy_manager.create_success', '创建成功'));
            }

            resetForm();
            await fetchPolicies();
        } catch (err: any) {
            console.error("Error saving policy:", err);
            setError(t('policy_manager.save_fail', '保存失败: ') + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleEdit = (item: PolicyItem) => {
        setEditingId(item.id);
        setTitle(item.title);
        setDescription(item.description || '');
        setType(item.type);
        setUrl(item.url);
        setThumbnailUrl(item.thumbnailUrl || '');
        setBusinessType(item.businessType);
        setSortOrder(item.sortOrder);
        setVisible(item.visible);
        setUploadFile(null);
        setUploadProgress(null);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(t('policy_manager.delete_confirm', '确定要删除此政策展示吗？'))) {
            return;
        }

        setActionLoading(true);
        setError(null);
        setSuccess(null);
        try {
            await deleteDoc(doc(db, 'policies', id));
            setSuccess(t('policy_manager.delete_success', '删除成功'));
            await fetchPolicies();
        } catch (err: any) {
            console.error("Error deleting policy:", err);
            setError(t('policy_manager.delete_fail', '删除失败: ') + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleVisible = async (item: PolicyItem) => {
        try {
            await updateDoc(doc(db, 'policies', item.id), {
                visible: !item.visible,
                updatedAt: serverTimestamp(),
                updatedBy: profile?.crmId || 'admin'
            });
            await fetchPolicies();
        } catch (err: any) {
            setError(t('policy_manager.toggle_fail', '状态更新失败: ') + err.message);
        }
    };

    const handleSortOrderChange = async (item: PolicyItem, newSort: number) => {
        try {
            await updateDoc(doc(db, 'policies', item.id), {
                sortOrder: newSort,
                updatedAt: serverTimestamp()
            });
            await fetchPolicies();
        } catch (err: any) {
            setError(t('policy_manager.sort_fail', '排序更新失败: ') + err.message);
        }
    };

    const getTypeIcon = (type: 'document' | 'poster' | 'video') => {
        switch (type) {
            case 'document':
                return <FileText className="h-5 w-5 text-blue-500" />;
            case 'poster':
                return <ImageIcon className="h-5 w-5 text-emerald-500" />;
            case 'video':
                return <VideoIcon className="h-5 w-5 text-red-500" />;
        }
    };

    const getBusinessTypeLabel = (bt: string) => {
        switch (bt) {
            case 'kid': return t('common.type_kid', '青少');
            case 'adult': return t('common.type_adult', '成人');
            case 'ss': return t('common.type_ss', 'SS 业务');
            case 'leader': return t('common.type_leader', 'Leader 学院');
            case 'all': return t('common.all_business', '全部业务线');
            default: return bt;
        }
    };

    return (
        <div className="animate-in fade-in duration-500 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-deep-teal">{t('policy_manager.title', '运营政策与激励展示')}</h1>
                    <p className="text-arabian-night/60 mt-1">{t('policy_manager.desc', '在销售首页展示文档、激励海报或宣导视频，激励团队业绩')}</p>
                </div>
                {editingId && (
                    <button 
                        onClick={resetForm} 
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        {t('policy_manager.new_item', '新增政策')}
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    <span>{success}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Form column (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="glass-panel rounded-2xl p-6 border border-desert-gold/20 bg-white/40 sticky top-8">
                        <h2 className="text-xl font-bold text-deep-teal mb-6 flex items-center gap-2 border-b border-deep-teal/10 pb-3">
                            {editingId ? <Edit2 className="text-desert-gold h-5 w-5" /> : <Plus className="text-desert-gold h-5 w-5" />}
                            {editingId ? t('policy_manager.edit_form_title', '编辑政策') : t('policy_manager.create_form_title', '发布新政策')}
                        </h2>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('policy_manager.form_title', '政策标题')} *</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80"
                                    placeholder={t('policy_manager.title_placeholder', '如：2026年6月GCC销售激励政策')}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    disabled={actionLoading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('policy_manager.form_desc', '政策简介（可选）')}</label>
                                <textarea
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80"
                                    placeholder={t('policy_manager.desc_placeholder', '简短介绍政策或激励内容...')}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={actionLoading}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('policy_manager.form_type', '展示形式')}</label>
                                    <select
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 font-medium"
                                        value={type}
                                        onChange={(e) => setType(e.target.value as any)}
                                        disabled={actionLoading}
                                    >
                                        <option value="document">📄 {t('policy_manager.type_doc', '文档 (PDF/网页)')}</option>
                                        <option value="poster">🖼️ {t('policy_manager.type_poster', '海报 (图片)')}</option>
                                        <option value="video">🎥 {t('policy_manager.type_video', '视频 (MP4)')}</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('common.business_type', '可见业务线')}</label>
                                    <select
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 font-medium"
                                        value={businessType}
                                        onChange={(e) => setBusinessType(e.target.value as any)}
                                        disabled={actionLoading}
                                    >
                                        <option value="all">🌍 {t('common.all_business', '全部业务线')}</option>
                                        <option value="kid">🧒 {t('common.type_kid', '青少')}</option>
                                        <option value="adult">👨 {t('common.type_adult', '成人')}</option>
                                        <option value="ss">💼 {t('common.type_ss', 'SS 业务')}</option>
                                        <option value="leader">🎓 {t('common.type_leader', 'Leader 学院')}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="border border-desert-gold/10 bg-white/20 p-4 rounded-xl space-y-3">
                                <label className="block text-xs font-bold text-deep-teal">{t('policy_manager.file_source', '资源文件设置')}</label>
                                
                                {storage ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-4 bg-white/40 hover:bg-white/60 transition-all cursor-pointer relative group">
                                            <input
                                                type="file"
                                                accept={type === 'poster' ? 'image/*' : type === 'video' ? 'video/mp4' : 'application/pdf,image/*,video/mp4'}
                                                onChange={handleFileChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                disabled={actionLoading || uploading}
                                            />
                                            <div className="text-center space-y-1 text-arabian-night/60">
                                                <Upload className="mx-auto h-8 w-8 text-desert-gold group-hover:scale-110 transition-transform" />
                                                <p className="text-xs font-bold">
                                                    {uploadFile ? uploadFile.name : t('policy_manager.click_to_upload', '点击选择或拖拽文件上传')}
                                                </p>
                                                <p className="text-[10px] text-arabian-night/40">
                                                    {type === 'poster' ? 'Images only' : type === 'video' ? 'MP4 only' : 'PDF, Images, or MP4'}
                                                </p>
                                            </div>
                                        </div>
                                        {uploading && (
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold text-deep-teal">
                                                    <span>Uploading...</span>
                                                    <span>{uploadProgress}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-desert-gold h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-xs text-orange-600 bg-orange-50 border border-orange-100 p-2.5 rounded-lg flex items-center gap-1.5">
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                        <span>Firebase Storage不可用，请直接输入网络链接</span>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1">
                                        <Link2 className="h-3.5 w-3.5 text-deep-teal/70" />
                                        <span className="text-xs font-bold text-deep-teal/80">{t('policy_manager.file_url', '网络资源链接')}</span>
                                    </div>
                                    <input
                                        type="url"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 text-xs"
                                        placeholder="https://example.com/policy.pdf"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        disabled={actionLoading || uploading}
                                    />
                                </div>
                            </div>

                            {type === 'video' && (
                                <div>
                                    <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('policy_manager.thumbnail_url', '视频封面图片链接（可选）')}</label>
                                    <input
                                        type="url"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 text-xs"
                                        placeholder="https://example.com/cover.jpg"
                                        value={thumbnailUrl}
                                        onChange={(e) => setThumbnailUrl(e.target.value)}
                                        disabled={actionLoading}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 border-t border-deep-teal/10 pt-4 mt-2">
                                <div>
                                    <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('policy_manager.sort_order', '排序权重')}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80"
                                        value={sortOrder}
                                        onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                                        disabled={actionLoading}
                                    />
                                </div>

                                <div className="flex flex-col justify-end pb-1.5">
                                    <label className="flex items-center gap-2 cursor-pointer py-2 font-bold text-deep-teal select-none">
                                        <input
                                            type="checkbox"
                                            checked={visible}
                                            onChange={(e) => setVisible(e.target.checked)}
                                            className="w-4 h-4 rounded text-desert-gold focus:ring-desert-gold"
                                            disabled={actionLoading}
                                        />
                                        <span className="text-xs">{t('policy_manager.visible_status', '上架可见')}</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={actionLoading || uploading}
                                    className="flex-1 py-3 bg-deep-teal hover:bg-deep-teal/90 text-white rounded-xl font-bold shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:transform-none"
                                >
                                    {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                    {editingId ? t('common.save', '保存') : t('common.publish', '发布')}
                                </button>
                                
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold transition-all"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* List column (7 cols) */}
                <div className="lg:col-span-7">
                    <div className="glass-panel rounded-2xl p-6 border border-white/40 bg-white/40 min-h-[500px]">
                        <h2 className="text-xl font-bold text-deep-teal mb-6 flex items-center gap-2 border-b border-deep-teal/10 pb-3">
                            {t('policy_manager.list_title', '已发布政策列表')} ({policies.length})
                        </h2>

                        {loading ? (
                            <div className="flex justify-center py-24">
                                <Loader2 className="animate-spin rounded-full h-8 w-8 text-desert-gold" />
                            </div>
                        ) : policies.length === 0 ? (
                            <div className="text-center py-24 text-arabian-night/40">
                                <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                                <p className="font-medium">{t('policy_manager.no_policies', '暂无政策展示，在左侧表单发布第一条政策吧')}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {policies.map((item, index) => (
                                    <div 
                                        key={item.id} 
                                        className={`p-4 rounded-xl border transition-all ${
                                            item.visible 
                                                ? 'bg-white/70 border-white hover:border-desert-gold/30 shadow-sm hover:shadow-md' 
                                                : 'bg-gray-50/70 border-gray-200 opacity-60'
                                        }`}
                                    >
                                        <div className="flex gap-3">
                                            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100 shrink-0 self-start">
                                                {getTypeIcon(item.type)}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-bold text-base text-arabian-night truncate max-w-[220px] xs:max-w-xs">{item.title}</h3>
                                                    <span className="text-[10px] px-2 py-0.5 bg-deep-teal/10 text-deep-teal font-bold rounded-full">
                                                        {getBusinessTypeLabel(item.businessType)}
                                                    </span>
                                                    {!item.visible && (
                                                        <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-500 font-bold rounded-full flex items-center gap-1">
                                                            <EyeOff className="h-3 w-3" />
                                                            {t('policy_manager.invisible', '隐藏')}
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                {item.description && (
                                                    <p className="text-xs text-arabian-night/60 mt-1 line-clamp-2">{item.description}</p>
                                                )}
                                                
                                                <div className="flex items-center gap-3 mt-3 text-[10px] text-arabian-night/40 font-semibold truncate">
                                                    <span>Order: {item.sortOrder}</span>
                                                    <span>•</span>
                                                    <a 
                                                        href={item.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="text-desert-gold hover:underline flex items-center gap-0.5"
                                                    >
                                                        <Link2 className="h-3 w-3" />
                                                        {t('policy_manager.view_source', '查看资源')}
                                                    </a>
                                                    {item.updatedBy && (
                                                        <>
                                                            <span>•</span>
                                                            <span>By: {item.updatedBy}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Actions */}
                                            <div className="flex flex-col gap-1 items-end self-start shrink-0">
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={() => handleToggleVisible(item)}
                                                        className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
                                                        title={item.visible ? t('policy_manager.hide', '隐藏') : t('policy_manager.show', '显示')}
                                                    >
                                                        {item.visible ? <Eye className="h-4 w-4 text-deep-teal" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                                                    </button>
                                                    
                                                    <button 
                                                        onClick={() => handleEdit(item)}
                                                        className="p-2 hover:bg-white text-yellow-600 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                                                        title={t('common.edit', '编辑')}
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    
                                                    <button 
                                                        onClick={() => handleDelete(item.id)}
                                                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-200"
                                                        title={t('common.delete', '删除')}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                
                                                {/* Sorting helpers */}
                                                <div className="flex gap-1 mt-1">
                                                    <button 
                                                        onClick={() => handleSortOrderChange(item, item.sortOrder - 1)}
                                                        disabled={index === 0}
                                                        className="p-1.5 hover:bg-white text-gray-500 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
                                                        title="Move Up"
                                                    >
                                                        <ArrowUp className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleSortOrderChange(item, item.sortOrder + 1)}
                                                        disabled={index === policies.length - 1}
                                                        className="p-1.5 hover:bg-white text-gray-500 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
                                                        title="Move Down"
                                                    >
                                                        <ArrowDown className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
