import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../services/firebase';
import { 
    FileText, 
    Image as ImageIcon, 
    Video as VideoIcon, 
    Music,
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
    Loader2,
    Folder,
    FolderPlus,
    ChevronRight,
    ChevronDown
} from 'lucide-react';

interface ReferralCategory {
    id: string;
    name: string;
    parentId: string | null;
    sortOrder: number;
    createdAt?: any;
}

interface ReferralMaterial {
    id: string;
    categoryId: string | null;
    title: string;
    description?: string;
    type: 'document' | 'audio' | 'video' | 'image';
    url: string;
    sortOrder: number;
    visible: boolean;
    createdAt?: any;
}

interface NestedCategoryOption {
    id: string;
    name: string;
    level: number;
}

export default function ReferralManager() {
    const { t } = useTranslation();
    const { hasPermission, isSuperAdmin } = useAuth();
    
    // Guard access
    if (!hasPermission('manageReferrals')) {
        return <Navigate to="/admin" replace />;
    }

    // State for Active Tab
    const [activeTab, setActiveTab] = useState<'materials' | 'categories'>('materials');
    
    // Data lists
    const [categories, setCategories] = useState<ReferralCategory[]>([]);
    const [materials, setMaterials] = useState<ReferralMaterial[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Alert feedback
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Material Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'document' | 'audio' | 'video' | 'image'>('document');
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [url, setUrl] = useState('');
    const [visible, setVisible] = useState(true);
    
    // Upload State
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploading, setUploading] = useState(false);

    // Category Form State
    const [editingDirId, setEditingDirId] = useState<string | null>(null);
    const [dirName, setDirName] = useState('');
    const [dirParentId, setDirParentId] = useState<string | null>(null);

    // Load Data
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            // 1. Fetch categories
            const catSnapshot = await getDocs(collection(db, 'referral_categories'));
            const catList: ReferralCategory[] = [];
            catSnapshot.forEach((d) => {
                const data = d.data();
                catList.push({
                    id: d.id,
                    name: data.name || '',
                    parentId: data.parentId || null,
                    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0
                });
            });
            setCategories(catList);

            // 2. Fetch materials
            const matSnapshot = await getDocs(collection(db, 'referral_materials'));
            const matList: ReferralMaterial[] = [];
            matSnapshot.forEach((d) => {
                const data = d.data();
                matList.push({
                    id: d.id,
                    categoryId: data.categoryId || null,
                    title: data.title || '',
                    description: data.description || '',
                    type: data.type || 'document',
                    url: data.url || '',
                    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
                    visible: data.visible !== false
                });
            });
            // Default sort by sortOrder asc
            matList.sort((a, b) => a.sortOrder - b.sortOrder);
            setMaterials(matList);

            setLoading(false);
        } catch (err: any) {
            console.error("Error fetching referral data:", err);
            setError(err.message);
            setLoading(false);
        }
    };

    // Auto-clear feedback messages
    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess(null);
                setError(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    // Build indented hierarchy categories for select menu
    const nestedCatOptions = useMemo(() => {
        const map: { [id: string]: ReferralCategory[] } = {};
        const roots: ReferralCategory[] = [];
        
        categories.forEach(c => {
            if (c.parentId) {
                if (!map[c.parentId]) map[c.parentId] = [];
                map[c.parentId].push(c);
            } else {
                roots.push(c);
            }
        });

        const result: NestedCategoryOption[] = [];
        
        function traverse(node: ReferralCategory, level: number) {
            result.push({
                id: node.id,
                name: node.name,
                level: level
            });
            const children = map[node.id];
            if (children) {
                children.sort((a, b) => a.sortOrder - b.sortOrder);
                children.forEach(child => traverse(child, level + 1));
            }
        }
        
        roots.sort((a, b) => a.sortOrder - b.sortOrder);
        roots.forEach(root => traverse(root, 0));
        return result;
    }, [categories]);

    // Upload selected file directly to storage
    const uploadSelectedFile = (file: File) => {
        if (!storage) {
            setError("Firebase Storage is not initialized.");
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setError(null);
        setSuccess(null);

        const fileRef = ref(storage, `referrals/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(Math.round(progress));
            }, 
            (err) => {
                setUploading(false);
                setError(err.message);
                setUploadProgress(null);
                setUploadFile(null);
            }, 
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    setUploading(false);
                    setUrl(downloadURL);
                    setUploadProgress(null);
                    setUploadFile(null);
                    setUploadedFileName(file.name);
                    setSuccess(t('referral_manager.upload_success', '文件上传成功！'));
                } catch (err: any) {
                    setUploading(false);
                    setError(err.message);
                    setUploadProgress(null);
                    setUploadFile(null);
                }
            }
        );
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUploadFile(file);
            setUploadedFileName(null);
            uploadSelectedFile(file);
        }
    };

    const handleMaterialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !url.trim()) {
            setError(t('referral_manager.form_required', '请填写标题并上传文件/填写链接！'));
            return;
        }

        setActionLoading(true);
        try {
            // Find max sortOrder to append to end if new
            const maxOrder = materials.reduce((max, item) => item.sortOrder > max ? item.sortOrder : max, 0);
            
            const matData = {
                title: title.trim(),
                description: description.trim(),
                type: type,
                categoryId: categoryId || null,
                url: url.trim(),
                visible: visible,
                sortOrder: editingId ? (materials.find(m => m.id === editingId)?.sortOrder || 0) : (maxOrder + 10),
                updatedAt: serverTimestamp()
            };

            if (editingId) {
                await updateDoc(doc(db, 'referral_materials', editingId), matData);
                setSuccess(t('referral_manager.save_success', '保存素材成功！'));
            } else {
                await addDoc(collection(db, 'referral_materials'), {
                    ...matData,
                    createdAt: serverTimestamp()
                });
                setSuccess(t('referral_manager.add_success', '添加素材成功！'));
            }

            // Reset form
            resetMaterialForm();
            await fetchData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const resetMaterialForm = () => {
        setEditingId(null);
        setTitle('');
        setDescription('');
        setType('document');
        setCategoryId(null);
        setUrl('');
        setVisible(true);
        setUploadFile(null);
        setUploadedFileName(null);
    };

    const handleEditMaterial = (item: ReferralMaterial) => {
        setEditingId(item.id);
        setTitle(item.title);
        setDescription(item.description || '');
        setType(item.type);
        setCategoryId(item.categoryId);
        setUrl(item.url);
        setVisible(item.visible);
        setUploadedFileName(null);
    };

    const handleDeleteMaterial = async (id: string, fileUrl: string) => {
        if (!window.confirm(t('referral_manager.delete_confirm', '确定要删除此素材吗？'))) return;
        
        setActionLoading(true);
        try {
            // Attempt to delete file from Storage if it's hosted there
            if (storage && fileUrl && fileUrl.includes('firebasestorage.googleapis.com')) {
                try {
                    const fileRef = ref(storage, fileUrl);
                    await deleteObject(fileRef);
                } catch (storageErr) {
                    console.warn("Storage deletion error (file might already be deleted):", storageErr);
                }
            }

            await deleteDoc(doc(db, 'referral_materials', id));
            setSuccess(t('referral_manager.delete_success', '素材删除成功！'));
            await fetchData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Category Operations
    const handleCategorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dirName.trim()) return;

        setActionLoading(true);
        try {
            const maxOrder = categories.reduce((max, item) => item.sortOrder > max ? item.sortOrder : max, 0);

            // Avoid cyclic nesting
            if (editingDirId && dirParentId) {
                let currentId: string | null = dirParentId;
                while (currentId) {
                    if (currentId === editingDirId) {
                        setError(t('referral_manager.dir_cyclic_error', '不能将文件夹的上级目录设为它自己或它的子目录！'));
                        setActionLoading(false);
                        return;
                    }
                    const parent = categories.find(c => c.id === currentId);
                    currentId = parent ? parent.parentId : null;
                }
            }

            const catData = {
                name: dirName.trim(),
                parentId: dirParentId || null,
                sortOrder: editingDirId ? (categories.find(c => c.id === editingDirId)?.sortOrder || 0) : (maxOrder + 10)
            };

            if (editingDirId) {
                await updateDoc(doc(db, 'referral_categories', editingDirId), catData);
                setSuccess(t('referral_manager.cat_save_success', '保存分类成功！'));
            } else {
                await addDoc(collection(db, 'referral_categories'), {
                    ...catData,
                    createdAt: serverTimestamp()
                });
                setSuccess(t('referral_manager.cat_add_success', '添加分类成功！'));
            }

            // Reset category form
            setEditingDirId(null);
            setDirName('');
            setDirParentId(null);
            
            await fetchData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleEditCategory = (item: ReferralCategory) => {
        setEditingDirId(item.id);
        setDirName(item.name);
        setDirParentId(item.parentId);
    };

    const handleDeleteCategory = async (id: string) => {
        const hasSubdirs = categories.some(c => c.parentId === id);
        const hasFiles = materials.some(m => m.categoryId === id);

        if (hasSubdirs || hasFiles) {
            if (!window.confirm(t('referral_manager.cat_delete_warning', '该分类下包含子分类或推荐素材。删除该分类会将它们移动到根目录。确定要删除该分类吗？'))) {
                return;
            }
        } else {
            if (!window.confirm(t('referral_manager.cat_delete_confirm', '确定要删除此分类目录吗？'))) return;
        }

        setActionLoading(true);
        try {
            // Move subfolders & files to parent level or root
            const currentDir = categories.find(c => c.id === id);
            const parentIdOfDeleted = currentDir?.parentId || null;

            // Update files under this directory to parentId
            const filesToUpdate = materials.filter(m => m.categoryId === id);
            for (const fileItem of filesToUpdate) {
                await updateDoc(doc(db, 'referral_materials', fileItem.id), { categoryId: parentIdOfDeleted });
            }

            // Update sub-directories parentId
            const subdirsToUpdate = categories.filter(c => c.parentId === id);
            for (const dirItem of subdirsToUpdate) {
                await updateDoc(doc(db, 'referral_categories', dirItem.id), { parentId: parentIdOfDeleted });
            }

            // Delete doc
            await deleteDoc(doc(db, 'referral_categories', id));
            setSuccess(t('referral_manager.cat_delete_success', '分类删除成功！'));
            await fetchData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Sort order shifts
    const handleMoveMaterial = async (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= materials.length) return;

        const current = materials[index];
        const sibling = materials[targetIndex];

        setActionLoading(true);
        try {
            // Swap sortOrder
            const tempOrder = current.sortOrder;
            await updateDoc(doc(db, 'referral_materials', current.id), { sortOrder: sibling.sortOrder });
            await updateDoc(doc(db, 'referral_materials', sibling.id), { sortOrder: tempOrder });
            
            await fetchData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= nestedCatOptions.length) return;

        const currentId = nestedCatOptions[index].id;
        const siblingId = nestedCatOptions[targetIndex].id;

        const current = categories.find(c => c.id === currentId);
        const sibling = categories.find(c => c.id === siblingId);

        if (!current || !sibling) return;

        setActionLoading(true);
        try {
            // Swap sortOrder
            const tempOrder = current.sortOrder;
            await updateDoc(doc(db, 'referral_categories', current.id), { sortOrder: sibling.sortOrder });
            await updateDoc(doc(db, 'referral_categories', sibling.id), { sortOrder: tempOrder });
            
            await fetchData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Helper functions
    const getCategoryPathName = (catId: string | null): string => {
        if (!catId) return '/';
        const trail: string[] = [];
        let current = categories.find(c => c.id === catId);
        while (current) {
            trail.unshift(current.name);
            current = current.parentId ? categories.find(c => c.id === current.parentId) : undefined;
        }
        return trail.join(' > ');
    };

    const getMaterialIcon = (matType: string) => {
        switch (matType) {
            case 'audio': return <Music className="w-4 h-4 text-emerald-500" />;
            case 'video': return <VideoIcon className="w-4 h-4 text-rose-500" />;
            case 'image': return <ImageIcon className="w-4 h-4 text-amber-500" />;
            default: return <FileText className="w-4 h-4 text-blue-500" />;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="h-10 w-10 text-desert-gold animate-spin" />
                <p className="text-sm text-arabian-night/60 font-semibold">{t('common.loading')}</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500 space-y-6 pb-10">
            {/* Header info */}
            <div>
                <h1 className="text-3xl font-black text-deep-teal tracking-tight">{t('referral_manager.title', '推荐业务素材管理')}</h1>
                <p className="text-arabian-night/60 text-sm mt-1">{t('referral_manager.desc', '面向CC与SS团队的推荐业务素材、规则文件、案例音频/视频的上传与层级目录配置中心。')}</p>
            </div>

            {/* Success / Error alerts */}
            {success && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 text-sm font-semibold rounded-2xl animate-in slide-in-from-top-2 duration-300">
                    👍 {success}
                </div>
            )}
            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/25 text-rose-800 text-sm font-semibold rounded-2xl flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Tab switchers */}
            <div className="flex gap-2.5 p-1 bg-white/70 backdrop-blur-md rounded-full border border-white/50 w-fit shadow-sm">
                <button
                    onClick={() => { setActiveTab('materials'); setError(null); }}
                    className={`px-6 py-2 rounded-full text-xs font-black transition-all cursor-pointer ${
                        activeTab === 'materials' 
                            ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow' 
                            : 'text-arabian-night/70 hover:text-arabian-night'
                    }`}
                >
                    📁 {t('referral_manager.tab_materials', '推荐素材管理')}
                </button>
                <button
                    onClick={() => { setActiveTab('categories'); setError(null); }}
                    className={`px-6 py-2 rounded-full text-xs font-black transition-all cursor-pointer ${
                        activeTab === 'categories' 
                            ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow' 
                            : 'text-arabian-night/70 hover:text-arabian-night'
                    }`}
                >
                    🌿 {t('referral_manager.tab_categories', '目录结构维护')}
                </button>
            </div>

            {/* Main Content Area */}
            {activeTab === 'materials' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Form: Add / Edit Material */}
                    <div className="glass-panel p-6 border border-white/60 h-fit rounded-3xl space-y-5">
                        <h3 className="text-lg font-black text-deep-teal border-b border-gray-100 pb-3 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-desert-gold" />
                            {editingId ? t('referral_manager.edit_material', '修改推荐素材') : t('referral_manager.add_material', '新增推荐素材')}
                        </h3>
                        
                        <form onSubmit={handleMaterialSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('referral_manager.title_label', '素材标题')} *</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 font-medium text-sm text-slate-800"
                                    placeholder={t('referral_manager.title_placeholder', '例如：推荐转化流程图')}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    disabled={actionLoading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('referral_manager.description_label', '简要背景/要点描述')}</label>
                                <textarea
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 font-medium text-xs text-slate-800 h-20 resize-none"
                                    placeholder={t('referral_manager.desc_placeholder', '如：此素材是推荐转化核心政策的视觉化，常用于CC培训辅导')}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={actionLoading}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('referral_manager.type_label', '素材类型')}</label>
                                    <select
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 font-bold text-xs"
                                        value={type}
                                        onChange={(e) => setType(e.target.value as any)}
                                        disabled={actionLoading}
                                    >
                                        <option value="document">📄 {t('referral_manager.type_doc', '文件文档')}</option>
                                        <option value="audio">🎧 {t('referral_manager.type_audio', '音频文件')}</option>
                                        <option value="video">🎥 {t('referral_manager.type_video', '宣导视频')}</option>
                                        <option value="image">🖼️ {t('referral_manager.type_image', '海报图片')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('referral_manager.category_label', '所属分类')}</label>
                                    <select
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 font-semibold text-xs text-slate-700"
                                        value={categoryId || ''}
                                        onChange={(e) => setCategoryId(e.target.value || null)}
                                        disabled={actionLoading}
                                    >
                                        <option value="">📁 [根目录 / 暂无归类]</option>
                                        {nestedCatOptions.map(opt => (
                                            <option key={opt.id} value={opt.id}>
                                                {"　".repeat(opt.level)}└── 📁 {opt.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Storage File Upload Area */}
                            <div className="space-y-2 border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/50">
                                <label className="block text-xs font-bold text-deep-teal">{t('referral_manager.upload_file_label', '上传文件')}</label>
                                <div className="relative flex items-center justify-center border border-gray-200 rounded-xl bg-white p-3 hover:bg-slate-50 transition-colors">
                                    <input
                                        type="file"
                                        accept={
                                            type === 'audio' ? 'audio/*' : 
                                            type === 'video' ? 'video/*' : 
                                            type === 'image' ? 'image/*' : 
                                            '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'
                                        }
                                        onChange={handleFileChange}
                                        disabled={uploading || actionLoading}
                                        className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed w-full h-full"
                                    />
                                    <div className="flex items-center gap-2 text-xs font-bold text-deep-teal">
                                        <Upload className="w-4 h-4 text-desert-gold animate-bounce" />
                                        <span>{uploading ? t('common.uploading', '正在上传...') : t('referral_manager.click_to_upload', '选择本地文件上传')}</span>
                                    </div>
                                </div>

                                {uploadProgress !== null && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-bold text-deep-teal">
                                            <span>{t('referral_manager.progress', '上传进度')}</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                            <div className="bg-desert-gold h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                                        </div>
                                    </div>
                                )}
                                {uploadedFileName && (
                                    <p className="text-[10px] text-emerald-600 font-bold">✓ {t('referral_manager.uploaded_file', '已上传')}: {uploadedFileName}</p>
                                )}
                            </div>

                            {/* Direct URL input */}
                            <div>
                                <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('referral_manager.url_label', '下载/访问链接URL (自动填充)')} *</label>
                                <div className="relative">
                                    <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="url"
                                        required
                                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 font-medium text-xs text-slate-800"
                                        placeholder="https://..."
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        disabled={actionLoading}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 select-none">
                                <input
                                    type="checkbox"
                                    id="mat-visible"
                                    className="rounded border-gray-300 text-desert-gold focus:ring-desert-gold"
                                    checked={visible}
                                    onChange={(e) => setVisible(e.target.checked)}
                                    disabled={actionLoading}
                                />
                                <label htmlFor="mat-visible" className="text-xs font-black text-slate-700 cursor-pointer">{t('referral_manager.visible_label', '立即发布 (是否可见)')}</label>
                            </div>

                            <div className="flex gap-3 pt-3 border-t border-gray-100">
                                <button
                                    type="submit"
                                    disabled={actionLoading || uploading}
                                    className="flex-1 bg-deep-teal hover:bg-teal-700 text-white font-extrabold text-sm py-2.5 rounded-xl transition-all shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    {actionLoading ? t('common.saving', '保存中...') : editingId ? t('referral_manager.btn_update', '保存修改') : t('referral_manager.btn_create', '上传并添加')}
                                </button>
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={resetMaterialForm}
                                        className="px-4 border border-gray-200 hover:bg-gray-100 text-gray-500 font-bold text-sm py-2.5 rounded-xl transition-all"
                                    >
                                        {t('common.cancel', '取消')}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Right Table: Materials List */}
                    <div className="lg:col-span-2 glass-panel p-6 border border-white/60 rounded-3xl h-[600px] flex flex-col">
                        <h3 className="text-lg font-black text-deep-teal mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-desert-gold" />
                            {t('referral_manager.materials_list', '素材资源明细')} ({materials.length})
                        </h3>

                        <div className="flex-1 overflow-auto border border-gray-100/60 rounded-2xl">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-gray-100 text-deep-teal font-extrabold select-none">
                                        <th className="p-3 w-10 text-center">#</th>
                                        <th className="p-3">{t('referral_manager.col_title', '标题名称')}</th>
                                        <th className="p-3">{t('referral_manager.col_type', '类型')}</th>
                                        <th className="p-3">{t('referral_manager.col_category', '归属文件夹')}</th>
                                        <th className="p-3 text-center">{t('referral_manager.col_visible', '状态')}</th>
                                        <th className="p-3 text-center">{t('referral_manager.col_actions', '操作')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {materials.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-20 text-arabian-night/40 font-bold">
                                                {t('referral_manager.no_materials', '暂未上传任何推荐素材。可在左侧表单上传第一个素材！')}
                                            </td>
                                        </tr>
                                    ) : (
                                        materials.map((item, index) => (
                                            <tr key={item.id} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors font-medium">
                                                <td className="p-3 text-center text-slate-400 font-bold">{index + 1}</td>
                                                <td className="p-3">
                                                    <div className="font-black text-slate-800 text-sm">{item.title}</div>
                                                    {item.description && (
                                                        <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{item.description}</div>
                                                    )}
                                                </td>
                                                <td className="p-3 select-none">
                                                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 font-bold text-[10px] w-fit">
                                                        {getMaterialIcon(item.type)}
                                                        {item.type.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-semibold text-slate-500 max-w-[150px] truncate">
                                                    📁 {getCategoryPathName(item.categoryId)}
                                                </td>
                                                <td className="p-3 text-center select-none">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                                                        item.visible 
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    }`}>
                                                        {item.visible ? t('referral_manager.status_published', '已发布') : t('referral_manager.status_hidden', '已下架')}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {/* Sort order handlers */}
                                                        <button
                                                            disabled={index === 0 || actionLoading}
                                                            onClick={() => handleMoveMaterial(index, 'up')}
                                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-deep-teal disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                                                        >
                                                            <ArrowUp className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            disabled={index === materials.length - 1 || actionLoading}
                                                            onClick={() => handleMoveMaterial(index, 'down')}
                                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-deep-teal disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                                                        >
                                                            <ArrowDown className="w-3.5 h-3.5" />
                                                        </button>
                                                        
                                                        <span className="w-px h-3.5 bg-gray-200 mx-1"></span>

                                                        <button
                                                            disabled={actionLoading}
                                                            onClick={() => handleEditMaterial(item)}
                                                            className="p-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded transition-colors cursor-pointer"
                                                            title={t('common.edit', '编辑')}
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            disabled={actionLoading}
                                                            onClick={() => handleDeleteMaterial(item.id, item.url)}
                                                            className="p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors cursor-pointer"
                                                            title={t('common.delete', '删除')}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                /* Categories Management Tab */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Form: Add / Edit Category */}
                    <div className="glass-panel p-6 border border-white/60 h-fit rounded-3xl space-y-5">
                        <h3 className="text-lg font-black text-deep-teal border-b border-gray-100 pb-3 flex items-center gap-2">
                            <FolderPlus className="w-5 h-5 text-desert-gold" />
                            {editingDirId ? t('referral_manager.edit_category', '修改分类文件夹') : t('referral_manager.add_category', '新建分类文件夹')}
                        </h3>
                        
                        <form onSubmit={handleCategorySubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('referral_manager.cat_name_label', '分类目录名称')} *</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 font-medium text-sm text-slate-800"
                                    placeholder={t('referral_manager.cat_name_placeholder', '如：推荐政策规则')}
                                    value={dirName}
                                    onChange={(e) => setDirName(e.target.value)}
                                    disabled={actionLoading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('referral_manager.cat_parent_label', '所属上级分类 (根目录即不选择)')}</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 font-bold text-xs text-slate-700"
                                    value={dirParentId || ''}
                                    onChange={(e) => setDirParentId(e.target.value || null)}
                                    disabled={actionLoading}
                                >
                                    <option value="">📁 [根目录 - 作为顶级文件夹]</option>
                                    {nestedCatOptions
                                        .filter(opt => opt.id !== editingDirId) // Prevent circular linkage
                                        .map(opt => (
                                            <option key={opt.id} value={opt.id}>
                                                {"　".repeat(opt.level)}└── 📁 {opt.name}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div className="flex gap-3 pt-3 border-t border-gray-100">
                                <button
                                    type="submit"
                                    disabled={actionLoading || !dirName.trim()}
                                    className="flex-1 bg-deep-teal hover:bg-teal-700 text-white font-extrabold text-sm py-2.5 rounded-xl transition-all shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    {actionLoading ? t('common.saving') : editingDirId ? t('referral_manager.btn_update_cat', '修改保存') : t('referral_manager.btn_create_cat', '创建文件夹')}
                                </button>
                                {editingDirId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingDirId(null);
                                            setDirName('');
                                            setDirParentId(null);
                                        }}
                                        className="px-4 border border-gray-200 hover:bg-gray-100 text-gray-500 font-bold text-sm py-2.5 rounded-xl transition-all"
                                    >
                                        {t('common.cancel', '取消')}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Right List: Directories Hierarchy View */}
                    <div className="lg:col-span-2 glass-panel p-6 border border-white/60 rounded-3xl h-[600px] flex flex-col">
                        <h3 className="text-lg font-black text-deep-teal mb-4 flex items-center gap-2">
                            <Folder className="w-5 h-5 text-desert-gold" />
                            {t('referral_manager.cat_hierarchy_title', '层级分类树状目录')} ({categories.length})
                        </h3>

                        <div className="flex-1 overflow-auto border border-gray-100/60 rounded-2xl p-4 bg-slate-50/30">
                            {nestedCatOptions.length === 0 ? (
                                <div className="text-center py-24 text-arabian-night/40 font-bold">
                                    {t('referral_manager.no_categories', '目前暂未建立任何层级目录，请在左侧新建第一个文件夹。')}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {nestedCatOptions.map((opt, index) => (
                                        <div 
                                            key={opt.id}
                                            className="flex items-center justify-between p-3.5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-center min-w-0" style={{ paddingLeft: `${opt.level * 24}px` }}>
                                                {opt.level > 0 ? (
                                                    <span className="text-slate-300 font-bold mr-2">└──</span>
                                                ) : null}
                                                <Folder className="w-4 h-4 text-amber-500 fill-amber-500/20 mr-2 shrink-0" />
                                                <span className="font-extrabold text-slate-800 text-sm truncate">{opt.name}</span>
                                            </div>

                                            <div className="flex items-center gap-2 select-none shrink-0">
                                                <button
                                                    disabled={index === 0 || actionLoading}
                                                    onClick={() => handleMoveCategory(index, 'up')}
                                                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-deep-teal disabled:opacity-30 transition-colors cursor-pointer"
                                                    title={t('common.move_up', '上移')}
                                                >
                                                    <ArrowUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    disabled={index === nestedCatOptions.length - 1 || actionLoading}
                                                    onClick={() => handleMoveCategory(index, 'down')}
                                                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-deep-teal disabled:opacity-30 transition-colors cursor-pointer"
                                                    title={t('common.move_down', '下移')}
                                                >
                                                    <ArrowDown className="w-3.5 h-3.5" />
                                                </button>
                                                
                                                <span className="w-px h-3.5 bg-gray-200 mx-1"></span>

                                                <button
                                                    disabled={actionLoading}
                                                    onClick={() => handleEditCategory(categories.find(c => c.id === opt.id)!)}
                                                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors cursor-pointer"
                                                    title={t('common.edit', '修改重命名')}
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    disabled={actionLoading}
                                                    onClick={() => handleDeleteCategory(opt.id)}
                                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors cursor-pointer"
                                                    title={t('common.delete', '删除目录')}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
