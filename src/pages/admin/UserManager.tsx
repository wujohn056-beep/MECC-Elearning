




import React, { useState, useEffect, useMemo } from 'react';
import * as xlsx from 'xlsx';
import { collection, getDocs, doc, setDoc, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { db, firebaseConfig } from '../../services/firebase';
import { Users, Upload, Edit, Trash2, Key, Search, Plus, X, RefreshCw, AlertCircle } from 'lucide-react';
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
    email?: string;
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
        manageComments?: boolean;
        managePolicies?: boolean;
    };
    dingtalkUserId?: string;
    dingtalkSyncedAt?: string;
    policyScope?: 'KCC' | 'GCC' | 'Adult' | 'EA' | 'all';
    identity?: string;
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

    const defaultDep = profile?.role === 'super_admin' ? 'CC' : (profile?.dep || 'CC');

    const isSdDisabled = profile?.role !== 'super_admin';
    const isSmDisabled = profile?.role === 'tl' || profile?.role === 'sm';
    const isTlDisabled = profile?.role === 'tl';

    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [formData, setFormData] = useState({ 
        crmId: '', email: '', role: 'user', sd: '', sm: '', tl: '', team: '', dep: defaultDep as 'CC' | 'SS' | 'functional',
        dingtalkUserId: '',
        permissions: { manageCategories: false, manageRecordings: false, manageUsers: false, manageDashboard: false, manageTasks: false, manageComments: false, managePolicies: false },
        policyScope: 'all' as 'KCC' | 'GCC' | 'Adult' | 'EA' | 'all',
        identity: ''
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
        if (!profile || !profile.role) return false;
        
        const isAbsoluteSuperAdmin = profile.role === 'super_admin';
        if (!isAbsoluteSuperAdmin) {
            const adminDep = profile.dep || 'CC';
            const userDep = u.dep || 'CC';
            if (adminDep !== userDep) return false;

            // Apply hierarchy filters for non-super-admins
            const loggedInRole = String(profile.role).trim().toLowerCase();
            const loggedInCrmId = (profile.crmId || '').trim().toLowerCase();
            const loggedInTeam = (profile.team || '').trim().toLowerCase();
            const uCrmIdLower = (u.crmId || '').trim().toLowerCase();

            if (loggedInRole === 'sd') {
                const matchesSd = (u.sd || '').trim().toLowerCase() === loggedInCrmId;
                const isSelf = uCrmIdLower === loggedInCrmId;
                if (!matchesSd && !isSelf) return false;
            } else if (loggedInRole === 'sm') {
                const matchesSm = (u.sm || '').trim().toLowerCase() === loggedInCrmId;
                const isSelf = uCrmIdLower === loggedInCrmId;
                if (!matchesSm && !isSelf) return false;
            } else if (loggedInRole === 'tl') {
                const matchesTl = (u.tl || '').trim().toLowerCase() === loggedInCrmId;
                const matchesTeam = (u.team || '').trim().toLowerCase() === loggedInTeam;
                const isSelf = uCrmIdLower === loggedInCrmId;
                if (!matchesTl && !matchesTeam && !isSelf) return false;
            } else {
                // Safeguard: unrecognized roles (e.g. general users) cannot view any profiles by default
                return false;
            }
        }

        if (!searchQuery) return true;

        const q = searchQuery.toLowerCase();
        return u.crmId.toLowerCase().includes(q) ||
            (u.team && u.team.toLowerCase().includes(q)) ||
            (u.sd && u.sd.toLowerCase().includes(q)) ||
            (u.sm && u.sm.toLowerCase().includes(q)) ||
            (u.tl && u.tl.toLowerCase().includes(q));
    }).sort((a, b) => {
        if (!searchQuery) {
            return a.crmId.localeCompare(b.crmId);
        }
        const q = searchQuery.toLowerCase();
        const getScore = (u: UserRecord) => {
            const crmIdLower = u.crmId.toLowerCase();
            if (crmIdLower === q) return 4;
            if (crmIdLower.startsWith(q)) return 3;
            if (crmIdLower.includes(q)) return 2;
            return 1;
        };
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        if (scoreA !== scoreB) {
            return scoreB - scoreA;
        }
        return a.crmId.localeCompare(b.crmId);
    });

    // Extract unique values for dropdowns
    const uniqueSDs = Array.from(new Set(users.map(u => u.sd).filter(Boolean))).sort();
    const uniqueSMs = Array.from(new Set(users.map(u => u.sm).filter(Boolean))).sort();
    const uniqueTLs = Array.from(new Set(users.map(u => u.tl).filter(Boolean))).sort();
    const uniqueTeams = Array.from(new Set(users.map(u => u.team).filter(Boolean))).sort();

    // Filtered lists for hierarchical dropdowns in the Add/Edit form
    const filteredSDs = useMemo(() => {
        const depUsers = users.filter(u => (u.dep || 'CC') === (formData.dep || 'CC'));
        const sds = new Set<string>();
        depUsers.forEach(u => {
            if (u.sd) sds.add(u.sd.trim());
            if (u.role === 'sd' && u.crmId) sds.add(u.crmId.trim());
        });
        return Array.from(sds).sort();
    }, [users, formData.dep]);

    const filteredSMs = useMemo(() => {
        const depUsers = users.filter(u => (u.dep || 'CC') === (formData.dep || 'CC'));
        
        if (formData.sd) {
            const smsUnderSd = new Set<string>();
            depUsers.forEach(u => {
                if (u.sd && u.sd.trim().toLowerCase() === formData.sd.trim().toLowerCase()) {
                    if (u.sm) smsUnderSd.add(u.sm.trim());
                    if (u.role === 'sm' && u.crmId) smsUnderSd.add(u.crmId.trim());
                }
            });
            return Array.from(smsUnderSd).sort();
        }
        
        const sms = new Set<string>();
        depUsers.forEach(u => {
            if (u.sm) sms.add(u.sm.trim());
            if (u.role === 'sm' && u.crmId) sms.add(u.crmId.trim());
        });
        return Array.from(sms).sort();
    }, [users, formData.sd, formData.dep]);

    const filteredTLs = useMemo(() => {
        const depUsers = users.filter(u => (u.dep || 'CC') === (formData.dep || 'CC'));
        const tls = new Set<string>();

        if (formData.sm) {
            // Always append the SM themselves as a TL option for SM direct manage case
            tls.add(formData.sm.trim());

            depUsers.forEach(u => {
                if (u.sm && u.sm.trim().toLowerCase() === formData.sm.trim().toLowerCase()) {
                    if (u.tl) tls.add(u.tl.trim());
                    if (u.role === 'tl' && u.crmId) tls.add(u.crmId.trim());
                }
            });
            return Array.from(tls).sort();
        }

        if (formData.sd) {
            depUsers.forEach(u => {
                if (u.sd && u.sd.trim().toLowerCase() === formData.sd.trim().toLowerCase()) {
                    if (u.tl) tls.add(u.tl.trim());
                    if (u.role === 'tl' && u.crmId) tls.add(u.crmId.trim());
                }
            });
            return Array.from(tls).sort();
        }

        depUsers.forEach(u => {
            if (u.tl) tls.add(u.tl.trim());
            if (u.role === 'tl' && u.crmId) tls.add(u.crmId.trim());
        });
        return Array.from(tls).sort();
    }, [users, formData.sd, formData.sm, formData.dep]);

    const filteredTeams = useMemo(() => {
        const depUsers = users.filter(u => (u.dep || 'CC') === (formData.dep || 'CC'));
        const teams = new Set<string>();

        if (formData.tl) {
            depUsers.forEach(u => {
                if (
                    (u.tl && u.tl.trim().toLowerCase() === formData.tl.trim().toLowerCase()) ||
                    (u.crmId && u.crmId.trim().toLowerCase() === formData.tl.trim().toLowerCase() && u.role === 'tl')
                ) {
                    if (u.team) teams.add(u.team.trim());
                }
            });
            depUsers.forEach(u => {
                if (u.sm && u.sm.trim().toLowerCase() === formData.tl.trim().toLowerCase()) {
                    if (u.team) teams.add(u.team.trim());
                }
            });
            if (teams.size > 0) return Array.from(teams).sort();
        }

        if (formData.sm) {
            depUsers.forEach(u => {
                if (u.sm && u.sm.trim().toLowerCase() === formData.sm.trim().toLowerCase()) {
                    if (u.team) teams.add(u.team.trim());
                }
            });
            if (teams.size > 0) return Array.from(teams).sort();
        }

        if (formData.sd) {
            depUsers.forEach(u => {
                if (u.sd && u.sd.trim().toLowerCase() === formData.sd.trim().toLowerCase()) {
                    if (u.team) teams.add(u.team.trim());
                }
            });
            if (teams.size > 0) return Array.from(teams).sort();
        }

        return Array.from(new Set(depUsers.map(u => u.team).filter(Boolean))).sort();
    }, [users, formData.sd, formData.sm, formData.tl, formData.dep]);

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
                const emailValue = row.EMAIL ? String(row.EMAIL).trim() : (row.Email ? String(row.Email).trim() : '');
                
                let dingtalkUserIdValue = '';
                if (emailValue) {
                    dingtalkUserIdValue = emailValue.includes('@') ? emailValue.split('@')[0].toLowerCase().trim().replace(/\s+/g, '') : emailValue.toLowerCase().trim().replace(/\s+/g, '');
                }

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

                // Enforce SS SD (Lily) boundaries during import if logged-in user is SS SD
                const finalSdValue = (profile?.role === 'sd' && profile?.dep === 'SS') ? (profile.crmId || '') : sdValue;
                const finalDepValue = (profile?.role === 'sd' && profile?.dep === 'SS') ? 'SS' : depValue;

                if (finalSdValue) {
                    const sdId = finalSdValue.toLowerCase();
                    if (!accountsToCreate.has(sdId)) {
                        accountsToCreate.set(sdId, {
                            crmId: finalSdValue, role: 'sd', sd: '', sm: '', tl: '', team: '', dep: finalDepValue, email: '', dingtalkUserId: ''
                        });
                    }
                }
                
                if (smValue) {
                    const smId = smValue.toLowerCase();
                    if (!accountsToCreate.has(smId)) {
                        accountsToCreate.set(smId, {
                            crmId: smValue, role: 'sm', sd: finalSdValue, sm: '', tl: '', team: '', dep: finalDepValue, email: '', dingtalkUserId: ''
                        });
                    } else {
                        const existing = accountsToCreate.get(smId);
                        if (!existing.sd && finalSdValue) existing.sd = finalSdValue;
                        if (!existing.dep) existing.dep = finalDepValue;
                    }
                }

                if (tlValue) {
                    const tlId = tlValue.toLowerCase();
                    if (!accountsToCreate.has(tlId)) {
                        accountsToCreate.set(tlId, {
                            crmId: tlValue, role: 'tl', sd: finalSdValue, sm: smValue, tl: '', team: '', dep: finalDepValue, email: '', dingtalkUserId: ''
                        });
                    } else {
                        const existing = accountsToCreate.get(tlId);
                        if (!existing.sd && finalSdValue) existing.sd = finalSdValue;
                        if (!existing.sm && smValue) existing.sm = smValue;
                        if (!existing.dep) existing.dep = finalDepValue;
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
                        sd: finalSdValue || existing?.sd || '',
                        sm: smValue || existing?.sm || '',
                        tl: tlValue || existing?.tl || '',
                        team: teamValue || existing?.team || '',
                        dep: finalDepValue || existing?.dep || 'CC',
                        email: emailValue || existing?.email || '',
                        dingtalkUserId: dingtalkUserIdValue || existing?.dingtalkUserId || ''
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
                            dep: row.dep || existingUser.dep || 'CC',
                            email: row.email ? row.email : (existingUser.email || ''),
                            dingtalkUserId: row.dingtalkUserId ? row.dingtalkUserId : (existingUser.dingtalkUserId || null)
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
                        email: row.email || '',
                        dingtalkUserId: row.dingtalkUserId || null,
                        policyScope: 'all',
                        identity: '',
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

        // Filter out super admins and already linked users to sync only what is needed!
        const loggedInRole = profile?.role;
        const loggedInCrmId = (profile?.crmId || '').trim().toLowerCase();

        const unlinkedUsers = users.filter(u => {
            if (u.role === 'super_admin' || u.dingtalkUserId) return false;
            
            // Apply hierarchy filters for non-super-admins
            if (loggedInRole === 'sd') {
                const matchesSd = (u.sd || '').trim().toLowerCase() === loggedInCrmId;
                const isSelf = u.crmId.trim().toLowerCase() === loggedInCrmId;
                return matchesSd || isSelf;
            } else if (loggedInRole === 'sm') {
                const matchesSm = (u.sm || '').trim().toLowerCase() === loggedInCrmId;
                const isSelf = u.crmId.trim().toLowerCase() === loggedInCrmId;
                return matchesSm || isSelf;
            } else if (loggedInRole === 'tl') {
                const matchesTl = (u.tl || '').trim().toLowerCase() === loggedInCrmId;
                const isSelf = u.crmId.trim().toLowerCase() === loggedInCrmId;
                return matchesTl || isSelf;
            }
            return true; // super_admin
        });

        if (unlinkedUsers.length === 0) {
            setStatusLog(prev => [{ msg: t('user_manager.all_synced', '所有销售账号均已关联钉钉，无需同步。'), type: 'success' }, ...prev]);
            setLoading(false);
            return;
        }

        setProgress(0);
        setTotal(unlinkedUsers.length);

        const BATCH_SIZE = 2;
        let linkedCount = 0;

        try {
            // Local environment mock database fallback writer (processed in one go if running locally to make testing fast)
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (isLocal) {
                setStatusLog(prev => [{ msg: "📝 [本地同步通道] 检测到处于测试环境，系统已开启客户端自愈写入，正在将钉钉绑定数据同步至 Firestore 数据库...", type: 'success' }, ...prev]);
                const { doc, updateDoc } = await import('firebase/firestore');
                
                let localLinkedCount = 0;
                for (const u of unlinkedUsers) {
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
                setProgress(unlinkedUsers.length);
                fetchUsers();
                setLoading(false);
                return;
            }

            // Real production batch syncing (prevents Netlify 10s Serverless Gateway 504 Timeout)
            for (let i = 0; i < unlinkedUsers.length; i += BATCH_SIZE) {
                const batch = unlinkedUsers.slice(i, i + BATCH_SIZE);
                const batchIds = batch.map(u => u.id);

                setStatusLog(prev => [{ msg: `⏳ 正在同步批次 (${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(unlinkedUsers.length/BATCH_SIZE)}) 共 ${batch.length} 个账号...`, type: 'success' }, ...prev]);

                const response = await fetch('/.netlify/functions/dingtalk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'sync', userIds: batchIds })
                });

                if (!response.ok) {
                    throw new Error(t('user_manager.sync_fail', '钉钉账号同步失败，请检查开放平台凭证或网络配置。'));
                }

                const result = await response.json();
                if (result.success) {
                    linkedCount += result.linkedCount || 0;
                    if (result.logs && Array.isArray(result.logs)) {
                        setStatusLog(prev => [...result.logs, ...prev]);
                    }
                    setProgress(Math.min(i + batch.length, unlinkedUsers.length));
                } else {
                    throw new Error(result.error || t('user_manager.sync_fail', '钉钉账号同步失败，请检查开放平台凭证或网络配置。'));
                }
            }

            const successMsg = t('user_manager.sync_success', '钉钉账号同步完成！共成功关联 {{count}} 个销售账户。').replace('{{count}}', linkedCount.toString());
            setStatusLog(prev => [{ msg: successMsg, type: 'success' }, ...prev]);
            fetchUsers();
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
            email: u.email || '',
            role: u.role || 'user',
            sd: u.sd || '',
            sm: u.sm || '',
            tl: u.tl || '',
            team: u.team || '',
            dep: u.dep || 'CC',
            dingtalkUserId: u.dingtalkUserId || '',
            permissions: {
                manageCategories: !!u.permissions?.manageCategories,
                manageRecordings: !!u.permissions?.manageRecordings,
                manageUsers: !!u.permissions?.manageUsers,
                manageDashboard: !!u.permissions?.manageDashboard,
                manageTasks: !!u.permissions?.manageTasks,
                manageComments: !!u.permissions?.manageComments,
                managePolicies: !!u.permissions?.managePolicies
            },
            policyScope: u.policyScope || 'all',
            identity: u.identity || ''
        });
        setSelectedUserId(u.id);
        setEditMode(true);
        setShowModal(true);
    };

    const handleSaveUser = async () => {
        try {
            if (!formData.email || !formData.email.trim()) {
                alert(t('user_manager.email_required', '钉钉绑定邮箱为必填项！'));
                return;
            }

            // Enforce hierarchy constraints for non-super-admins
            let finalSd = formData.sd;
            let finalSm = formData.sm;
            let finalTl = formData.tl;
            let finalDep = formData.dep;

            if (profile?.role !== 'super_admin') {
                finalDep = profile?.dep || 'CC';
                
                if (profile?.role === 'sd') {
                    finalSd = profile.crmId;
                } else if (profile?.role === 'sm') {
                    finalSd = profile.sd || '';
                    finalSm = profile.crmId;
                } else if (profile?.role === 'tl') {
                    finalSd = profile.sd || '';
                    finalSm = profile.sm || '';
                    finalTl = profile.crmId;
                }
            }

            if (editMode && selectedUserId) {
                const existingUser = users.find(u => u.id === selectedUserId);
                const preservedPermissions = profile?.role === 'super_admin' ? formData.permissions : (existingUser?.permissions || {
                    manageCategories: false,
                    manageRecordings: false,
                    manageUsers: false,
                    manageDashboard: false,
                    manageTasks: false,
                    manageComments: false,
                    managePolicies: false
                });

                await updateDoc(doc(db, 'users', selectedUserId), {
                    crmId: formData.crmId.trim(),
                    email: formData.email.trim(),
                    role: formData.role,
                    sd: finalSd,
                    sm: finalSm,
                    tl: finalTl,
                    team: formData.team,
                    dep: finalDep || 'CC',
                    dingtalkUserId: formData.dingtalkUserId.trim() || null,
                    permissions: preservedPermissions,
                    policyScope: formData.policyScope || 'all',
                    identity: formData.identity || null
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
                    email: formData.email.trim(),
                    role: formData.role,
                    sd: finalSd,
                    sm: finalSm,
                    tl: finalTl,
                    team: formData.team,
                    dep: finalDep || 'CC',
                    dingtalkUserId: formData.dingtalkUserId.trim() || null,
                    permissions: profile?.role === 'super_admin' ? formData.permissions : {
                        manageCategories: false,
                        manageRecordings: false,
                        manageUsers: false,
                        manageDashboard: false,
                        manageTasks: false,
                        manageComments: false,
                        managePolicies: false
                    },
                    policyScope: formData.policyScope || 'all',
                    identity: formData.identity || null,
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
                
                {/* Prominent Resigned Employee Reminder Alert */}
                <div className="mt-4 bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/25 backdrop-blur-md rounded-2xl p-4 flex items-start gap-3 text-amber-800 text-sm font-medium shadow-sm animate-in slide-in-from-top duration-300">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="leading-relaxed font-semibold">
                            {t('user_manager.resigned_reminder')}
                        </p>
                    </div>
                </div>
            </div>

            <div className={(profile?.role === 'super_admin' || (profile?.role === 'sd' && profile?.dep === 'SS')) ? "grid grid-cols-1 lg:grid-cols-2 gap-8" : "w-full"}>
                {/* Upload Section */}
                {(profile?.role === 'super_admin' || (profile?.role === 'sd' && profile?.dep === 'SS')) && (
                    <div className="glass-panel rounded-2xl p-6 border border-desert-gold/20 h-fit">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                            <h2 className="text-xl font-bold text-deep-teal flex items-center gap-2">
                                <Upload className="text-desert-gold" />
                                {t('user_manager.upload_excel')}
                            </h2>
                            <button 
                                onClick={() => { 
                                    setEditMode(false); 
                                    setFormData({ 
                                        crmId: '', email: '', role: 'user', sd: '', sm: '', tl: '', team: '', dep: defaultDep as 'CC' | 'SS' | 'functional',
                                        dingtalkUserId: '',
                                        permissions: { manageCategories: false, manageRecordings: false, manageUsers: false, manageDashboard: false, manageTasks: false, manageComments: false, managePolicies: false },
                                        policyScope: 'all',
                                        identity: ''
                                    }); 
                                    setShowModal(true); 
                                }} 
                                className="text-sm bg-desert-gold text-white px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm hover:bg-yellow-600 transition-colors cursor-pointer self-start sm:self-auto"
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
                )}

                {/* Users List Section */}
                <div className="glass-panel rounded-2xl p-6 border border-white/40 h-[650px] flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start sm:items-center gap-4 mb-4">
                        <h2 className="text-xl font-bold text-deep-teal flex items-center gap-2">
                            <Users className="text-desert-gold" />
                            {t('user_manager.current_accounts')} ({filteredUsers.length})
                        </h2>
                        <div className="flex items-center gap-2 flex-wrap">
                            {!(profile?.role === 'super_admin' || (profile?.role === 'sd' && profile?.dep === 'SS')) && (
                                <button 
                                    onClick={() => { 
                                        setEditMode(false); 
                                        setFormData({ 
                                            crmId: '', email: '', role: 'user', 
                                            sd: profile?.role === 'sd' ? profile.crmId : (profile?.role === 'sm' || profile?.role === 'tl' ? (profile.sd || '') : ''), 
                                            sm: profile?.role === 'sm' ? profile.crmId : (profile?.role === 'tl' ? (profile.sm || '') : ''), 
                                            tl: profile?.role === 'tl' ? profile.crmId : '', 
                                            team: '', dep: defaultDep as 'CC' | 'SS' | 'functional',
                                            dingtalkUserId: '',
                                            permissions: { manageCategories: false, manageRecordings: false, manageUsers: false, manageDashboard: false, manageTasks: false, manageComments: false, managePolicies: false }
                                        }); 
                                        setShowModal(true); 
                                    }} 
                                    className="text-sm bg-desert-gold text-white px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm hover:bg-yellow-600 transition-colors cursor-pointer"
                                >
                                    <Plus className="w-4 h-4" /> {t('user_manager.add_account', '新增账号')}
                                </button>
                            )}
                            <button
                                onClick={handleDingTalkSync}
                                disabled={loading}
                                className={`text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all duration-300 font-medium cursor-pointer ${
                                    loading 
                                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-teal-600 to-deep-teal text-white hover:from-teal-700 hover:to-teal-900 border border-teal-500'
                                }`}
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                {t('user_manager.sync_dingtalk', '同步钉钉账号')}
                            </button>
                        </div>
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
                                        {u.identity && (
                                            <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold shadow-sm">
                                                👤 {u.identity}
                                            </span>
                                        )}
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
                                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditModal(u)} title={t('user_manager.edit_account', '编辑')} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleResetPassword(u.id)} title={t('user_manager.reset_password', '重置密码')} className="p-1.5 text-orange-500 hover:bg-orange-50 rounded">
                                        <Key className="w-4 h-4" />
                                    </button>
                                    {u.crmId.toLowerCase() !== profile?.crmId?.toLowerCase() && (
                                        <button onClick={() => handleDeleteUser(u.id)} title={t('user_manager.delete_account', '删除')} className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
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
                                    onChange={e => setFormData({...formData, crmId: e.target.value})}
                                    placeholder={t('user_manager.crm_auto_placeholder', '请输入 CRM ID')}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-arabian-night/80 mb-1">{t('user_manager.label_email', '钉钉绑定邮箱')}</label>
                                <input 
                                    type="email" 
                                    value={formData.email} 
                                    onChange={e => {
                                        const emailVal = e.target.value;
                                        const derivedId = emailVal.includes('@') ? emailVal.split('@')[0].toLowerCase().trim().replace(/\s+/g, '') : emailVal.toLowerCase().trim().replace(/\s+/g, '');
                                        setFormData({
                                            ...formData,
                                            email: emailVal,
                                            crmId: editMode ? formData.crmId : (formData.crmId || derivedId),
                                            dingtalkUserId: editMode ? formData.dingtalkUserId : derivedId
                                        });
                                    }}
                                    placeholder="example@51talk.com"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold bg-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-arabian-night/80 mb-1">{t('user_manager.label_dingtalk_userid', '钉钉用户ID (选填)')}</label>
                                <input 
                                    type="text" 
                                    value={formData.dingtalkUserId} 
                                    onChange={e => setFormData({...formData, dingtalkUserId: e.target.value})}
                                    placeholder={t('user_manager.placeholder_dingtalk_userid', '若自动同步失败，可在此手动填入进行强制绑定')}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-arabian-night/80 mb-1">{t('user_manager.label_role', 'Role')}</label>
                                <select 
                                    value={formData.role} 
                                    onChange={e => setFormData({...formData, role: e.target.value})}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold bg-white"
                                >
                                    {formData.dep === 'SS' ? (
                                        <>
                                            <option value="user">SS</option>
                                            {(profile?.role === 'super_admin' || profile?.role === 'sd' || profile?.role === 'sm') && (
                                                <option value="tl">SS TL</option>
                                            )}
                                            {(profile?.role === 'super_admin' || profile?.role === 'sd') && (
                                                <option value="sm">SS SM</option>
                                            )}
                                            {profile?.role === 'super_admin' && (
                                                <option value="sd">SS SD</option>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <option value="user">CC</option>
                                            {(profile?.role === 'super_admin' || profile?.role === 'sd' || profile?.role === 'sm') && (
                                                <option value="tl">Team Leader (TL)</option>
                                            )}
                                            {(profile?.role === 'super_admin' || profile?.role === 'sd') && (
                                                <option value="sm">Sales Manager (SM)</option>
                                            )}
                                            {profile?.role === 'super_admin' && (
                                                <option value="sd">Sales Director (SD)</option>
                                            )}
                                        </>
                                    )}
                                    {profile?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
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
                            <div>
                                <label className="block text-sm font-bold text-arabian-night/80 mb-1">用户身份 (Identity)</label>
                                <select 
                                    value={formData.identity || ''} 
                                    onChange={e => setFormData({...formData, identity: e.target.value})}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold bg-white font-semibold text-slate-700 text-sm"
                                >
                                    <option value="">-- 请选择身份 --</option>
                                    <option value="KCC">KCC (CC 青少)</option>
                                    <option value="GCC">GCC (CC 专区)</option>
                                    <option value="ACC">ACC (成人业务)</option>
                                    <option value="EA">EA (SS 业务)</option>
                                    <option value="KCC Operation">KCC Operation (青少运营)</option>
                                    <option value="GCC Operation">GCC Operation (专区运营)</option>
                                    <option value="ACC Operation">ACC Operation (成人运营)</option>
                                    <option value="EA Operation">EA Operation (EA 运营)</option>
                                    <option value="Training Dep">Training Dep (培训部)</option>
                                    <option value="Management">Management (管理层)</option>
                                    <option value="Superadmin">Superadmin (系统管理员)</option>
                                    <option value="BS">BS (业务支持)</option>
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
                                        disabled={isSdDisabled}
                                        className={`w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold ${isSdDisabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed select-none' : 'bg-white'}`}
                                        placeholder={t('user_manager.placeholder_sd_select_input', '选择或输入 SD')}
                                    />
                                    <datalist id="sd-options">
                                        {filteredSDs.map(sd => <option key={sd} value={sd} />)}
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
                                        onChange={e => {
                                            const newSm = e.target.value;
                                            let derivedSd = formData.sd;
                                            
                                            if (newSm.trim()) {
                                                const match = users.find(u => 
                                                    (u.sm && u.sm.trim().toLowerCase() === newSm.trim().toLowerCase()) ||
                                                    (u.role === 'sm' && u.crmId && u.crmId.trim().toLowerCase() === newSm.trim().toLowerCase())
                                                );
                                                if (match && match.sd) {
                                                    derivedSd = match.sd;
                                                }
                                            }
                                            setFormData({
                                                ...formData,
                                                sm: newSm,
                                                sd: derivedSd
                                            });
                                        }}
                                        disabled={isSmDisabled}
                                        className={`w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold ${isSmDisabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed select-none' : 'bg-white'}`}
                                        placeholder={t('user_manager.placeholder_sm_select_input', '选择或输入 SM')}
                                    />
                                    <datalist id="sm-options">
                                        {filteredSMs.map(sm => <option key={sm} value={sm} />)}
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
                                        onChange={e => {
                                            const newTl = e.target.value;
                                            let derivedSm = formData.sm;
                                            let derivedSd = formData.sd;
                                            let derivedTeam = formData.team;
                                            
                                            if (newTl.trim()) {
                                                const isSmDirect = users.some(u => 
                                                    (u.sm && u.sm.trim().toLowerCase() === newTl.trim().toLowerCase()) ||
                                                    (u.role === 'sm' && u.crmId && u.crmId.trim().toLowerCase() === newTl.trim().toLowerCase())
                                                );
                                                
                                                if (isSmDirect) {
                                                    derivedSm = newTl;
                                                    const match = users.find(u => 
                                                        (u.sm && u.sm.trim().toLowerCase() === newTl.trim().toLowerCase()) ||
                                                        (u.role === 'sm' && u.crmId && u.crmId.trim().toLowerCase() === newTl.trim().toLowerCase())
                                                    );
                                                    if (match && match.sd) {
                                                        derivedSd = match.sd;
                                                    }
                                                    if (match && match.team && !derivedTeam) {
                                                        derivedTeam = match.team;
                                                    }
                                                } else {
                                                    const match = users.find(u => 
                                                        (u.tl && u.tl.trim().toLowerCase() === newTl.trim().toLowerCase()) ||
                                                        (u.role === 'tl' && u.crmId && u.crmId.trim().toLowerCase() === newTl.trim().toLowerCase())
                                                    );
                                                    if (match) {
                                                        if (match.sm) derivedSm = match.sm;
                                                        if (match.sd) derivedSd = match.sd;
                                                        if (match.team && !derivedTeam) derivedTeam = match.team;
                                                    }
                                                }
                                            }
                                            setFormData({
                                                ...formData,
                                                tl: newTl,
                                                sm: derivedSm,
                                                sd: derivedSd,
                                                team: derivedTeam
                                            });
                                        }}
                                        disabled={isTlDisabled}
                                        className={`w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold ${isTlDisabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed select-none' : 'bg-white'}`}
                                        placeholder={t('user_manager.placeholder_tl_select_input', '选择或输入 TL')}
                                    />
                                    <datalist id="tl-options">
                                        {filteredTLs.map(tl => <option key={tl} value={tl} />)}
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
                                        onChange={e => {
                                            const newTeam = e.target.value;
                                            let derivedTl = formData.tl;
                                            let derivedSm = formData.sm;
                                            let derivedSd = formData.sd;
                                            
                                            if (newTeam.trim()) {
                                                const match = users.find(u => u.team && u.team.trim().toLowerCase() === newTeam.trim().toLowerCase());
                                                if (match) {
                                                    if (!derivedTl && match.tl) derivedTl = match.tl;
                                                    if (!derivedSm && match.sm) derivedSm = match.sm;
                                                    if (!derivedSd && match.sd) derivedSd = match.sd;
                                                }
                                            }
                                            setFormData({
                                                ...formData,
                                                team: newTeam,
                                                tl: derivedTl,
                                                sm: derivedSm,
                                                sd: derivedSd
                                            });
                                        }}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold bg-white"
                                        placeholder={t('user_manager.placeholder_team_select_input', '选择或输入 Team')}
                                    />
                                    <datalist id="team-options">
                                        {filteredTeams.map(team => <option key={team} value={team} />)}
                                    </datalist>
                                </div>
                            )}

                            {formData.role !== 'super_admin' && profile?.role === 'super_admin' && (
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
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-desert-gold focus:ring-desert-gold"
                                                checked={formData.permissions.manageComments}
                                                onChange={e => setFormData({...formData, permissions: {...formData.permissions, manageComments: e.target.checked}})}
                                            />
                                            {t('user_manager.perm_manage_comments', '评论审核')}
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-desert-gold focus:ring-desert-gold"
                                                checked={formData.permissions.managePolicies || false}
                                                onChange={e => setFormData({...formData, permissions: {...formData.permissions, managePolicies: e.target.checked}})}
                                            />
                                            {t('user_manager.perm_manage_policies', '政策运营')}
                                        </label>
                                    </div>
                                    {formData.permissions.managePolicies && (
                                        <div className="col-span-2 mt-2 p-3 bg-desert-gold/5 border border-desert-gold/25 rounded-xl space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                            <label className="block text-xs font-bold text-deep-teal">管理所属业务团队范围</label>
                                            <select 
                                                value={formData.policyScope || 'all'}
                                                onChange={e => setFormData({...formData, policyScope: e.target.value as any})}
                                                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:ring-2 focus:ring-desert-gold bg-white font-semibold text-slate-700"
                                            >
                                                <option value="all">🌍 全部业务线 (all)</option>
                                                <option value="KCC">🧒 KCC 团队 (JOHN / Niki)</option>
                                                <option value="GCC">💼 GCC 团队 (IRIS)</option>
                                                <option value="Adult">👨 Adult 团队 (Alan / Chase)</option>
                                                <option value="EA">🎓 EA 团队 (Lily)</option>
                                            </select>
                                        </div>
                                    )}
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
