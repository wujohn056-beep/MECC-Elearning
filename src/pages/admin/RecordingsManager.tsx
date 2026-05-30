import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../services/firebase';
import { UploadCloud, FileText, User, Pencil, Trash2, X, Download, Search, Users, Send } from 'lucide-react';

interface Recording {
    id: string;
    title: string;
    description: string;
    lecturerName?: string;
    audioUrl: string;
    avatarUrl?: string;
    categoryId?: string;
    categoryName?: string;
    createdAt: any;
    displayId?: string;
    businessType?: 'kid' | 'adult' | 'ss';
}

interface Category {
    id: string;
    name: string;
    businessType?: 'kid' | 'adult' | 'ss';
}

export default function RecordingsManager() {
    const { t } = useTranslation();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const { hasPermission, profile } = useAuth();
    
    // DingTalk Multi-Target Push States
    const [showPushModal, setShowPushModal] = useState(false);
    const [selectedRecordingForPush, setSelectedRecordingForPush] = useState<Recording | null>(null);
    const [pushTargetType, setPushTargetType] = useState<'group' | 'individuals'>('group');
    const [selectedSdsForPush, setSelectedSdsForPush] = useState<string[]>([]);
    const [pushWebhookLang, setPushWebhookLang] = useState<'bilingual' | 'en' | 'zh'>('bilingual');
    const [pushingToDingTalk, setPushingToDingTalk] = useState(false);

    if (!hasPermission('manageRecordings')) {
        return <Navigate to="/admin" replace />;
    }
    
    // Form States
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [lecturerName, setLecturerName] = useState('');
    const [lecturerMode, setLecturerMode] = useState<'select' | 'custom'>('select');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [businessType, setBusinessType] = useState<'kid' | 'adult' | 'ss'>('kid');
    
    // Upload States
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const [pageError, setPageError] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    // Autocomplete for lecturer
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [showLecturerDropdown, setShowLecturerDropdown] = useState(false);

    // Compute SDs list dynamically from systemUsers (casing normalized to uppercase to prevent duplicate team names like ALAN and Alan)
    const sdList = React.useMemo(() => {
        const sds = new Set<string>();
        systemUsers.forEach(u => {
            if (u.role === 'sd' && u.crmId) {
                sds.add(u.crmId.toUpperCase());
            }
            if (u.sd) {
                sds.add(u.sd.toUpperCase());
            }
        });
        return Array.from(sds).sort();
    }, [systemUsers]);

    const filteredRecordings = recordings.filter(rec => {
        const isSuperAdmin = profile?.role === 'super_admin';
        if (!isSuperAdmin) {
            if (profile?.dep === 'SS') {
                if (rec.businessType !== 'ss') return false;
            } else {
                if (rec.businessType === 'ss') return false;
            }
        }
        return rec.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (rec.displayId && rec.displayId.toLowerCase().includes(searchQuery.toLowerCase()));
    });

    const fetchData = async () => {
        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(t('common.timeout'))), 10000)
            );

            // Fetch Categories with timeout
            const catPromise = getDocs(query(collection(db, 'categories'), orderBy('createdAt', 'desc')));
            const catSnapshot = (await Promise.race([catPromise, timeoutPromise])) as any;
            
            const catData: Category[] = [];
            catSnapshot.forEach((doc: any) => {
                const docData = doc.data();
                catData.push({ 
                    id: doc.id, 
                    name: docData.name, 
                    businessType: docData.businessType || 'kid' 
                });
            });
            setCategories(catData);

            if (catData.length > 0 && !selectedCategoryId && !editingId) {
                const targetBusType = profile?.dep === 'SS' ? 'ss' : 'kid';
                const activeCats = catData.filter(c => (c.businessType || 'kid') === targetBusType);
                if (activeCats.length > 0) {
                    setSelectedCategoryId(activeCats[0].id);
                }
            }

            // Fetch Recordings with timeout
            const recQ = query(collection(db, 'recordings'), orderBy('createdAt', 'desc'));
            const recPromise = getDocs(recQ);
            const recSnapshot = (await Promise.race([recPromise, timeoutPromise])) as any;
            
            const recData: Recording[] = [];
            recSnapshot.forEach((doc: any) => recData.push({ id: doc.id, ...doc.data() } as Recording));
            setRecordings(recData);

            // Fetch Users for autocomplete
            const usersQ = query(collection(db, 'users'));
            const usersPromise = getDocs(usersQ);
            const usersSnapshot = (await Promise.race([usersPromise, timeoutPromise])) as any;
            const usersData: any[] = [];
            usersSnapshot.forEach((doc: any) => usersData.push({ id: doc.id, ...doc.data() }));
            setSystemUsers(usersData);

            setPageError(null);
        } catch (error: any) {
            console.error("Error fetching data: ", error);
            setPageError(`${t('common.load_fail')} ${error.message}`);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (profile?.dep === 'SS') {
            setBusinessType('ss');
        } else {
            setBusinessType('kid');
        }
    }, [profile]);

    useEffect(() => {
        const activeCats = categories.filter(c => (c.businessType || 'kid') === businessType);
        const currentCat = activeCats.find(c => c.id === selectedCategoryId);
        if (!currentCat) {
            if (activeCats.length > 0) {
                setSelectedCategoryId(activeCats[0].id);
            } else {
                setSelectedCategoryId('');
            }
        }
    }, [businessType, categories, selectedCategoryId]);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setTitle('');
        setDescription('');
        setLecturerName('');
        setLecturerMode('select');
        setFile(null);
        setAvatarFile(null);
        setAvatarPreview(null);
        setBusinessType(profile?.dep === 'SS' ? 'ss' : 'kid');
        setProgress(0);
        setUploading(false);
        const targetBusType = profile?.dep === 'SS' ? 'ss' : 'kid';
        const activeCats = categories.filter(c => (c.businessType || 'kid') === targetBusType);
        if (activeCats.length > 0) {
            setSelectedCategoryId(activeCats[0].id);
        } else {
            setSelectedCategoryId('');
        }
        
        // Reset file inputs visually
        const audioInput = document.getElementById('audioInput') as HTMLInputElement;
        if (audioInput) audioInput.value = '';
        const avatarInput = document.getElementById('avatarInput') as HTMLInputElement;
        if (avatarInput) avatarInput.value = '';
    };

    const handlePushToDingTalkClick = (rec: Recording) => {
        setSelectedRecordingForPush(rec);
        setPushTargetType('group');
        setSelectedSdsForPush([]);
        setShowPushModal(true);
    };

    const handleExecutePush = async () => {
        if (!selectedRecordingForPush) return;

        if (pushTargetType === 'individuals' && selectedSdsForPush.length === 0) {
            alert(t('recordings_manager.select_at_least_one_sd', '请选择至少一个接收团队！'));
            return;
        }

        setPushingToDingTalk(true);
        try {
            const res = await fetch('/.netlify/functions/dingtalk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'notifyMaterial',
                    recordingId: selectedRecordingForPush.id,
                    title: selectedRecordingForPush.title,
                    displayId: selectedRecordingForPush.displayId || '',
                    lecturerName: selectedRecordingForPush.lecturerName || '',
                    categoryName: selectedRecordingForPush.categoryName || '',
                    description: selectedRecordingForPush.description || '',
                    targetType: pushTargetType,
                    selectedSds: selectedSdsForPush,
                    webhookLang: pushWebhookLang
                })
            });

            if (!res.ok) {
                throw new Error(t('recordings_manager.push_fail', '推送到钉钉失败，请检查通道凭证或网络配置。'));
            }

            const data = await res.json();
            if (data.success) {
                alert(t('recordings_manager.push_success', '精品素材已成功推送至钉钉！'));
                setShowPushModal(false);
            } else {
                throw new Error(data.error || t('recordings_manager.push_fail'));
            }
        } catch (err: any) {
            console.error('DingTalk material push error:', err);
            alert(err.message || t('recordings_manager.push_fail'));
        } finally {
            setPushingToDingTalk(false);
        }
    };

    const handleEdit = (rec: Recording) => {
        setEditingId(rec.id);
        setTitle(rec.title);
        setDescription(rec.description);
        const name = rec.lecturerName || '';
        setLecturerName(name);
        
        // Determine lecturerMode based on whether the name exists in systemUsers
        const matchesUser = systemUsers.some(u => 
            (u.name && u.name === name) || 
            (u.crmId && u.crmId === name)
        );
        if (name && !matchesUser) {
            setLecturerMode('custom');
        } else {
            setLecturerMode('select');
        }
        
        setSelectedCategoryId(rec.categoryId || '');
        setAvatarPreview(rec.avatarUrl || null);
        setBusinessType(rec.businessType || (profile?.dep === 'SS' ? 'ss' : 'kid'));
        setFile(null);
        setAvatarFile(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (rec: Recording) => {
        const confirmMsg = t('recordings_manager.delete_confirm').replace('{{title}}', rec.title);
        if (!window.confirm(confirmMsg)) {
            return;
        }

        try {
            setUploading(true);
            setPageError(null);
            
            // Delete audio from Storage if it's a firebase storage URL
            if (rec.audioUrl && rec.audioUrl.includes('firebasestorage')) {
                try {
                    const audioRef = ref(storage, rec.audioUrl);
                    await deleteObject(audioRef);
                } catch (e) {
                    console.error(t('recordings_manager.delete_audio_fail'), e);
                }
            }

            // Delete avatar from Storage
            if (rec.avatarUrl && rec.avatarUrl.includes('firebasestorage')) {
                try {
                    const avatarRef = ref(storage, rec.avatarUrl);
                    await deleteObject(avatarRef);
                } catch (e) {
                    console.error(t('recordings_manager.delete_avatar_fail'), e);
                }
            }

            // Delete document
            await deleteDoc(doc(db, 'recordings', rec.id));
            
            if (editingId === rec.id) {
                resetForm();
            }
            await fetchData();
        } catch (error: any) {
            console.error("Delete failed:", error);
            setPageError(`${t('common.delete_fail')} ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredRecordings.length && filteredRecordings.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredRecordings.map(r => r.id));
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(t('recordings_manager.batch_delete_confirm', '确定要删除选中的这些文件吗？此操作不可恢复。'))) return;
        
        setUploading(true);
        setPageError(null);
        try {
            const deletePromises = selectedIds.map(async (id) => {
                const rec = recordings.find(r => r.id === id);
                if (!rec) return;

                if (rec.audioUrl && rec.audioUrl.includes('firebasestorage')) {
                    try {
                        const audioRef = ref(storage, rec.audioUrl);
                        await deleteObject(audioRef);
                    } catch (e) {
                        console.error("Delete file fail:", e);
                    }
                }
                if (rec.avatarUrl && rec.avatarUrl.includes('firebasestorage')) {
                    try {
                        const avatarRef = ref(storage, rec.avatarUrl);
                        await deleteObject(avatarRef);
                    } catch (e) {
                        console.error("Delete avatar fail:", e);
                    }
                }
                await deleteDoc(doc(db, 'recordings', id));
            });

            await Promise.all(deletePromises);
            setSelectedIds([]);
            await fetchData();
        } catch (error: any) {
            console.error("Batch delete failed:", error);
            setPageError(`${t('common.delete_fail')} ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Require file only if creating new
        if (!editingId && !file) return;
        if (!title) return;

        setUploading(true);
        setPageError(null);
        
        try {
            let avatarUrl = avatarPreview; 
            let audioUrl = editingId ? recordings.find(r => r.id === editingId)?.audioUrl || '' : '';

            // 1. Upload new Avatar if exists
            if (avatarFile) {
                const avatarRef = ref(storage, `avatars/${Date.now()}_${avatarFile.name}`);
                const avatarUploadTask = await uploadBytesResumable(avatarRef, avatarFile);
                avatarUrl = await getDownloadURL(avatarUploadTask.ref);
            } else if (!avatarPreview) {
                avatarUrl = ''; // User cleared avatar
            }

            // 2. Upload new Audio if exists
            if (file) {
                const storageRef = ref(storage, `recordings/${Date.now()}_${file.name}`);
                const uploadTask = uploadBytesResumable(storageRef, file);

                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setProgress(prog);
                        },
                        (error) => reject(error),
                        async () => {
                            audioUrl = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve(null);
                        }
                    );
                });
            }

            const category = categories.find(c => c.id === selectedCategoryId);
            const dataToSave: any = {
                title,
                description,
                lecturerName,
                audioUrl,
                avatarUrl,
                categoryId: category?.id || '',
                categoryName: category?.name || t('common.uncategorized'),
                businessType
            };

            if (editingId) {
                await updateDoc(doc(db, 'recordings', editingId), dataToSave);
            } else {
                let maxId = 0;
                recordings.forEach(rec => {
                    if (rec.displayId && rec.displayId.startsWith('RD')) {
                        const numPart = parseInt(rec.displayId.substring(2), 10);
                        if (!isNaN(numPart) && numPart > maxId) {
                            maxId = numPart;
                        }
                    }
                });
                dataToSave.displayId = `RD${(maxId + 1).toString().padStart(4, '0')}`;

                await addDoc(collection(db, 'recordings'), {
                    ...dataToSave,
                    createdAt: serverTimestamp()
                });
            }
            
            resetForm();
            await fetchData();
        } catch (error: any) {
            console.error("Upload/Update process failed:", error);
            setPageError(`${t('common.process_fail')} ${error.message}`);
            setUploading(false);
        }
    };

    return (
        <div className="animate-in fade-in duration-500 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-deep-teal">{t('recordings_manager.title')}</h1>
                    <p className="text-arabian-night/60 mt-1">{t('recordings_manager.desc')}</p>
                </div>
            </div>

            {pageError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center">
                    <span>{pageError}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Category & Upload Form */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Upload Form */}
                    <div className="glass-panel rounded-2xl p-6 border border-desert-gold/20">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-deep-teal flex items-center gap-2">
                                {editingId ? <Pencil className="text-desert-gold h-5 w-5" /> : <UploadCloud className="text-desert-gold h-5 w-5" />}
                                {editingId ? t('recordings_manager.edit_materials') : t('recordings_manager.upload_materials')}
                            </h2>
                            {editingId && (
                                <button onClick={resetForm} className="text-arabian-night/40 hover:text-red-500 transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            
                            <div>
                                <label className="block text-sm font-semibold text-deep-teal mb-1">{t('recordings_manager.select_category')}</label>
                                <select 
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/50"
                                    value={selectedCategoryId}
                                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>{t('recordings_manager.select_placeholder')}</option>
                                    {categories.filter(cat => (cat.businessType || 'kid') === businessType).map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-deep-teal mb-1">{t('common.business_type', '业务线')}</label>
                                {profile?.dep === 'SS' ? (
                                    <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm border border-orange-400 select-none mt-1 animate-pulse">
                                        ✨ {t('common.type_ss', 'SS 业务')}
                                    </div>
                                ) : profile?.role === 'super_admin' ? (
                                    <div className="flex items-center gap-6 mt-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="businessType"
                                                value="kid"
                                                checked={businessType === 'kid'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss')}
                                                className="w-4 h-4 text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span className="text-sm font-semibold text-arabian-night">{t('common.type_kid', '青少业务')}</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="businessType"
                                                value="adult"
                                                checked={businessType === 'adult'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss')}
                                                className="w-4 h-4 text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span className="text-sm font-semibold text-arabian-night">{t('common.type_adult', '成人业务')}</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="businessType"
                                                value="ss"
                                                checked={businessType === 'ss'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss')}
                                                className="w-4 h-4 text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span className="text-sm font-semibold text-arabian-night">{t('common.type_ss', 'SS 业务')}</span>
                                        </label>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-6 mt-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="businessType"
                                                value="kid"
                                                checked={businessType === 'kid'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss')}
                                                className="w-4 h-4 text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span className="text-sm font-semibold text-arabian-night">{t('common.type_kid', '青少业务')}</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="businessType"
                                                value="adult"
                                                checked={businessType === 'adult'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss')}
                                                className="w-4 h-4 text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span className="text-sm font-semibold text-arabian-night">{t('common.type_adult', '成人业务')}</span>
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-deep-teal mb-1">{t('recordings_manager.avatar_label')}</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-white shrink-0">
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="h-6 w-6 text-gray-400" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <label className="cursor-pointer bg-desert-gold/10 text-yellow-700 hover:bg-desert-gold/20 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0">
                                            {t('common.choose_file', '选择文件')}
                                            <input
                                                type="file"
                                                id="avatarInput"
                                                accept="image/png, image/jpeg, image/webp"
                                                onChange={handleAvatarChange}
                                                className="hidden"
                                            />
                                        </label>
                                        <span className="text-xs text-gray-500 truncate max-w-[120px]">
                                            {avatarFile ? avatarFile.name : t('common.no_file_chosen', '未选择任何文件')}
                                        </span>
                                    </div>
                                </div>
                                {editingId && avatarPreview && (
                                    <button type="button" onClick={() => {setAvatarPreview(null); setAvatarFile(null);}} className="text-xs text-red-500 mt-1">{t('recordings_manager.remove_avatar')}</button>
                                )}
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-semibold text-deep-teal">
                                        {t('recordings_manager.lecturer_label')}
                                    </label>
                                    <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-semibold border border-gray-200">
                                        <button
                                            type="button"
                                            onClick={() => setLecturerMode('select')}
                                            className={`px-3 py-1 rounded-md transition-all duration-200 ${
                                                lecturerMode === 'select'
                                                    ? 'bg-white text-deep-teal shadow-sm border-gray-200/50'
                                                    : 'text-gray-400 hover:text-gray-600'
                                            }`}
                                        >
                                            {t('recordings_manager.mode_select', '系统成员')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLecturerMode('custom')}
                                            className={`px-3 py-1 rounded-md transition-all duration-200 ${
                                                lecturerMode === 'custom'
                                                    ? 'bg-white text-deep-teal shadow-sm border-gray-200/50'
                                                    : 'text-gray-400 hover:text-gray-600'
                                            }`}
                                        >
                                            {t('recordings_manager.mode_custom', '手动输入')}
                                        </button>
                                    </div>
                                </div>

                                {lecturerMode === 'select' ? (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-desert-gold focus:border-transparent pr-10"
                                            value={lecturerName}
                                            onChange={(e) => {
                                                setLecturerName(e.target.value);
                                                setShowLecturerDropdown(true);
                                            }}
                                            onFocus={() => setShowLecturerDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowLecturerDropdown(false), 200)}
                                            placeholder={t('recordings_manager.lecturer_placeholder')}
                                        />
                                        <div className="absolute right-3 top-2.5 text-gray-400 pointer-events-none">
                                            <Users className="w-4 h-4" />
                                        </div>
                                        {showLecturerDropdown && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto scrollbar-thin">
                                                {systemUsers
                                                    .filter(u => {
                                                        const userDep = u.dep || 'CC';
                                                        if (businessType === 'ss') {
                                                            if (userDep !== 'SS') return false;
                                                        } else {
                                                            if (userDep === 'SS') return false;
                                                        }
                                                        return !lecturerName || 
                                                            (u.name && u.name.toLowerCase().includes(lecturerName.toLowerCase())) ||
                                                            (u.crmId && u.crmId.toLowerCase().includes(lecturerName.toLowerCase()));
                                                    })
                                                    .slice(0, 20)
                                                    .map(u => (
                                                        <div 
                                                            key={u.id}
                                                            className="px-4 py-2.5 hover:bg-desert-gold/10 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0 transition-colors"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                setLecturerName(u.name || u.crmId || '');
                                                                setShowLecturerDropdown(false);
                                                            }}
                                                        >
                                                            <span className="font-semibold text-arabian-night">{u.name || u.crmId}</span>
                                                            {u.crmId && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{u.crmId}</span>}
                                                        </div>
                                                    ))}
                                                {systemUsers.filter(u => {
                                                    const userDep = u.dep || 'CC';
                                                    if (businessType === 'ss') {
                                                        if (userDep !== 'SS') return false;
                                                    } else {
                                                        if (userDep === 'SS') return false;
                                                    }
                                                    return !lecturerName || 
                                                        (u.name && u.name.toLowerCase().includes(lecturerName.toLowerCase())) ||
                                                        (u.crmId && u.crmId.toLowerCase().includes(lecturerName.toLowerCase()));
                                                }).length === 0 && (
                                                    <div className="px-4 py-4 text-center">
                                                        <p className="text-xs text-gray-400 mb-2">
                                                            {t('recordings_manager.no_matching_users', '未找到匹配的系统成员')}
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                setLecturerMode('custom');
                                                            }}
                                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-yellow-700 bg-desert-gold/10 hover:bg-desert-gold/20 px-3 py-1.5 rounded-full transition-colors"
                                                        >
                                                            🎨 {t('recordings_manager.switch_to_custom', '使用自定义姓名：“')}{lecturerName}{t('recordings_manager.switch_to_custom_end', '”')}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-400 mt-1">
                                            💡 {t('recordings_manager.lecturer_select_tip', '提示：可模糊搜索系统成员姓名或 CRM 账号，也可以点击右上角切换为“手动输入”直接填入全新讲师。')}
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-desert-gold focus:border-transparent pr-28 font-semibold text-deep-teal"
                                                value={lecturerName}
                                                onChange={(e) => setLecturerName(e.target.value)}
                                                placeholder={t('recordings_manager.lecturer_placeholder')}
                                            />
                                            <div className="absolute right-3 top-2 flex items-center shadow-sm">
                                                <span className="bg-desert-gold/10 text-yellow-800 text-[10px] font-bold px-2 py-1 rounded-md border border-desert-gold/20 flex items-center gap-1 select-none">
                                                    🎨 {t('recordings_manager.custom_tag', '自定义讲师')}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-yellow-700/80 mt-1">
                                            💡 {t('recordings_manager.lecturer_custom_tip', '提示：当前为自定义模式，将直接保存填写的文本（适合外部嘉宾、临时讲师等非系统内账号）。')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-deep-teal mb-1">{t('recordings_manager.recording_title')}</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-desert-gold focus:border-transparent"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={t('recordings_manager.recording_placeholder')}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-deep-teal mb-1">{t('recordings_manager.desc_label')}</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-desert-gold focus:border-transparent"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={t('recordings_manager.desc_placeholder')}
                                    rows={2}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-deep-teal mb-1">{t('recordings_manager.audio_label')}</label>
                                {editingId && (
                                    <p className="text-xs text-arabian-night/60 mb-1">{t('recordings_manager.audio_tip')}</p>
                                )}
                                <div className="flex items-center gap-3 mt-2">
                                    <label className="cursor-pointer bg-desert-gold/10 text-yellow-700 hover:bg-desert-gold/20 px-4 py-2 rounded-full text-sm font-semibold transition-colors shrink-0">
                                        {t('common.choose_file', '选择文件')}
                                        <input
                                            type="file"
                                            id="audioInput"
                                            required={!editingId}
                                            onChange={(e) => e.target.files && setFile(e.target.files[0])}
                                            className="hidden"
                                        />
                                    </label>
                                    <span className="text-sm text-gray-500 truncate max-w-[200px]">
                                        {file ? file.name : t('common.no_file_chosen', '未选择任何文件')}
                                    </span>
                                </div>
                            </div>
                            
                            {uploading && (
                                <div className="mt-4 p-4 bg-desert-gold/5 rounded-xl border border-desert-gold/20">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-bold text-deep-teal flex items-center gap-2">
                                            <span className="animate-pulse h-2 w-2 bg-desert-gold rounded-full"></span>
                                            {t('recordings_manager.syncing')}
                                        </span>
                                        <span className="text-sm font-bold text-desert-gold">{Math.round(progress)}%</span>
                                    </div>
                                    {file && (
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div className="bg-gradient-to-r from-desert-gold to-yellow-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={uploading || (!editingId && !file) || categories.length === 0}
                                className={`w-full py-3 mt-4 rounded-xl font-bold text-white shadow-md transition-all ${uploading || (!editingId && !file) || categories.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-deep-teal to-teal-700 hover:-translate-y-0.5 hover:shadow-lg'}`}
                            >
                                {categories.length === 0 ? t('recordings_manager.create_cat_first') : uploading ? t('common.processing') : (editingId ? t('recordings_manager.save_changes') : t('recordings_manager.start_upload'))}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Column: Recordings List */}
                <div className="lg:col-span-2">
                    <div className="glass-panel rounded-2xl p-6 border border-white/40 min-h-[500px]">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <h2 className="text-xl font-bold text-deep-teal flex items-center gap-2">
                                <FileText className="text-desert-gold h-5 w-5" />
                                {t('recordings_manager.uploaded_resources')}
                                <span className="text-sm font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-1">
                                    {filteredRecordings.length}
                                </span>
                            </h2>
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder={t('common.search', '搜索...')}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-desert-gold focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                {selectedIds.length > 0 && (
                                    <button
                                        onClick={handleBatchDelete}
                                        disabled={uploading}
                                        className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        {t('common.batch_delete', '批量删除')} ({selectedIds.length})
                                    </button>
                                )}
                            </div>
                        </div>

                        {filteredRecordings.length > 0 && (
                            <div className="flex items-center gap-3 mb-4 px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.length === filteredRecordings.length && filteredRecordings.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 text-desert-gold border-gray-300 rounded focus:ring-desert-gold cursor-pointer"
                                />
                                <span className="text-sm font-semibold text-gray-600">{t('common.select_all', '全选')}</span>
                            </div>
                        )}
                        
                        {filteredRecordings.length === 0 ? (
                            <div className="text-center py-12 text-arabian-night/40">
                                <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                <p>{t('recordings_manager.no_resources')}</p>
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                                {filteredRecordings.map((rec) => (
                                    <div key={rec.id} className={`bg-white/60 p-4 rounded-xl flex items-center justify-between hover:bg-white transition-colors border ${editingId === rec.id ? 'border-desert-gold shadow-md' : 'border-transparent hover:border-desert-gold/30'} group`}>
                                        <div className="flex items-start gap-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(rec.id)}
                                                onChange={() => toggleSelect(rec.id)}
                                                className="mt-3.5 w-4 h-4 text-desert-gold border-gray-300 rounded focus:ring-desert-gold cursor-pointer shrink-0"
                                            />
                                            <div className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 bg-gradient-to-br from-light-teal to-deep-teal">
                                                {rec.avatarUrl ? (
                                                    <img src={rec.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <User className="h-6 w-6 text-white/50" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                                        (rec.businessType || 'kid') === 'ss'
                                                            ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white border border-orange-400'
                                                            : (rec.businessType || 'kid') === 'kid' 
                                                                ? 'bg-blue-100 text-blue-700' 
                                                                : 'bg-purple-100 text-purple-700'
                                                    }`}>
                                                        {(rec.businessType || 'kid') === 'ss'
                                                            ? t('common.type_ss')
                                                            : (rec.businessType || 'kid') === 'kid'
                                                                ? t('common.type_kid')
                                                                : t('common.type_adult')
                                                        }
                                                    </span>
                                                    <span className="text-[10px] bg-desert-gold text-white px-2 py-0.5 rounded-full font-semibold">
                                                        {rec.categoryName || t('common.uncategorized')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-arabian-night">
                                                        {rec.displayId && <span className="text-desert-gold mr-1.5 text-sm">[{rec.displayId}]</span>}
                                                        {rec.title}
                                                    </h3>
                                                </div>
                                                <p className="text-sm text-arabian-night/60 mt-1 line-clamp-1">{rec.description}</p>
                                                {rec.lecturerName && (
                                                    <p className="text-xs text-desert-gold mt-1 font-medium flex items-center gap-1">
                                                        <User className="h-3 w-3" /> {rec.lecturerName}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 ml-4">
                                            <div className="flex gap-2">
                                                <button onClick={() => handlePushToDingTalkClick(rec)} className="p-1.5 bg-white rounded-md text-arabian-night/40 hover:text-teal-600 hover:bg-teal-50 transition-colors shadow-sm border border-gray-100" title={t('recordings_manager.push_dingtalk', '推送至钉钉')}>
                                                    <Send className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => handleEdit(rec)} className="p-1.5 bg-white rounded-md text-arabian-night/40 hover:text-deep-teal hover:bg-gray-100 transition-colors shadow-sm border border-gray-100" title="编辑">
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => handleDelete(rec)} disabled={uploading} className="p-1.5 bg-white rounded-md text-arabian-night/40 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm border border-gray-100 disabled:opacity-50" title="删除">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            {(() => {
                                                const url = rec.audioUrl?.toLowerCase() || '';
                                                const cleanUrl = url.split('?')[0];
                                                const isVideo = cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.m4v') || cleanUrl.endsWith('.avi') || cleanUrl.endsWith('.mkv');
                                                const isAudio = cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') || cleanUrl.endsWith('.m4a') || cleanUrl.endsWith('.ogg') || cleanUrl.endsWith('.aac') || cleanUrl.endsWith('.flac');
                                                
                                                if (isVideo) {
                                                    return <video src={rec.audioUrl} controls className="h-10 w-48 mt-1 rounded bg-black" />;
                                                }
                                                if (isAudio) {
                                                    return <audio src={rec.audioUrl} controls className="h-8 w-48 opacity-50 group-hover:opacity-100 transition-opacity mt-1" />;
                                                }
                                                return (
                                                    <a href={rec.audioUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-deep-teal hover:text-desert-gold font-bold bg-white/50 px-3 py-1.5 rounded-lg border border-deep-teal/10 hover:border-desert-gold/30 transition-all mt-1">
                                                        <Download className="w-4 h-4" /> {t('common.download', '下载文件')}
                                                    </a>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Custom Glassmorphic DingTalk Push Modal */}
            {showPushModal && selectedRecordingForPush && (
                <div className="fixed inset-0 bg-arabian-night/40 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300">
                    <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 p-6 md:p-8 max-w-lg w-full mx-4 transform transition-all animate-in zoom-in-95 duration-300 flex flex-col gap-4 text-arabian-night">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-2">
                                <Send className="h-5 w-5 text-deep-teal" />
                                <h3 className="text-lg font-bold text-arabian-night">
                                    {t('recordings_manager.push_modal_title', '推送精品素材至钉钉')}
                                </h3>
                            </div>
                            <button 
                                onClick={() => setShowPushModal(false)}
                                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="h-5 w-5 text-arabian-night/40 hover:text-arabian-night/80" />
                            </button>
                        </div>

                        {/* Material Info Card */}
                        <div className="bg-deep-teal/5 border border-deep-teal/10 rounded-2xl p-4 flex gap-3 items-start">
                            <div className="bg-deep-teal/10 p-2.5 rounded-xl text-deep-teal">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-arabian-night">
                                    {selectedRecordingForPush.displayId && <span className="text-desert-gold mr-1">[{selectedRecordingForPush.displayId}]</span>}
                                    {selectedRecordingForPush.title}
                                </h4>
                                <p className="text-xs text-arabian-night/60 mt-1 line-clamp-1">
                                    {selectedRecordingForPush.description || t('recordings_manager.no_description', '无案例背景介绍')}
                                </p>
                                {selectedRecordingForPush.lecturerName && (
                                    <p className="text-xs text-desert-gold mt-1 font-semibold flex items-center gap-1">
                                        <User className="h-3 w-3" /> {selectedRecordingForPush.lecturerName}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Push Segment Toggle */}
                        <div className="flex bg-gray-100/80 p-1 rounded-xl gap-1">
                            <button
                                type="button"
                                onClick={() => setPushTargetType('group')}
                                className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    pushTargetType === 'group'
                                        ? 'bg-white text-deep-teal shadow-md border border-gray-100'
                                        : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/40'
                                }`}
                            >
                                {t('recordings_manager.push_to_group', '👥 推送至工作群机器人')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setPushTargetType('individuals')}
                                className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    pushTargetType === 'individuals'
                                        ? 'bg-white text-deep-teal shadow-md border border-gray-100'
                                        : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/40'
                                }`}
                            >
                                {t('recordings_manager.push_to_individuals', '👤 精确推送给个人')}
                            </button>
                        </div>

                        {/* Webhook Push Language Selector */}
                        {pushTargetType === 'group' && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-300 flex flex-col gap-2">
                                <label className="text-xs font-bold text-arabian-night/70">
                                    {t('recordings_manager.push_language', '群助手推送语言')}
                                </label>
                                <div className="flex bg-gray-100/40 border border-gray-200/50 p-1 rounded-xl gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setPushWebhookLang('bilingual')}
                                        className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                            pushWebhookLang === 'bilingual'
                                                ? 'bg-deep-teal text-white shadow-sm'
                                                : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/50'
                                        }`}
                                    >
                                        🌐 Bilingual
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPushWebhookLang('en')}
                                        className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                            pushWebhookLang === 'en'
                                                ? 'bg-deep-teal text-white shadow-sm'
                                                : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/50'
                                        }`}
                                    >
                                        🇬🇧 English
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPushWebhookLang('zh')}
                                        className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                            pushWebhookLang === 'zh'
                                                ? 'bg-deep-teal text-white shadow-sm'
                                                : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/50'
                                        }`}
                                    >
                                        🇨🇳 中文
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* SD Selection Checklist (When individual push is active) */}
                        {pushTargetType === 'individuals' && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-300 flex flex-col gap-2">
                                <div className="flex items-center justify-between text-xs font-bold text-arabian-night/70">
                                    <span>{t('recordings_manager.select_sd_teams', '选择接收部门 (按 SD 维度)')}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (selectedSdsForPush.length === sdList.length) {
                                                setSelectedSdsForPush([]);
                                            } else {
                                                setSelectedSdsForPush([...sdList]);
                                            }
                                        }}
                                        className="text-deep-teal hover:text-desert-gold transition-colors"
                                    >
                                        {selectedSdsForPush.length === sdList.length ? t('recordings_manager.deselect_all', '取消全选') : t('recordings_manager.select_all', '全选')}
                                    </button>
                                </div>
                                <div className="border border-gray-100 rounded-2xl bg-white/50 p-3 flex flex-col gap-1 max-h-40 overflow-y-auto mt-1 custom-scrollbar">
                                    {sdList.length === 0 ? (
                                        <p className="text-xs text-arabian-night/40 py-4 text-center">{t('recordings_manager.no_sds', '暂无可用销售总监 (SD)')}</p>
                                    ) : (
                                        sdList.map(sd => {
                                            const isChecked = selectedSdsForPush.includes(sd);
                                            return (
                                                <label 
                                                    key={sd} 
                                                    className="flex items-center gap-2.5 text-xs font-bold hover:bg-deep-teal/5 p-2 rounded-xl transition-colors cursor-pointer select-none"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {
                                                            if (isChecked) {
                                                                setSelectedSdsForPush(selectedSdsForPush.filter(x => x !== sd));
                                                            } else {
                                                                setSelectedSdsForPush([...selectedSdsForPush, sd]);
                                                            }
                                                        }}
                                                        className="h-4 w-4 rounded border-gray-300 text-deep-teal focus:ring-deep-teal transition-all"
                                                    />
                                                    <span>{sd} {t('recordings_manager.team_suffix', '团队')}</span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Footer buttons */}
                        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 mt-2">
                            <button
                                type="button"
                                onClick={() => setShowPushModal(false)}
                                className="px-4 py-2 text-xs font-bold text-arabian-night/60 hover:text-arabian-night hover:bg-gray-100 rounded-xl transition-all"
                            >
                                {t('common.cancel', '取消')}
                            </button>
                            <button
                                type="button"
                                onClick={handleExecutePush}
                                disabled={pushingToDingTalk || (pushTargetType === 'individuals' && selectedSdsForPush.length === 0)}
                                className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 rounded-xl transition-all shadow-lg hover:shadow-xl shadow-teal-600/10 hover:shadow-teal-600/25 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {pushingToDingTalk ? (
                                    <>
                                        <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        {t('recordings_manager.pushing', '正在推送...')}
                                    </>
                                ) : pushTargetType === 'group' ? (
                                    t('recordings_manager.push_btn_group', '广播推送至工作群')
                                ) : (
                                    t('recordings_manager.push_btn_individuals', '推送给选定团队 (共 {{count}} 个)', { count: selectedSdsForPush.length })
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
