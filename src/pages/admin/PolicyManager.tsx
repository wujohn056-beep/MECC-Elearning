import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
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
    Loader2,
    Folder,
    FolderPlus,
    ChevronRight,
    ChevronDown
} from 'lucide-react';

interface PolicyItem {
    id: string;
    title: string;
    description?: string;
    type: 'document' | 'poster' | 'video';
    url: string;
    thumbnailUrl?: string;
    targetTeam: 'KCC' | 'GCC' | 'Adult' | 'EA' | 'all';
    directoryId: string | null;
    sortOrder: number;
    visible: boolean;
    createdAt?: any;
    updatedAt?: any;
    updatedBy?: string;
}

interface PolicyDirectory {
    id: string;
    name: string;
    parentId: string | null;
    targetTeam: 'KCC' | 'GCC' | 'Adult' | 'EA' | 'all';
    sortOrder: number;
    createdAt?: any;
}

interface NestedDirOption {
    id: string;
    name: string;
    level: number;
    targetTeam: string;
}

// Helper to bridge old businessType schemas with new team target segments
function mapBusinessTypeToTeam(bt: string): 'KCC' | 'GCC' | 'Adult' | 'EA' | 'all' {
    const type = String(bt || '').toLowerCase();
    if (type === 'kid') return 'KCC';
    if (type === 'adult') return 'Adult';
    if (type === 'ss') return 'EA';
    return 'all';
}

export default function PolicyManager() {
    const { t } = useTranslation();
    const { hasPermission, profile } = useAuth();
    
    // Scoped role assignment
    const adminScope = useMemo(() => {
        if (profile?.role === 'super_admin') return 'all';
        return profile?.policyScope || 'all';
    }, [profile]);

    // State management
    const [policies, setPolicies] = useState<PolicyItem[]>([]);
    const [directories, setDirectories] = useState<PolicyDirectory[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    // Tab toggle: 'policies' | 'directories'
    const [activeTab, setActiveTab] = useState<'policies' | 'directories'>('policies');

    // Policy Form states
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'document' | 'poster' | 'video'>('document');
    const [url, setUrl] = useState('');
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [targetTeam, setTargetTeam] = useState<'KCC' | 'GCC' | 'Adult' | 'EA' | 'all'>('all');
    const [directoryId, setDirectoryId] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<number>(0);
    const [visible, setVisible] = useState(true);
    
    // Directory Form states
    const [editingDirId, setEditingDirId] = useState<string | null>(null);
    const [dirName, setDirName] = useState('');
    const [dirParentId, setDirParentId] = useState<string | null>(null);
    const [dirTargetTeam, setDirTargetTeam] = useState<'KCC' | 'GCC' | 'Adult' | 'EA' | 'all'>('all');
    const [dirSortOrder, setDirSortOrder] = useState<number>(0);

    // Upload state
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploading, setUploading] = useState(false);

    if (!hasPermission('managePolicies')) {
        return <Navigate to="/admin" replace />;
    }

    // Initialize forms with scoped defaults
    useEffect(() => {
        const defaultTeam = adminScope === 'all' ? 'all' : adminScope;
        setTargetTeam(defaultTeam);
        setDirTargetTeam(defaultTeam);
    }, [adminScope]);

    const fetchPolicies = async () => {
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
                    targetTeam: item.targetTeam || mapBusinessTypeToTeam(item.businessType || 'all'),
                    directoryId: item.directoryId || null,
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
        }
    };

    const fetchDirectories = async () => {
        try {
            const q = query(collection(db, 'policy_directories'), orderBy('sortOrder', 'asc'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const data: PolicyDirectory[] = [];
            snapshot.forEach((doc) => {
                const item = doc.data();
                data.push({
                    id: doc.id,
                    name: item.name || '',
                    parentId: item.parentId || null,
                    targetTeam: item.targetTeam || 'all',
                    sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
                    createdAt: item.createdAt
                });
            });
            setDirectories(data);
        } catch (err: any) {
            console.error("Error fetching directories:", err);
        }
    };

    const loadData = async () => {
        setLoading(true);
        setError(null);
        await Promise.all([fetchPolicies(), fetchDirectories()]);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filter policies and directories based on admin boundary scope
    const filteredPolicies = useMemo(() => {
        if (adminScope === 'all') return policies;
        return policies.filter(p => p.targetTeam === adminScope);
    }, [policies, adminScope]);

    const filteredDirectories = useMemo(() => {
        if (adminScope === 'all') return directories;
        return directories.filter(d => d.targetTeam === adminScope);
    }, [directories, adminScope]);

    // Build indented hierarchy structure for selection dropdowns
    const nestedDirOptions = useMemo(() => {
        const map: { [id: string]: PolicyDirectory[] } = {};
        const roots: PolicyDirectory[] = [];
        
        filteredDirectories.forEach(d => {
            if (d.parentId) {
                if (!map[d.parentId]) map[d.parentId] = [];
                map[d.parentId].push(d);
            } else {
                roots.push(d);
            }
        });

        const result: NestedDirOption[] = [];
        
        function traverse(node: PolicyDirectory, level: number) {
            result.push({
                id: node.id,
                name: node.name,
                level: level,
                targetTeam: node.targetTeam
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
    }, [filteredDirectories]);

    const resetForm = () => {
        setEditingId(null);
        setTitle('');
        setDescription('');
        setType('document');
        setUrl('');
        setThumbnailUrl('');
        setTargetTeam(adminScope === 'all' ? 'all' : adminScope);
        setDirectoryId(null);
        setSortOrder(filteredPolicies.length > 0 ? Math.max(...filteredPolicies.map(p => p.sortOrder)) + 1 : 1);
        setVisible(true);
        setUploadFile(null);
        setUploadProgress(null);
        setUploading(false);
    };

    const resetDirForm = () => {
        setEditingDirId(null);
        setDirName('');
        setDirParentId(null);
        setDirTargetTeam(adminScope === 'all' ? 'all' : adminScope);
        setDirSortOrder(filteredDirectories.length > 0 ? Math.max(...filteredDirectories.map(d => d.sortOrder)) + 1 : 1);
    };

    useEffect(() => {
        if (!editingId && activeTab === 'policies') {
            setSortOrder(filteredPolicies.length > 0 ? Math.max(...filteredPolicies.map(p => p.sortOrder)) + 1 : 1);
        }
    }, [filteredPolicies, editingId, activeTab]);

    useEffect(() => {
        if (!editingDirId && activeTab === 'directories') {
            setDirSortOrder(filteredDirectories.length > 0 ? Math.max(...filteredDirectories.map(d => d.sortOrder)) + 1 : 1);
        }
    }, [filteredDirectories, editingDirId, activeTab]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadFile(e.target.files[0]);
        }
    };

    const handleUpload = (teamFolder: string): Promise<string> => {
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
            const fileRef = ref(storage, `policies/${teamFolder}/${Date.now()}_${uploadFile.name}`);
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

    // Policies form submission
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
            const finalTeam = adminScope === 'all' ? targetTeam : adminScope;
            let finalUrl = url;
            if (uploadFile) {
                finalUrl = await handleUpload(finalTeam);
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
                targetTeam: finalTeam,
                directoryId: directoryId || null,
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

    // Directories form submission
    const handleDirSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dirName.trim()) {
            setError('请输入目录名称');
            return;
        }

        setActionLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const finalTeam = adminScope === 'all' ? dirTargetTeam : adminScope;
            
            // Generate path string array for depth tracing
            let path: string[] = [];
            if (dirParentId) {
                const parentDir = directories.find(d => d.id === dirParentId);
                if (parentDir) {
                    const parentPath = (parentDir as any).path || [];
                    path = [...parentPath, dirParentId];
                }
            }

            // Loop checking for infinite folder recursion
            if (editingDirId && dirParentId) {
                let currentId: string | null = dirParentId;
                while (currentId) {
                    if (currentId === editingDirId) {
                        throw new Error("不能选择子目录或当前目录作为父级目录");
                    }
                    const parent = directories.find(d => d.id === currentId);
                    currentId = parent ? parent.parentId : null;
                }
            }

            const dirData = {
                name: dirName.trim(),
                parentId: dirParentId || null,
                path,
                targetTeam: finalTeam,
                sortOrder: Number(dirSortOrder) || 0,
                updatedAt: serverTimestamp(),
                updatedBy: profile?.crmId || 'admin'
            };

            if (editingDirId) {
                await updateDoc(doc(db, 'policy_directories', editingDirId), dirData);
                setSuccess("保存分类目录成功");
            } else {
                await addDoc(collection(db, 'policy_directories'), {
                    ...dirData,
                    createdAt: serverTimestamp()
                });
                setSuccess("创建分类目录成功");
            }

            resetDirForm();
            await fetchDirectories();
        } catch (err: any) {
            console.error("Error saving directory:", err);
            setError("保存目录失败: " + err.message);
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
        setTargetTeam(item.targetTeam);
        setDirectoryId(item.directoryId || null);
        setSortOrder(item.sortOrder);
        setVisible(item.visible);
        setUploadFile(null);
        setUploadProgress(null);
    };

    const handleDirEdit = (item: PolicyDirectory) => {
        setEditingDirId(item.id);
        setDirName(item.name);
        setDirParentId(item.parentId);
        setDirTargetTeam(item.targetTeam);
        setDirSortOrder(item.sortOrder);
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

    const handleDirDelete = async (id: string) => {
        if (!window.confirm("确定要删除此目录文件夹吗？删除后该目录下的子文件和子文件夹将自动移到【上级/根目录】下。")) {
            return;
        }

        setActionLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const currentDir = directories.find(d => d.id === id);
            const parentIdOfDeleted = currentDir?.parentId || null;

            // 1. Move all items inside this folder to parent folder level
            const itemsQuery = query(collection(db, 'policies'), where('directoryId', '==', id));
            const itemsSnap = await getDocs(itemsQuery);
            for (const itemDoc of itemsSnap.docs) {
                await updateDoc(doc(db, 'policies', itemDoc.id), { directoryId: parentIdOfDeleted });
            }

            // 2. Move child folders to parent folder level
            const foldersQuery = query(collection(db, 'policy_directories'), where('parentId', '==', id));
            const foldersSnap = await getDocs(foldersQuery);
            for (const folderDoc of foldersSnap.docs) {
                await updateDoc(doc(db, 'policy_directories', folderDoc.id), { 
                    parentId: parentIdOfDeleted,
                    path: currentDir?.parentId ? (currentDir as any).path || [] : []
                });
            }

            // 3. Delete folder doc itself
            await deleteDoc(doc(db, 'policy_directories', id));
            setSuccess("成功删除文件夹，内部子项已全部转移归档");
            await loadData();
        } catch (err: any) {
            console.error("Error deleting folder:", err);
            setError("删除目录失败: " + err.message);
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

    const handleDirSortOrderChange = async (item: PolicyDirectory, newSort: number) => {
        try {
            await updateDoc(doc(db, 'policy_directories', item.id), {
                sortOrder: newSort,
                updatedAt: serverTimestamp()
            });
            await fetchDirectories();
        } catch (err: any) {
            setError("排序更新失败: " + err.message);
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

    const getTeamLabel = (team: string) => {
        switch (team) {
            case 'KCC': return 'KCC 青少 (JOHN/Niki)';
            case 'GCC': return 'GCC 专区 (IRIS)';
            case 'Adult': return 'Adult 成人 (Alan/Chase)';
            case 'EA': return 'EA 团队 (Lily)';
            case 'all': return t('common.all_business', '全部业务线');
            default: return team;
        }
    };

    const getParentFolderName = (dirId: string | null) => {
        if (!dirId) return '根目录';
        const matched = directories.find(d => d.id === dirId);
        return matched ? matched.name : '未知目录';
    };

    return (
        <div className="animate-in fade-in duration-500 space-y-8 pb-10">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-deep-teal">
                        运营政策与目录管理
                        <span className="text-sm font-black ml-3 px-3 py-1 rounded-full bg-desert-gold/15 text-amber-700 border border-desert-gold/20 select-none">
                            🔒 运营隔离: {adminScope === 'all' ? '全局总管理员 (ALL)' : `${adminScope} 运营专员`}
                        </span>
                    </h1>
                    <p className="text-arabian-night/60 mt-1">
                        分团队维护销售激励方案与学习政策。您可以设置树形子目录，将不同激励和政策按文件夹分门别类展示。
                    </p>
                </div>
            </div>

            {/* Premium Tab Selector */}
            <div className="flex border-b border-gray-200/80 gap-1 select-none">
                <button 
                    onClick={() => {
                        setActiveTab('policies');
                        setError(null);
                        setSuccess(null);
                    }}
                    className={`px-6 py-3 font-extrabold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                        activeTab === 'policies' 
                            ? 'border-desert-gold text-deep-teal bg-desert-gold/5 rounded-t-xl' 
                            : 'border-transparent text-gray-500 hover:text-deep-teal hover:bg-gray-50/50'
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    政策文件资源发布 ({filteredPolicies.length})
                </button>
                <button 
                    onClick={() => {
                        setActiveTab('directories');
                        setError(null);
                        setSuccess(null);
                    }}
                    className={`px-6 py-3 font-extrabold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                        activeTab === 'directories' 
                            ? 'border-desert-gold text-deep-teal bg-desert-gold/5 rounded-t-xl' 
                            : 'border-transparent text-gray-500 hover:text-deep-teal hover:bg-gray-50/50'
                    }`}
                >
                    <Folder className="w-4 h-4" />
                    嵌套目录文件夹管理 ({filteredDirectories.length})
                </button>
            </div>

            {/* Error & Success Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm animate-in slide-in-from-top-2 duration-300">
                    <span>{success}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* POLICY tab content */}
                {activeTab === 'policies' && (
                    <>
                        {/* Form */}
                        <div className="lg:col-span-5 space-y-6">
                            <div className="glass-panel rounded-2xl p-6 border border-desert-gold/20 bg-white/40 sticky top-8">
                                <h2 className="text-xl font-bold text-deep-teal mb-6 flex items-center gap-2 border-b border-deep-teal/10 pb-3">
                                    {editingId ? <Edit2 className="text-desert-gold h-5 w-5" /> : <Plus className="text-desert-gold h-5 w-5" />}
                                    {editingId ? '编辑政策文件' : '发布新政策文件'}
                                </h2>
                                
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-deep-teal mb-1.5">政策标题 *</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80"
                                            placeholder="如：2026年6月KCC新版销售提成激励"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            disabled={actionLoading}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-deep-teal mb-1.5">政策简介（可选）</label>
                                        <textarea
                                            rows={2}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80"
                                            placeholder="简短介绍此政策的核心内容..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            disabled={actionLoading}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-deep-teal mb-1.5">展示形式</label>
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
                                            <label className="block text-xs font-bold text-deep-teal mb-1.5">所属业务团队</label>
                                            <select
                                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 font-medium disabled:bg-gray-100 disabled:text-gray-500"
                                                value={targetTeam}
                                                onChange={(e) => setTargetTeam(e.target.value as any)}
                                                disabled={actionLoading || adminScope !== 'all'}
                                            >
                                                <option value="all">🌍 全部业务线 (all)</option>
                                                <option value="KCC">🧒 KCC 团队 (JOHN/Niki)</option>
                                                <option value="GCC">💼 GCC 团队 (IRIS)</option>
                                                <option value="Adult">👨 Adult 团队 (Alan/Chase)</option>
                                                <option value="EA">🎓 EA 团队 (Lily)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-deep-teal mb-1.5">所属文件夹目录</label>
                                        <select
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 font-medium text-xs"
                                            value={directoryId || ''}
                                            onChange={(e) => setDirectoryId(e.target.value || null)}
                                            disabled={actionLoading}
                                        >
                                            <option value="">📂 [根目录] (不放入任何文件夹)</option>
                                            {nestedDirOptions.map(opt => (
                                                <option key={opt.id} value={opt.id}>
                                                    {"　".repeat(opt.level)}└── 📁 {opt.name} ({opt.targetTeam})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Upload Area */}
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
                                            className="flex-1 py-3 bg-deep-teal hover:bg-deep-teal/90 text-white rounded-xl font-bold shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:transform-none cursor-pointer"
                                        >
                                            {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                            {editingId ? t('common.save', '保存') : t('common.publish', '发布')}
                                        </button>
                                        
                                        {editingId && (
                                            <button
                                                type="button"
                                                onClick={resetForm}
                                                className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold transition-all cursor-pointer"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* List */}
                        <div className="lg:col-span-7">
                            <div className="glass-panel rounded-2xl p-6 border border-white/40 bg-white/40 min-h-[500px]">
                                <h2 className="text-xl font-bold text-deep-teal mb-6 flex items-center gap-2 border-b border-deep-teal/10 pb-3">
                                    <FileText className="text-desert-gold h-5 w-5" />
                                    已发布文件列表 ({filteredPolicies.length})
                                </h2>

                                {loading ? (
                                    <div className="flex justify-center py-24">
                                        <Loader2 className="animate-spin rounded-full h-8 w-8 text-desert-gold" />
                                    </div>
                                ) : filteredPolicies.length === 0 ? (
                                    <div className="text-center py-24 text-arabian-night/40">
                                        <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                                        <p className="font-medium">当前范围无运营政策，请使用左侧表单发布第一条政策吧</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {filteredPolicies.map((item, index) => (
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
                                                            <h3 className="font-bold text-base text-arabian-night truncate max-w-[220px]">{item.title}</h3>
                                                            <span className="text-[10px] px-2 py-0.5 bg-deep-teal/10 text-deep-teal font-bold rounded-full">
                                                                {getTeamLabel(item.targetTeam)}
                                                            </span>
                                                            <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/50 rounded-full font-bold">
                                                                📁 {getParentFolderName(item.directoryId)}
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
                                                            <span>排序: {item.sortOrder}</span>
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
                                                                    <span>发布人: {item.updatedBy}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Actions */}
                                                    <div className="flex flex-col gap-1 items-end self-start shrink-0">
                                                        <div className="flex gap-1">
                                                            <button 
                                                                onClick={() => handleToggleVisible(item)}
                                                                className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200 cursor-pointer"
                                                                title={item.visible ? t('policy_manager.hide', '隐藏') : t('policy_manager.show', '显示')}
                                                            >
                                                                {item.visible ? <Eye className="h-4 w-4 text-deep-teal" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                                                            </button>
                                                            
                                                            <button 
                                                                onClick={() => handleEdit(item)}
                                                                className="p-2 hover:bg-white text-yellow-600 rounded-lg transition-colors border border-transparent hover:border-gray-200 cursor-pointer"
                                                                title={t('common.edit', '编辑')}
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </button>
                                                            
                                                            <button 
                                                                onClick={() => handleDelete(item.id)}
                                                                className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-200 cursor-pointer"
                                                                title={t('common.delete', '删除')}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        
                                                        {/* Sorting */}
                                                        <div className="flex gap-1 mt-1">
                                                            <button 
                                                                onClick={() => handleSortOrderChange(item, item.sortOrder - 1)}
                                                                disabled={index === 0}
                                                                className="p-1.5 hover:bg-white text-gray-500 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                                                title="上移"
                                                            >
                                                                <ArrowUp className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleSortOrderChange(item, item.sortOrder + 1)}
                                                                disabled={index === filteredPolicies.length - 1}
                                                                className="p-1.5 hover:bg-white text-gray-500 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                                                title="下移"
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
                    </>
                )}

                {/* DIRECTORIES tab content */}
                {activeTab === 'directories' && (
                    <>
                        {/* Form */}
                        <div className="lg:col-span-5 space-y-6">
                            <div className="glass-panel rounded-2xl p-6 border border-desert-gold/20 bg-white/40 sticky top-8">
                                <h2 className="text-xl font-bold text-deep-teal mb-6 flex items-center gap-2 border-b border-deep-teal/10 pb-3">
                                    {editingDirId ? <Edit2 className="text-desert-gold h-5 w-5" /> : <FolderPlus className="text-desert-gold h-5 w-5" />}
                                    {editingDirId ? '编辑分类目录' : '创建新分类目录'}
                                </h2>
                                
                                <form onSubmit={handleDirSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-deep-teal mb-1.5">目录名称 *</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80"
                                            placeholder="如：2026年度提成方案"
                                            value={dirName}
                                            onChange={(e) => setDirName(e.target.value)}
                                            disabled={actionLoading}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-deep-teal mb-1.5">上级父目录 (不选即作为根目录)</label>
                                        <select
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 font-medium text-xs"
                                            value={dirParentId || ''}
                                            onChange={(e) => setDirParentId(e.target.value || null)}
                                            disabled={actionLoading}
                                        >
                                            <option value="">📁 [根目录] (作为主文件夹)</option>
                                            {nestedDirOptions
                                                .filter(opt => opt.id !== editingDirId) // Prevent circular parent linkage
                                                .map(opt => (
                                                    <option key={opt.id} value={opt.id}>
                                                        {"　".repeat(opt.level)}└── 📁 {opt.name} ({opt.targetTeam})
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-deep-teal mb-1.5">可见业务范围</label>
                                        <select
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80 font-medium disabled:bg-gray-100 disabled:text-gray-500"
                                            value={dirTargetTeam}
                                            onChange={(e) => setDirTargetTeam(e.target.value as any)}
                                            disabled={actionLoading || adminScope !== 'all'}
                                        >
                                            <option value="all">🌍 全部业务线 (all)</option>
                                            <option value="KCC">🧒 KCC 团队 (JOHN/Niki)</option>
                                            <option value="GCC">💼 GCC 团队 (IRIS)</option>
                                            <option value="Adult">👨 Adult 团队 (Alan/Chase)</option>
                                            <option value="EA">🎓 EA 团队 (Lily)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-deep-teal mb-1.5">排序权重</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/80"
                                            value={dirSortOrder}
                                            onChange={(e) => setDirSortOrder(parseInt(e.target.value) || 0)}
                                            disabled={actionLoading}
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-4 border-t border-deep-teal/10">
                                        <button
                                            type="submit"
                                            disabled={actionLoading}
                                            className="flex-1 py-3 bg-deep-teal hover:bg-deep-teal/90 text-white rounded-xl font-bold shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:transform-none cursor-pointer"
                                        >
                                            {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                            {editingDirId ? '保存更改' : '创建分类'}
                                        </button>
                                        
                                        {editingDirId && (
                                            <button
                                                type="button"
                                                onClick={resetDirForm}
                                                className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold transition-all cursor-pointer"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* List */}
                        <div className="lg:col-span-7">
                            <div className="glass-panel rounded-2xl p-6 border border-white/40 bg-white/40 min-h-[500px]">
                                <h2 className="text-xl font-bold text-deep-teal mb-6 flex items-center gap-2 border-b border-deep-teal/10 pb-3">
                                    <Folder className="text-desert-gold h-5 w-5" />
                                    现有树形嵌套目录 ({filteredDirectories.length})
                                </h2>

                                {loading ? (
                                    <div className="flex justify-center py-24">
                                        <Loader2 className="animate-spin rounded-full h-8 w-8 text-desert-gold" />
                                    </div>
                                ) : filteredDirectories.length === 0 ? (
                                    <div className="text-center py-24 text-arabian-night/40">
                                        <Folder className="h-16 w-16 mx-auto mb-4 opacity-20" />
                                        <p className="font-medium">当前范围无分类目录，在左边新建第一个分类文件夹吧</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {nestedDirOptions.map((item, index) => {
                                            const originalDir = filteredDirectories.find(d => d.id === item.id);
                                            if (!originalDir) return null;
                                            return (
                                                <div 
                                                    key={item.id} 
                                                    className="p-3.5 rounded-xl border border-white/70 bg-white/50 hover:bg-white/80 hover:border-desert-gold/30 shadow-sm flex justify-between items-center transition-all"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0" style={{ paddingLeft: `${item.level * 20}px` }}>
                                                        <span className="text-gray-400 font-bold shrink-0">{item.level > 0 ? '└──' : '•'}</span>
                                                        <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                                                        <span className="font-bold text-slate-800 truncate">{item.name}</span>
                                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-deep-teal/10 text-deep-teal font-extrabold scale-90">
                                                            {getTeamLabel(item.targetTeam)}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0 ml-4">
                                                        <button 
                                                            onClick={() => handleDirEdit(originalDir)}
                                                            className="p-1.5 hover:bg-gray-100 text-yellow-600 rounded transition-colors cursor-pointer"
                                                            title="编辑"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        
                                                        <button 
                                                            onClick={() => handleDirDelete(item.id)}
                                                            className="p-1.5 hover:bg-red-50 text-red-600 rounded transition-colors cursor-pointer"
                                                            title="删除"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>

                                                        <button 
                                                            onClick={() => handleDirSortOrderChange(originalDir, originalDir.sortOrder - 1)}
                                                            disabled={index === 0}
                                                            className="p-1 hover:bg-gray-100 text-gray-500 rounded disabled:opacity-30 cursor-pointer"
                                                        >
                                                            <ArrowUp className="h-3 w-3" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDirSortOrderChange(originalDir, originalDir.sortOrder + 1)}
                                                            disabled={index === nestedDirOptions.length - 1}
                                                            className="p-1 hover:bg-gray-100 text-gray-500 rounded disabled:opacity-30 cursor-pointer"
                                                        >
                                                            <ArrowDown className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
