import React, { useState, useEffect } from 'react';
import * as xlsx from 'xlsx';
import { collection, getDocs, doc, setDoc, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { db, firebaseConfig } from '../../services/firebase';
import { Users, Upload, Edit, Trash2, Key, Search, Plus, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface ExcelRow {
    SD: string;
    SM: string;
    TL?: string;
    CRM: string;
    Team: string;
    Position?: string;
}

interface UserRecord {
    id: string;
    crmId: string;
    role: string;
    sd?: string;
    sm?: string;
    tl?: string;
    team?: string;
}

export default function UserManager() {
    const { t } = useTranslation();
    const { isSuperAdmin } = useAuth();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [statusLog, setStatusLog] = useState<{msg: string, type: 'success'|'error'}[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [formData, setFormData] = useState({ crmId: '', role: 'user', sd: '', sm: '', tl: '', team: '' });

    useEffect(() => {
        if (isSuperAdmin) {
            fetchUsers();
        }
    }, [isSuperAdmin]);

    const fetchUsers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const data: UserRecord[] = [];
            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as UserRecord);
            });
            setUsers(data);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    if (!isSuperAdmin) {
        return <Navigate to="/admin" replace />;
    }

    const filteredUsers = users.filter(u => 
        u.crmId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.team && u.team.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.sd && u.sd.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.sm && u.sm.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.tl && u.tl.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Extract unique values for dropdowns
    const uniqueSDs = Array.from(new Set(users.map(u => u.sd).filter(Boolean))).sort();
    const uniqueSMs = Array.from(new Set(users.map(u => u.sm).filter(Boolean))).sort();
    const uniqueTLs = Array.from(new Set(users.map(u => u.tl).filter(Boolean))).sort();
    const uniqueTeams = Array.from(new Set(users.map(u => u.team).filter(Boolean))).sort();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setStatusLog([]);
        
        try {
            const data = await file.arrayBuffer();
            const workbook = xlsx.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rawJsonData = xlsx.utils.sheet_to_json<any>(worksheet);
            
            const jsonData = rawJsonData.map(row => {
                const normalized: any = {};
                for (const key in row) {
                    normalized[key.trim()] = row[key];
                }
                return normalized as ExcelRow;
            });

            const accountsToCreate = new Map<string, any>();

            jsonData.forEach(row => {
                const sdValue = row.SD ? row.SD.trim() : '';
                const smValue = row.SM ? row.SM.trim() : '';
                const tlValue = row.TL ? row.TL.trim() : '';
                const teamValue = row.Team ? row.Team.trim() : '';

                if (sdValue) {
                    const sdId = sdValue.toLowerCase();
                    if (!accountsToCreate.has(sdId)) {
                        accountsToCreate.set(sdId, {
                            crmId: sdValue, role: 'sd', sd: '', sm: '', tl: '', team: ''
                        });
                    }
                }
                
                if (smValue) {
                    const smId = smValue.toLowerCase();
                    if (!accountsToCreate.has(smId)) {
                        accountsToCreate.set(smId, {
                            crmId: smValue, role: 'sm', sd: sdValue, sm: '', tl: '', team: ''
                        });
                    } else {
                        const existing = accountsToCreate.get(smId);
                        if (!existing.sd && sdValue) existing.sd = sdValue;
                    }
                }

                if (tlValue) {
                    const tlId = tlValue.toLowerCase();
                    if (!accountsToCreate.has(tlId)) {
                        accountsToCreate.set(tlId, {
                            crmId: tlValue, role: 'tl', sd: sdValue, sm: smValue, tl: '', team: ''
                        });
                    } else {
                        const existing = accountsToCreate.get(tlId);
                        if (!existing.sd && sdValue) existing.sd = sdValue;
                        if (!existing.sm && smValue) existing.sm = smValue;
                    }
                }

                if (row.CRM && row.CRM.trim()) {
                    const crmId = row.CRM.trim();
                    const crmIdLower = crmId.toLowerCase();
                    
                    let role = 'user';
                    if (row.Position?.toUpperCase() === 'TL') role = 'tl';
                    if (row.Position?.toUpperCase() === 'SM') role = 'sm';
                    if (row.Position?.toUpperCase() === 'SD') role = 'sd';

                    const existing = accountsToCreate.get(crmIdLower);
                    
                    accountsToCreate.set(crmIdLower, {
                        crmId: existing?.crmId || crmId,
                        role: role !== 'user' ? role : (existing?.role && existing.role !== 'user' ? existing.role : 'user'),
                        sd: sdValue || existing?.sd || '',
                        sm: smValue || existing?.sm || '',
                        tl: tlValue || existing?.tl || '',
                        team: teamValue || existing?.team || ''
                    });
                }
            });

            const validRows = Array.from(accountsToCreate.values());
            setTotal(validRows.length);
            setProgress(0);

            // Initialize secondary app to avoid logging out current super admin
            const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
            const secondaryAuth = getAuth(secondaryApp);

            let successCount = 0;

            for (let i = 0; i < validRows.length; i++) {
                const row = validRows[i];
                try {
                    const crmId = row.crmId;
                    const email = `${crmId.replace(/\s+/g, '')}@mecc.com`.toLowerCase();
                    const password = '123456';

                    let role = row.role;

                    const existingUser = users.find(u => u.crmId.trim().toLowerCase() === crmId.trim().toLowerCase());
                    if (existingUser) {
                        await updateDoc(doc(db, 'users', existingUser.id), {
                            role: role !== 'user' ? role : (existingUser.role && existingUser.role !== 'user' ? existingUser.role : 'user'),
                            sd: row.sd || existingUser.sd || '',
                            sm: row.sm || existingUser.sm || '',
                            tl: row.tl || existingUser.tl || '',
                            team: row.team || existingUser.team || ''
                        });
                        successCount++;
                        setStatusLog(prev => [{msg: `[更新] ${crmId} 架构已更新`, type: 'success'}, ...prev]);
                        setProgress(i + 1);
                        continue;
                    }
                    
                    if (i > 0 && i % 10 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }

                    let userCredential;
                    let retryCount = 3;
                    let backoff = 3000;
                    
                    while (retryCount > 0) {
                        try {
                            userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                            break;
                        } catch (error: any) {
                            if (error.code === 'auth/too-many-requests' && retryCount > 1) {
                                setStatusLog(prev => [{msg: `[Rate Limit] 触发频率限制，等待 ${backoff/1000} 秒后重试 ${crmId}...`, type: 'error'}, ...prev]);
                                await new Promise(resolve => setTimeout(resolve, backoff));
                                backoff *= 2;
                                retryCount--;
                            } else {
                                throw error;
                            }
                        }
                    }

                    if (!userCredential) throw new Error("Creation failed after retries");

                    const uid = userCredential.user.uid;

                    await setDoc(doc(db, 'users', uid), {
                        crmId: crmId,
                        role: role,
                        sd: row.sd,
                        sm: row.sm,
                        tl: row.tl,
                        team: row.team,
                        createdAt: serverTimestamp()
                    });

                    successCount++;
                    setStatusLog(prev => [{msg: `${t('user_manager.import_ok')}${crmId}`, type: 'success'}, ...prev]);
                } catch (error: any) {
                    if (error.code === 'auth/email-already-in-use') {
                        setStatusLog(prev => [{msg: `${t('user_manager.account_exists')}${row.crmId}`, type: 'error'}, ...prev]);
                    } else {
                        setStatusLog(prev => [{msg: `${t('user_manager.import_fail')}${row.crmId}: ${error.message}`, type: 'error'}, ...prev]);
                    }
                }
                setProgress(i + 1);
            }

            await deleteApp(secondaryApp);
            const completeMsg = t('user_manager.import_success').replace('{{success}}', successCount.toString()).replace('{{total}}', validRows.length.toString());
            setStatusLog(prev => [{msg: completeMsg, type: 'success'}, ...prev]);
            fetchUsers();

        } catch (err) {
            console.error(err);
            setStatusLog(prev => [{msg: t('user_manager.parse_error'), type: 'error'}, ...prev]);
        } finally {
            setLoading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleDeleteUser = async (uid: string) => {
        if (!window.confirm(t('user_manager.confirm_delete', '确定要删除该账号吗？'))) return;
        try {
            const res = await fetch('/api/manageUser', {
                method: 'POST',
                body: JSON.stringify({ action: 'delete', uid })
            });
            if (!res.ok) throw new Error('Backend failed');
            await deleteDoc(doc(db, 'users', uid));
            fetchUsers();
            alert(t('user_manager.delete_success', '已删除！'));
        } catch(err) {
            alert(t('user_manager.backend_error', '操作失败，请检查配置'));
            console.error(err);
        }
    };

    const handleResetPassword = async (uid: string) => {
        if (!window.confirm(t('user_manager.confirm_reset', '确定重置密码吗？'))) return;
        try {
            const res = await fetch('/api/manageUser', {
                method: 'POST',
                body: JSON.stringify({ action: 'resetPassword', uid })
            });
            if (!res.ok) throw new Error('Backend failed');
            alert(t('user_manager.reset_success', '密码重置成功！'));
        } catch(err) {
            alert(t('user_manager.backend_error', '操作失败，请检查配置'));
            console.error(err);
        }
    };

    const openEditModal = (u: UserRecord) => {
        setFormData({
            crmId: u.crmId,
            role: u.role || 'user',
            sd: u.sd || '',
            sm: u.sm || '',
            tl: u.tl || '',
            team: u.team || ''
        });
        setSelectedUserId(u.id);
        setEditMode(true);
        setShowModal(true);
    };

    const handleSaveUser = async () => {
        try {
            if (editMode && selectedUserId) {
                await updateDoc(doc(db, 'users', selectedUserId), {
                    role: formData.role,
                    sd: formData.sd,
                    sm: formData.sm,
                    tl: formData.tl,
                    team: formData.team
                });
                fetchUsers();
                setShowModal(false);
                alert(t('user_manager.save_success', '保存成功！'));
            } else {
                if (!formData.crmId.trim()) return;
                const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp" + Date.now());
                const secondaryAuth = getAuth(secondaryApp);
                const email = `${formData.crmId.trim().replace(/\s+/g, '')}@mecc.com`.toLowerCase();
                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, '123456');
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    crmId: formData.crmId.trim(),
                    role: formData.role,
                    sd: formData.sd,
                    sm: formData.sm,
                    tl: formData.tl,
                    team: formData.team,
                    createdAt: serverTimestamp()
                });
                await deleteApp(secondaryApp);
                fetchUsers();
                setShowModal(false);
                alert(t('user_manager.save_success', '保存成功！'));
            }
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="animate-in fade-in duration-500 space-y-8 pb-10">
            <div>
                <h1 className="text-3xl font-bold text-deep-teal">{t('user_manager.title')}</h1>
                <p className="text-arabian-night/60 mt-1">{t('user_manager.desc')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Upload Section */}
                <div className="glass-panel rounded-2xl p-6 border border-desert-gold/20 h-fit">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-deep-teal flex items-center gap-2">
                            <Upload className="text-desert-gold" />
                            {t('user_manager.upload_excel')}
                        </h2>
                        <button 
                            onClick={() => { setEditMode(false); setFormData({ crmId: '', role: 'user', sd: '', sm: '', tl: '', team: '' }); setShowModal(true); }} 
                            className="text-sm bg-desert-gold text-white px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm hover:bg-yellow-600 transition-colors"
                        >
                            <Plus className="w-4 h-4" /> {t('user_manager.add_account', '新增账号')}
                        </button>
                    </div>
                    
                    <div className="mb-6 bg-white/50 p-4 rounded-xl text-sm text-arabian-night/70">
                        <p className="font-bold text-deep-teal mb-2">{t('user_manager.format_req')}</p>
                        <p>SD | SM | TL | CRM | Team | Position</p>
                        <p className="mt-2 text-xs opacity-70">{t('user_manager.format_tip')}</p>
                    </div>

                    <div className="relative">
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileUpload}
                            disabled={loading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className={`w-full p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors ${loading ? 'border-gray-300 bg-gray-50' : 'border-desert-gold/50 bg-desert-gold/5 hover:bg-desert-gold/10'}`}>
                            <Upload className={`h-10 w-10 mb-3 ${loading ? 'text-gray-400' : 'text-desert-gold'}`} />
                            <p className="font-bold text-deep-teal">{loading ? t('common.processing') : t('user_manager.click_to_upload')}</p>
                        </div>
                    </div>

                    {loading && total > 0 && (
                        <div className="mt-4">
                            <div className="flex justify-between text-xs text-deep-teal mb-1 font-semibold">
                                <span>{t('user_manager.import_progress')}</span>
                                <span>{progress} / {total}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-desert-gold h-2 rounded-full transition-all" style={{ width: `${(progress/total)*100}%` }}></div>
                            </div>
                        </div>
                    )}

                    {statusLog.length > 0 && (
                        <div className="mt-6 bg-white/60 rounded-xl p-4 h-48 overflow-y-auto text-xs font-mono border border-arabian-night/10">
                            {statusLog.map((log, i) => (
                                <div key={i} className={`mb-1 ${log.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>
                                    {log.msg}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Users List Section */}
                <div className="glass-panel rounded-2xl p-6 border border-white/40 h-[650px] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-deep-teal flex items-center gap-2">
                            <Users className="text-desert-gold" />
                            {t('user_manager.current_accounts')} ({users.length})
                        </h2>
                    </div>

                    <div className="relative mb-4">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder={t('user_manager.search_placeholder', '搜索 CRM, Team, SD...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold focus:border-transparent outline-none bg-white/60"
                        />
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {filteredUsers.map(u => (
                            <div key={u.id} className="bg-white/60 p-4 rounded-xl border border-transparent hover:border-desert-gold/30 flex justify-between items-center group">
                                <div>
                                    <h3 className="font-bold text-arabian-night flex items-center gap-2">
                                        {u.crmId}
                                        {u.role === 'super_admin' && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Super Admin</span>}
                                        {u.role === 'sd' && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">SD</span>}
                                        {u.role === 'sm' && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">SM</span>}
                                        {u.role === 'tl' && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">TL</span>}
                                    </h3>
                                    <div className="text-xs text-arabian-night/60 mt-1 flex gap-3">
                                        <span>SD: {u.sd || '-'}</span>
                                        {u.role !== 'sm' && u.role !== 'sd' && <span>SM: {u.sm || '-'}</span>}
                                        {u.role === 'user' && <span>TL: {u.tl || '-'}</span>}
                                        <span>Team: {u.team || '-'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditModal(u)} title={t('user_manager.edit_account', '编辑')} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleResetPassword(u.id)} title={t('user_manager.reset_password', '重置密码')} className="p-1.5 text-orange-500 hover:bg-orange-50 rounded">
                                        <Key className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteUser(u.id)} title={t('user_manager.delete_account', '删除')} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-arabian-night/60 backdrop-blur-sm">
                    <div className="bg-warm-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-white">
                            <h2 className="text-xl font-bold text-deep-teal">
                                {editMode ? t('user_manager.edit_modal_title', '编辑账号') : t('user_manager.add_modal_title', '新增账号')}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 font-bold"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-arabian-night/80 mb-1">{t('user_manager.label_crm', 'CRM ID')}</label>
                                <input 
                                    type="text" 
                                    value={formData.crmId} 
                                    onChange={e => setFormData({...formData, crmId: e.target.value.toLowerCase()})}
                                    disabled={editMode}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold disabled:bg-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-arabian-night/80 mb-1">{t('user_manager.label_role', 'Role')}</label>
                                <select 
                                    value={formData.role} 
                                    onChange={e => setFormData({...formData, role: e.target.value})}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold bg-white"
                                >
                                    <option value="user">CC</option>
                                    <option value="tl">Team Leader (TL)</option>
                                    <option value="sm">Sales Manager (SM)</option>
                                    <option value="sd">Sales Director (SD)</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>
                            
                            {formData.role !== 'super_admin' && formData.role !== 'sd' && (
                                <div>
                                    <label className="block text-sm font-bold text-arabian-night/80 mb-1">{t('user_manager.label_sd', 'SD')}</label>
                                    <input 
                                        type="text" 
                                        list="sd-options"
                                        value={formData.sd} 
                                        onChange={e => setFormData({...formData, sd: e.target.value})}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold bg-white"
                                        placeholder="选择或输入 SD"
                                    />
                                    <datalist id="sd-options">
                                        {uniqueSDs.map(sd => <option key={sd} value={sd} />)}
                                    </datalist>
                                </div>
                            )}

                            {(formData.role === 'user' || formData.role === 'tl') && (
                                <div>
                                    <label className="block text-sm font-bold text-arabian-night/80 mb-1">{t('user_manager.label_sm', 'SM')}</label>
                                    <input 
                                        type="text" 
                                        list="sm-options"
                                        value={formData.sm} 
                                        onChange={e => setFormData({...formData, sm: e.target.value})}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold bg-white"
                                        placeholder="选择或输入 SM"
                                    />
                                    <datalist id="sm-options">
                                        {uniqueSMs.map(sm => <option key={sm} value={sm} />)}
                                    </datalist>
                                </div>
                            )}

                            {formData.role === 'user' && (
                                <div>
                                    <label className="block text-sm font-bold text-arabian-night/80 mb-1">{t('user_manager.label_tl', 'TL')}</label>
                                    <input 
                                        type="text" 
                                        list="tl-options"
                                        value={formData.tl} 
                                        onChange={e => setFormData({...formData, tl: e.target.value})}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold bg-white"
                                        placeholder="选择或输入 TL"
                                    />
                                    <datalist id="tl-options">
                                        {uniqueTLs.map(tl => <option key={tl} value={tl} />)}
                                    </datalist>
                                </div>
                            )}

                            {formData.role !== 'super_admin' && formData.role !== 'sd' && (
                                <div>
                                    <label className="block text-sm font-bold text-arabian-night/80 mb-1">{t('user_manager.label_team', 'Team')}</label>
                                    <input 
                                        type="text" 
                                        list="team-options"
                                        value={formData.team} 
                                        onChange={e => setFormData({...formData, team: e.target.value})}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold bg-white"
                                        placeholder="选择或输入 Team"
                                    />
                                    <datalist id="team-options">
                                        {uniqueTeams.map(team => <option key={team} value={team} />)}
                                    </datalist>
                                </div>
                            )}
                        </div>
                        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-200">
                                {t('user_manager.btn_cancel', '取消')}
                            </button>
                            <button onClick={handleSaveUser} className="px-5 py-2 rounded-lg text-sm font-bold bg-deep-teal text-white hover:bg-teal-700">
                                {t('user_manager.btn_save', '保存')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
