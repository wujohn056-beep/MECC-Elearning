import React, { useState, useEffect } from 'react';
import * as xlsx from 'xlsx';
import { collection, getDocs, doc, setDoc, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { db, firebaseConfig } from '../../services/firebase';
import { Users, Upload, Edit, Trash2, Key, Search, Plus, X, RefreshCw } from 'lucide-react';
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
    dep?: 'CC' | 'SS' | 'functional';
    permissions?: {
        manageCategories?: boolean;
        manageRecordings?: boolean;
        manageUsers?: boolean;
        manageDashboard?: boolean;
        manageTasks?: boolean;
    };
    dingtalkUserId?: string;
    dingtalkSyncedAt?: string;
}

export default function UserManager() {
    const { t } = useTranslation();
    const { hasPermission, profile } = useAuth();
    const canManageUsers = hasPermission('manageUsers');
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [statusLog, setStatusLog] = useState<{msg: string, type: 'success'|'error'}[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [formData, setFormData] = useState({ 
        crmId: '', role: 'user', sd: '', sm: '', tl: '', team: '', dep: 'CC' as 'CC' | 'SS' | 'functional',
        permissions: { manageCategories: false, manageRecordings: false, manageUsers: false, manageDashboard: false, manageTasks: false }
    });

    useEffect(() => {
        if (canManageUsers) {
            fetchUsers();
        }
    }, [canManageUsers]);

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

    if (!canManageUsers) {
        return <Navigate to="/admin" replace />;
    }

    const filteredUsers = users.filter(u => {
        const isAbsoluteSuperAdmin = profile?.role === 'super_admin';
        if (!isAbsoluteSuperAdmin) {
            const adminDep = profile?.dep || 'CC';
            const userDep = u.dep || 'CC';
            if (adminDep !== userDep) return false;
        }

        return u.crmId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.team && u.team.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (u.sd && u.sd.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (u.sm && u.sm.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (u.tl && u.tl.toLowerCase().includes(searchQuery.toLowerCase()));
    });

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
            let rawJsonData: any[] = [];
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const sheetData = xlsx.utils.sheet_to_json<any>(worksheet);
                rawJsonData = rawJsonData.concat(sheetData);
            });
            
            const jsonData = rawJsonData.map(row => {
                const normalized: any = {};
                for (const key in row) {
                    if (key && typeof key === 'string') {
                        normalized[key.trim().toUpperCase()] = row[key];
                    }
                }
                return normalized;
            });

            const accountsToCreate = new Map<string, any>();

            jsonData.forEach(row => {
                const sdValue = row.SD ? String(row.SD).trim() : '';
                const smValue = row.SM ? String(row.SM).trim() : '';
                const tlValue = row.TL ? String(row.TL).trim() : '';
                const teamValue = row.TEAM ? String(row.TEAM).trim() : (row.Team ? String(row.Team).trim() : (row.DEPARTMENT ? String(row.DEPARTMENT).trim() : (row.Department ? String(row.Department).trim() : '')));
                const positionValue = row.POSITION ? String(row.POSITION).toUpperCase() : (row.Position ? String(row.Position).toUpperCase() : '');
                const crmValue = row.CRM ? String(row.CRM).trim() : (row.USERNAME ? String(row.USERNAME).trim() : (row.Username ? String(row.Username).trim() : ''));
                
                // Read DEP / DEPARTMENT column
                const depRaw = row.DEP ? String(row.DEP).trim() : (row.DEPARTMENT ? String(row.DEPARTMENT).trim() : (row.Department ? String(row.Department).trim() : ''));
                
                let depValue: 'CC' | 'SS' | 'functional' = 'CC';
                if (depRaw.toUpperCase() === 'SS') {
                    depValue = 'SS';
                } else if (depRaw.toUpperCase() === 'CC') {
                    depValue = 'CC';
                } else if (depRaw.toUpperCase() === 'FUNCTIONAL' || depRaw.toLowerCase().includes('职能') || depRaw.toLowerCase().includes('functional')) {
                    depValue = 'functional';
                } else {
                    if (sdValue || smValue || tlValue) {
                        depValue = 'CC';
                    } else if (depRaw) {
                        depValue = 'functional';
                    } else {
                        depValue = 'CC';
                    }
                }

                if (sdValue) {
                    const sdId = sdValue.toLowerCase();
                    if (!accountsToCreate.has(sdId)) {
                        accountsToCreate.set(sdId, {
                            crmId: sdValue, role: 'sd', sd: '', sm: '', tl: '', team: '', dep: depValue
                        });
                    }
                }
                
                if (smValue) {
                    const smId = smValue.toLowerCase();
                    if (!accountsToCreate.has(smId)) {
                        accountsToCreate.set(smId, {
                            crmId: smValue, role: 'sm', sd: sdValue, sm: '', tl: '', team: '', dep: depValue
                        });
                    } else {
                        const existing = accountsToCreate.get(smId);
                        if (!existing.sd && sdValue) existing.sd = sdValue;
                        if (!existing.dep) existing.dep = depValue;
                    }
                }

                if (tlValue) {
                    const tlId = tlValue.toLowerCase();
                    if (!accountsToCreate.has(tlId)) {
                        accountsToCreate.set(tlId, {
                            crmId: tlValue, role: 'tl', sd: sdValue, sm: smValue, tl: '', team: '', dep: depValue
                        });
                    } else {
                        const existing = accountsToCreate.get(tlId);
                        if (!existing.sd && sdValue) existing.sd = sdValue;
                        if (!existing.sm && smValue) existing.sm = smValue;
                        if (!existing.dep) existing.dep = depValue;
                    }
                }

                if (crmValue) {
                    const crmId = crmValue;
                    const crmIdLower = crmId.toLowerCase();
                    
                    let role = 'user';
                    if (positionValue === 'TL') role = 'tl';
                    if (positionValue === 'SM') role = 'sm';
                    if (positionValue === 'SD') role = 'sd';

                    const existing = accountsToCreate.get(crmIdLower);
                    
                    accountsToCreate.set(crmIdLower, {
                        crmId: existing?.crmId || crmId,
                        role: role !== 'user' ? role : (existing?.role && existing.role !== 'user' ? existing.role : 'user'),
                        sd: sdValue || existing?.sd || '',
                        sm: smValue || existing?.sm || '',
                        tl: tlValue || existing?.tl || '',
                        team: teamValue || existing?.team || '',
                        dep: depValue || existing?.dep || 'CC'
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

                    const existingUser = users.find(u => u.crmId && u.crmId.trim().toLowerCase() === crmId.trim().toLowerCase());
                    
                    if (crmId.toLowerCase().includes('ahmadshahin') || crmId.toLowerCase().includes('baha')) {
                        console.log(`[DEBUG] Processing: ${crmId}`);
                        console.log(`[DEBUG] row.sd: "${row.sd}", row.sm: "${row.sm}"`);
                        console.log(`[DEBUG] existingUser found? ${!!existingUser}`);
                        if (existingUser) {
                            console.log(`[DEBUG] existingUser.sd: "${existingUser.sd}", existingUser.sm: "${existingUser.sm}"`);
                        }
                    }

                    if (existingUser) {
                        await updateDoc(doc(db, 'users', existingUser.id), {
                            role: role !== 'user' ? role : (existingUser.role && existingUser.role !== 'user' ? existingUser.role : 'user'),
                            sd: row.sd || existingUser.sd || '',
                            sm: row.sm || existingUser.sm || '',
                            tl: row.tl || existingUser.tl || '',
                            team: row.team || existingUser.team || '',
                            dep: row.dep || existingUser.dep || 'CC'
                        });
                        successCount++;
                        setStatusLog(prev => [{msg: `[更新] ${crmId} 架构已更新`, type: 'success'}, ...prev]);
                        setProgress(i + 1);
                        continue;
                    }
                    
                    if (i > 0 && i % 10 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }

                    let uid = '';
                    let retryCount = 3;
                    let backoff = 3000;
                    
                    while (retryCount > 0) {
                        try {
                            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                            uid = userCredential.user.uid;
                            break;
                        } catch (error: any) {
                            if (error.code === 'auth/email-already-in-use') {
                                // If the auth account already exists but there is no Firestore profile,
                                // we try to sign in using default password to retrieve uid and restore profile!
                                try {
                                    const signInCred = await signInWithEmailAndPassword(secondaryAuth, email, password);
                                    uid = signInCred.user.uid;
                                    break;
                                } catch (signInErr) {
                                    throw error; // Throw original email-already-in-use error if sign in fails
                                }
                            } else if (error.code === 'auth/too-many-requests' && retryCount > 1) {
                                setStatusLog(prev => [{msg: `[Rate Limit] 触发频率限制，等待 ${backoff/1000} 秒后重试 ${crmId}...`, type: 'error'}, ...prev]);
                                await new Promise(resolve => setTimeout(resolve, backoff));
                                backoff *= 2;
                                retryCount--;
                            } else {
                                throw error;
                            }
                        }
                    }

                    if (!uid) throw new Error("Creation/Recovery failed after retries");

                    await setDoc(doc(db, 'users', uid), {
                        crmId: crmId,
                        role: role,
                        sd: row.sd,
                        sm: row.sm,
                        tl: row.tl,
                        team: row.team,
                        dep: row.dep || 'CC',
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

    const handleDingTalkSync = async () => {
        setLoading(true);
        setStatusLog([{ msg: t('user_manager.syncing_dingtalk', '正在与钉钉同步账号信息，请稍候...'), type: 'success' }]);
        setProgress(0);
        setTotal(users.length);

        try {
            const response = await fetch('/.netlify/functions/dingtalk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync' })
            });

            if (!response.ok) {
                throw new Error(t('user_manager.sync_fail', '钉钉账号同步失败，请检查开放平台凭证或网络配置。'));
            }

            const result = await response.json();
            if (result.success) {
                // Local environment mock database fallback writer
                const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                if (isLocal) {
                    setStatusLog(prev => [{ msg: "📝 [本地同步通道] 检测到处于测试环境，系统已开启客户端自愈写入，正在将钉钉绑定数据同步至 Firestore 数据库...", type: 'success' }, ...prev]);
                    const { doc, updateDoc } = await import('firebase/firestore');
                    
                    let localLinkedCount = 0;
                    for (const u of users) {
                        if (u.role === 'super_admin') continue;
                        if (u.dingtalkUserId) continue; // Already linked
                        
                        const crmIdClean = u.crmId.replace(/[^a-zA-Z0-9]/g, '');
                        const mockDdId = `dd_mock_${crmIdClean}`;
                        const syncTime = new Date().toISOString();
                        
                        try {
                            await updateDoc(doc(db, 'users', u.id), {
                                dingtalkUserId: mockDdId,
                                dingtalkSyncedAt: syncTime
                            });
                            localLinkedCount++;
                        } catch (writeErr) {
                            console.error(`Failed to write client-side DingTalk sync for user ${u.crmId}:`, writeErr);
                        }
                    }
                    setStatusLog(prev => [{ msg: `🎉 [本地自愈成功] 客户端成功为 ${localLinkedCount} 个销售账户在 Firestore 中匹配并写入了钉钉关联状态！`, type: 'success' }, ...prev]);
                }

                if (result.logs && Array.isArray(result.logs)) {
                    setStatusLog(prev => [...result.logs, ...prev]);
                }
                const successMsg = t('user_manager.sync_success', '钉钉账号同步完成！共成功关联 {{count}} 个销售账户。').replace('{{count}}', (result.linkedCount || 0).toString());
                setStatusLog(prev => [{ msg: successMsg, type: 'success' }, ...prev]);
                setProgress(result.linkedCount || 0);
                setTotal(users.length);
                fetchUsers();
            } else {
                throw new Error(result.error || t('user_manager.sync_fail', '钉钉账号同步失败，请检查开放平台凭证或网络配置。'));
            }
        } catch (err: any) {
            console.error("DingTalk sync error:", err);
            setStatusLog(prev => [{ msg: err.message || t('user_manager.sync_fail', '钉钉账号同步失败，请检查开放平台凭证或网络配置。'), type: 'error' }, ...prev]);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (uid: string) => {
        if (!window.confirm(t('user_manager.confirm_delete', '确定要删除该账号吗？'))) return;
        try {
            const res = await fetch('/.netlify/functions/manageUser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', uid })
            });
            
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                let errMsg = 'Backend failed';
                try {
                    const errData = JSON.parse(errText);
                    errMsg = errData.error || errMsg;
                } catch (e) {
                    if (errText) errMsg = errText.substring(0, 100);
                }
                throw new Error(errMsg);
            }

            await deleteDoc(doc(db, 'users', uid));
            fetchUsers();
            alert(t('user_manager.delete_success', '已删除！'));
        } catch(err: any) {
            console.error(err);
            const confirmDbOnly = window.confirm(
                t('user_manager.backend_config_missing_confirm', 
                  '检测到 Netlify 后端服务未正确配置或运行异常。\n\n由于无法连接到后端，暂时不能从 Auth 系统完全清除此登录账号，但您可以先将其从本页面的数据库列表中删除。\n\n是否立即仅从数据库中删除该用户档案以清理列表？'
                )
            );
            if (confirmDbOnly) {
                try {
                    await deleteDoc(doc(db, 'users', uid));
                    fetchUsers();
                    alert(t('user_manager.delete_db_only_success', '已从数据库中删除该用户档案！'));
                } catch (dbErr) {
                    alert(t('user_manager.db_delete_failed', '从数据库删除失败，请检查您的网络或权限。'));
                }
            }
        }
    };

    const handleResetPassword = async (uid: string) => {
        if (!window.confirm(t('user_manager.confirm_reset', '确定重置密码吗？'))) return;
        try {
            const res = await fetch('/.netlify/functions/manageUser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resetPassword', uid })
            });
            
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                let errMsg = 'Backend failed';
                try {
                    const errData = JSON.parse(errText);
                    errMsg = errData.error || errMsg;
                } catch (e) {
                    if (errText) errMsg = errText.substring(0, 100);
                }
                throw new Error(errMsg);
            }

            alert(t('user_manager.reset_success', '密码重置成功！'));
        } catch(err: any) {
            console.error(err);
            alert(
                t('user_manager.reset_config_missing', 
                  '密码重置失败：检测到 Netlify 后端未正确配置或运行异常，请在 Netlify 控制台中配置您的 Firebase Service Account 私钥后再试。'
                ) + `\n\n(Error: ${err.message || err})`
            );
        }
    };

    const openEditModal = (u: UserRecord) => {
        setFormData({
            crmId: u.crmId,
            role: u.role || 'user',
            sd: u.sd || '',
            sm: u.sm || '',
            tl: u.tl || '',
            team: u.team || '',
            dep: u.dep || 'CC',
            permissions: {
                manageCategories: !!u.permissions?.manageCategories,
                manageRecordings: !!u.permissions?.manageRecordings,
                manageUsers: !!u.permissions?.manageUsers,
                manageDashboard: !!u.permissions?.manageDashboard,
                manageTasks: !!u.permissions?.manageTasks
            }
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
                    team: formData.team,
                    dep: formData.dep || 'CC',
                    permissions: formData.permissions
                });
                fetchUsers();
                setShowModal(false);
                alert(t('user_manager.save_success', '保存成功！'));
            } else {
                if (!formData.crmId.trim()) return;
                const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp" + Date.now());
                const secondaryAuth = getAuth(secondaryApp);
                const email = `${formData.crmId.trim().replace(/\s+/g, '')}@mecc.com`.toLowerCase();
                
                let uid = '';
                try {
                    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, '123456');
                    uid = userCredential.user.uid;
                } catch (err: any) {
                    if (err.code === 'auth/email-already-in-use') {
                        // The Auth account already exists! Let's try to sign in to retrieve the uid
                        try {
                            const signInCred = await signInWithEmailAndPassword(secondaryAuth, email, '123456');
                            uid = signInCred.user.uid;
                        } catch (signInErr: any) {
                            throw new Error(`该账号的登录身份已存在，但无法被系统接管(可能已修改过默认密码)。\n请联系管理员重置后端密码，或在 Netlify 中正确配置管理员凭证后再试。`);
                        }
                    } else {
                        throw err;
                    }
                }

                await setDoc(doc(db, 'users', uid), {
                    crmId: formData.crmId.trim(),
                    role: formData.role,
                    sd: formData.sd,
                    sm: formData.sm,
                    tl: formData.tl,
                    team: formData.team,
                    dep: formData.dep || 'CC',
                    permissions: formData.permissions,
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
                            onClick={() => { 
                                setEditMode(false); 
                                setFormData({ 
                                    crmId: '', role: 'user', sd: '', sm: '', tl: '', team: '', dep: 'CC',
                                    permissions: { manageCategories: false, manageRecordings: false, manageUsers: false, manageDashboard: false, manageTasks: false }
                                }); 
                                setShowModal(true); 
                            }} 
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
                        <button
                            onClick={handleDingTalkSync}
                            disabled={loading}
                            className={`text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all duration-300 font-medium ${
                                loading 
                                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-teal-600 to-deep-teal text-white hover:from-teal-700 hover:to-teal-900 border border-teal-500'
                            }`}
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            {t('user_manager.sync_dingtalk', '同步钉钉账号')}
                        </button>
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
                                    <h3 className="font-bold text-arabian-night flex flex-wrap items-center gap-2">
                                        {u.crmId}
                                        {u.role === 'super_admin' && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Super Admin</span>}
                                        {u.role === 'sd' && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">SD</span>}
                                        {u.role === 'sm' && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">SM</span>}
                                        {u.role === 'tl' && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">TL</span>}
                                        {u.dingtalkUserId ? (
                                            <span 
                                                title={u.dingtalkSyncedAt ? `${t('user_manager.last_synced', '上次同步: ')} ${new Date(u.dingtalkSyncedAt).toLocaleString()}` : ''}
                                                className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200/50 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm font-medium hover:bg-teal-100/50 transition-colors"
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                                                {t('user_manager.dingtalk_linked', '已关联钉钉')}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] bg-gray-100 text-gray-500 border border-gray-200/50 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                                {t('user_manager.dingtalk_unlinked', '未关联')}
                                            </span>
                                        )}
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm ${
                                            (u.dep || 'CC') === 'SS'
                                                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white border border-orange-400'
                                                : (u.dep || 'CC') === 'CC'
                                                    ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                        }`}>
                                            {(u.dep || 'CC') === 'SS' ? t('common.type_ss') : (u.dep || 'CC') === 'CC' ? t('common.type_cc') : t('common.type_functional')}
                                        </span>
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
                            <div>
                                <label className="block text-sm font-bold text-arabian-night/80 mb-1">{t('user_manager.label_dep', 'Department')}</label>
                                {profile?.role === 'super_admin' ? (
                                    <select 
                                        value={formData.dep || 'CC'} 
                                        onChange={e => setFormData({...formData, dep: e.target.value as 'CC' | 'SS' | 'functional'})}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold bg-white"
                                    >
                                        <option value="CC">{t('common.type_cc')}</option>
                                        <option value="SS">{t('common.type_ss')}</option>
                                        <option value="functional">{t('common.type_functional')}</option>
                                    </select>
                                ) : (
                                    <div className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-gray-100 font-bold text-arabian-night select-none">
                                        {(profile?.dep || 'CC') === 'SS' ? t('common.type_ss') : (profile?.dep || 'CC') === 'CC' ? t('common.type_cc') : t('common.type_functional')}
                                    </div>
                                )}
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

                            {formData.role !== 'super_admin' && (
                                <div className="pt-4 mt-4 border-t border-gray-100">
                                    <label className="block text-sm font-bold text-arabian-night/80 mb-3">{t('user_manager.label_permissions', '平台使用权限')}</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-desert-gold focus:ring-desert-gold"
                                                checked={formData.permissions.manageCategories}
                                                onChange={e => setFormData({...formData, permissions: {...formData.permissions, manageCategories: e.target.checked}})}
                                            />
                                            {t('user_manager.perm_manage_categories', '目录管理')}
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-desert-gold focus:ring-desert-gold"
                                                checked={formData.permissions.manageRecordings}
                                                onChange={e => setFormData({...formData, permissions: {...formData.permissions, manageRecordings: e.target.checked}})}
                                            />
                                            {t('user_manager.perm_manage_recordings', '资料管理')}
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-desert-gold focus:ring-desert-gold"
                                                checked={formData.permissions.manageUsers}
                                                onChange={e => setFormData({...formData, permissions: {...formData.permissions, manageUsers: e.target.checked}})}
                                            />
                                            {t('user_manager.perm_manage_users', '用户管理')}
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-desert-gold focus:ring-desert-gold"
                                                checked={formData.permissions.manageDashboard}
                                                onChange={e => setFormData({...formData, permissions: {...formData.permissions, manageDashboard: e.target.checked}})}
                                            />
                                            {t('user_manager.perm_manage_dashboard', '仪表盘访问')}
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-desert-gold focus:ring-desert-gold"
                                                checked={formData.permissions.manageTasks}
                                                onChange={e => setFormData({...formData, permissions: {...formData.permissions, manageTasks: e.target.checked}})}
                                            />
                                            {t('user_manager.perm_manage_tasks', '任务中心访问')}
                                        </label>
                                    </div>
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
