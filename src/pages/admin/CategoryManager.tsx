import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, query, where, orderBy, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { FolderPlus, Edit2, Trash2, Save, X } from 'lucide-react';

interface Category {
    id: string;
    name: string;
    createdAt?: any;
    businessType?: 'kid' | 'adult' | 'ss' | 'leader';
    hubScope?: 'public' | 'team';
    targetSmId?: string;
}

export default function CategoryManager() {
    const { t } = useTranslation();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [pageError, setPageError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [businessType, setBusinessType] = useState<'kid' | 'adult' | 'ss' | 'leader'>('kid');
    const { hasPermission, profile, isLeader } = useAuth();
    
    if (!hasPermission('manageCategories')) {
        return <Navigate to="/admin" replace />;
    }

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(t('common.timeout'))), 10000)
            );
            const catPromise = getDocs(query(collection(db, 'categories'), orderBy('createdAt', 'desc')));
            const snapshot = (await Promise.race([catPromise, timeoutPromise])) as any;
            
            const data: Category[] = [];
            snapshot.forEach((doc: any) => {
                const docData = doc.data();
                data.push({ 
                    id: doc.id, 
                    name: docData.name, 
                    businessType: docData.businessType || 'kid',
                    hubScope: docData.hubScope || 'public',
                    targetSmId: docData.targetSmId || ''
                });
            });
            setCategories(data);
            setPageError(null);
        } catch (error: any) {
            setPageError(`${t('common.load_fail')} ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        if (profile?.dep === 'SS') {
            setBusinessType('ss');
        } else {
            setBusinessType('kid');
        }
    }, [profile]);

    const filteredCategories = categories.filter(cat => {
        if ((cat.businessType || 'kid') !== businessType) return false;

        // Super Admin sees all categories
        if (profile?.role === 'super_admin') return true;
        // Non-super-admins see public categories + their own team's categories
        const catScope = cat.hubScope || 'public';
        if (catScope === 'public') return true;
        return catScope === 'team' && cat.targetSmId === profile?.crmId;
    });

    const handleCreate = async () => {
        if (!newCategoryName.trim()) return;
        setActionLoading(true);
        setPageError(null);
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(t('common.timeout'))), 10000));
            const isSuper = profile?.role === 'super_admin';
            const catScope = isSuper ? 'public' : 'team';
            const catSmId = isSuper ? '' : (profile?.crmId || '');

            const addPromise = addDoc(collection(db, 'categories'), {
                name: newCategoryName.trim(),
                businessType: businessType,
                hubScope: catScope,
                targetSmId: catSmId,
                createdAt: serverTimestamp()
            });
            await Promise.race([addPromise, timeoutPromise]);
            
            setNewCategoryName('');
            await fetchCategories();
        } catch (error: any) {
            setPageError(`${t('category_manager.add_fail')} ${error.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdate = async (id: string, oldName: string) => {
        if (!editName.trim() || editName.trim() === oldName) {
            setEditingId(null);
            return;
        }
        
        // Safeguard check: only super_admin or the category owner can modify
        const cat = categories.find(c => c.id === id);
        const isSuper = profile?.role === 'super_admin';
        const isOwner = cat && cat.hubScope === 'team' && cat.targetSmId === profile?.crmId;
        if (!isSuper && !isOwner) {
            alert(t('category_manager.no_permission', '您没有修改此目录的权限'));
            setEditingId(null);
            return;
        }

        setActionLoading(true);
        setPageError(null);
        try {
            const newName = editName.trim();
            const batch = writeBatch(db);
            
            // 1. Update the category document
            const catRef = doc(db, 'categories', id);
            batch.update(catRef, { name: newName });

            // 2. Query all recordings under this category to update their categoryName
            const recQ = query(collection(db, 'recordings'), where('categoryId', '==', id));
            const recSnapshot = await getDocs(recQ);
            
            recSnapshot.forEach((recDoc) => {
                batch.update(recDoc.ref, { categoryName: newName });
            });

            // Commit the batch
            await batch.commit();

            setEditingId(null);
            await fetchCategories();
        } catch (error: any) {
            setPageError(`${t('category_manager.update_fail')} ${error.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        // Safeguard check: only super_admin or the category owner can modify
        const cat = categories.find(c => c.id === id);
        const isSuper = profile?.role === 'super_admin';
        const isOwner = cat && cat.hubScope === 'team' && cat.targetSmId === profile?.crmId;
        if (!isSuper && !isOwner) {
            alert(t('category_manager.no_permission', '您没有删除此目录的权限'));
            return;
        }

        if (!window.confirm(t('category_manager.delete_confirm'))) {
            return;
        }
        setActionLoading(true);
        setPageError(null);
        try {
            const batch = writeBatch(db);

            // 1. Delete the category document
            const catRef = doc(db, 'categories', id);
            batch.delete(catRef);

            // 2. Query all recordings to remove their category association
            const recQ = query(collection(db, 'recordings'), where('categoryId', '==', id));
            const recSnapshot = await getDocs(recQ);
            
            recSnapshot.forEach((recDoc) => {
                batch.update(recDoc.ref, { 
                    categoryId: '', 
                    categoryName: t('common.uncategorized')
                });
            });

            // Commit the batch
            await batch.commit();

            await fetchCategories();
        } catch (error: any) {
            setPageError(`${t('common.delete_fail')} ${error.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="animate-in fade-in duration-500 space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-deep-teal">{t('category_manager.title')}</h1>
                <p className="text-arabian-night/60 mt-1">{t('category_manager.desc')}</p>
            </div>

            {pageError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center">
                    <span>{pageError}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Create Section */}
                <div className="md:col-span-1 space-y-6">
                    <div className="glass-panel rounded-2xl p-6 border border-desert-gold/20 sticky top-8">
                        <h2 className="text-xl font-bold text-deep-teal mb-4 flex items-center gap-2">
                            <FolderPlus className="text-desert-gold h-5 w-5" />
                            {t('category_manager.create_category')}
                        </h2>
                        <div className="flex flex-col gap-3">
                            <input
                                type="text"
                                className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-desert-gold focus:border-transparent"
                                placeholder={t('category_manager.placeholder')}
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                disabled={actionLoading}
                            />
                            
                            <div>
                                <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('common.business_type', '业务线')}</label>
                                {profile?.role === 'super_admin' ? (
                                    <div className="flex flex-wrap gap-2.5 mt-1">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="categoryBusinessType"
                                                value="kid"
                                                checked={businessType === 'kid'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                className="w-3.5 h-3.5 text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span className="text-xs font-semibold text-arabian-night">{t('common.type_kid', '青少')}</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="categoryBusinessType"
                                                value="adult"
                                                checked={businessType === 'adult'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                className="w-3.5 h-3.5 text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span className="text-xs font-semibold text-arabian-night">{t('common.type_adult', '成人')}</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="categoryBusinessType"
                                                value="ss"
                                                checked={businessType === 'ss'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                className="w-3.5 h-3.5 text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span className="text-xs font-semibold text-arabian-night">{t('common.type_ss', 'SS 业务')}</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="categoryBusinessType"
                                                value="leader"
                                                checked={businessType === 'leader'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                className="w-3.5 h-3.5 text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span className="text-xs font-semibold text-arabian-night">{t('common.type_leader', 'Leader 学院')}</span>
                                        </label>
                                    </div>
                                ) : isLeader ? (
                                    profile?.dep === 'SS' ? (
                                        <div className="flex flex-wrap gap-2.5 mt-1">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="categoryBusinessType"
                                                    value="ss"
                                                    checked={businessType === 'ss'}
                                                    onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                    className="w-3.5 h-3.5 text-desert-gold focus:ring-desert-gold"
                                                />
                                                <span className="text-xs font-semibold text-arabian-night">{t('common.type_ss', 'SS 业务')}</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="categoryBusinessType"
                                                    value="leader"
                                                    checked={businessType === 'leader'}
                                                    onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                    className="w-3.5 h-3.5 text-desert-gold focus:ring-desert-gold"
                                                />
                                                <span className="text-xs font-semibold text-arabian-night">{t('common.type_leader', 'Leader 学院')}</span>
                                            </label>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2.5 mt-1">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="categoryBusinessType"
                                                    value="kid"
                                                    checked={businessType === 'kid'}
                                                    onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                    className="w-3.5 h-3.5 text-desert-gold focus:ring-desert-gold"
                                                />
                                                <span className="text-xs font-semibold text-arabian-night">{t('common.type_kid', '青少')}</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="categoryBusinessType"
                                                    value="adult"
                                                    checked={businessType === 'adult'}
                                                    onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                    className="w-3.5 h-3.5 text-desert-gold focus:ring-desert-gold"
                                                />
                                                <span className="text-xs font-semibold text-arabian-night">{t('common.type_adult', '成人')}</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="categoryBusinessType"
                                                    value="leader"
                                                    checked={businessType === 'leader'}
                                                    onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                    className="w-3.5 h-3.5 text-desert-gold focus:ring-desert-gold"
                                                />
                                                <span className="text-xs font-semibold text-arabian-night">{t('common.type_leader', 'Leader 学院')}</span>
                                            </label>
                                        </div>
                                    )
                                ) : profile?.dep === 'SS' ? (
                                    <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm border border-orange-400 select-none animate-pulse">
                                        ✨ {t('common.type_ss', 'SS 业务')}
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2.5 mt-1">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="categoryBusinessType"
                                                value="kid"
                                                checked={businessType === 'kid'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                className="w-3.5 h-3.5 text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span className="text-xs font-semibold text-arabian-night">{t('common.type_kid', '青少')}</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="categoryBusinessType"
                                                value="adult"
                                                checked={businessType === 'adult'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                className="w-3.5 h-3.5 text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span className="text-xs font-semibold text-arabian-night">{t('common.type_adult', '成人')}</span>
                                        </label>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleCreate}
                                disabled={actionLoading || !newCategoryName.trim()}
                                className="w-full py-3 bg-deep-teal text-white rounded-xl font-bold shadow-md hover:-translate-y-0.5 hover:shadow-lg disabled:bg-gray-400 disabled:transform-none transition-all mt-2"
                            >
                                {actionLoading ? t('common.processing') : t('category_manager.add_btn')}
                            </button>
                        </div>
                        <div className="mt-6 text-xs text-arabian-night/50 bg-white/50 p-3 rounded-lg border border-white/60">
                            <p className="font-semibold text-deep-teal mb-1">{t('category_manager.tip_title')}</p>
                            <p>{t('category_manager.tip_desc')}</p>
                        </div>
                    </div>
                </div>

                {/* List Section */}
                <div className="md:col-span-2">
                    <div className="glass-panel rounded-2xl p-6 border border-white/40 min-h-[500px]">
                        <h2 className="text-xl font-bold text-deep-teal mb-4 flex items-center gap-2">
                            {t('category_manager.list_title')} ({filteredCategories.length})
                        </h2>

                        {loading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-desert-gold"></div>
                            </div>
                        ) : filteredCategories.length === 0 ? (
                            <div className="text-center py-12 text-arabian-night/40">
                                <FolderPlus className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                <p>{t('category_manager.no_category')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {filteredCategories.map(cat => (
                                    <div key={cat.id} className="bg-white/60 p-4 rounded-xl border border-transparent hover:border-desert-gold/30 flex justify-between items-center group transition-colors shadow-sm hover:shadow-md">
                                        {editingId === cat.id ? (
                                            <div className="flex-1 flex items-center gap-2 mr-2">
                                                <input 
                                                    type="text" 
                                                    autoFocus
                                                    className="w-full px-2 py-1 text-sm border-b-2 border-desert-gold focus:outline-none bg-transparent font-bold text-deep-teal"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(cat.id, cat.name)}
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex-1 font-bold text-arabian-night truncate pr-4">
                                                {cat.name}
                                            </div>
                                        )}
                                        
                                        <div className="flex items-center gap-1 opacity-100 md:opacity-50 md:group-hover:opacity-100 transition-opacity">
                                            {editingId === cat.id ? (
                                                <>
                                                    <button onClick={() => handleUpdate(cat.id, cat.name)} disabled={actionLoading} className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                                                        <Save className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} disabled={actionLoading} className="p-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {(profile?.role === 'super_admin' || cat.targetSmId === profile?.crmId) && (
                                                        <>
                                                            <button 
                                                                onClick={() => { setEditingId(cat.id); setEditName(cat.name); }} 
                                                                disabled={actionLoading}
                                                                className="p-1.5 bg-desert-gold/10 text-yellow-700 rounded-lg hover:bg-desert-gold/20"
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(cat.id)} 
                                                                disabled={actionLoading}
                                                                className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            )}
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
