import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, getDocs, getDoc, query, orderBy, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../services/firebase';
import { UploadCloud, FileText, User, Pencil, Trash2, X, Download, Search, Users, Send, RefreshCw, ChevronDown, ChevronRight, BookOpen, Pin, Sparkles } from 'lucide-react';

interface Attachment {
    id: string;
    name: string;
    url: string;
    type: 'ppt' | 'pdf' | 'doc' | 'excel' | 'zip' | 'image' | 'other';
    size: string;
    uploadedAt: any;
}

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
    businessType?: 'kid' | 'adult' | 'ss' | 'leader';
    attachments?: Attachment[];
    isPinned?: boolean;
}

interface Category {
    id: string;
    name: string;
    businessType?: 'kid' | 'adult' | 'ss' | 'leader';
}

export default function RecordingsManager() {
    const { t } = useTranslation();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const { hasPermission, profile, isLeader, user, isSuperAdmin } = useAuth();
    const isWriteAllowed = isSuperAdmin || profile?.role === 'sd' || profile?.role === 'sm';
    const [transcribingIds, setTranscribingIds] = useState<Record<string, boolean>>({});
    
    // DingTalk Multi-Target Push States
    const [showPushModal, setShowPushModal] = useState(false);
    const [selectedRecordingForPush, setSelectedRecordingForPush] = useState<Recording | null>(null);
    const [pushTargetType, setPushTargetType] = useState<'group' | 'individuals' | 'app'>('group');
    const [selectedSdsForPush, setSelectedSdsForPush] = useState<string[]>([]);
    const [pushWebhookLang, setPushWebhookLang] = useState<'bilingual' | 'en' | 'zh'>('bilingual');
    const [pushingToDingTalk, setPushingToDingTalk] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    // Direct Transcript View State
    const [viewingTranscriptRecording, setViewingTranscriptRecording] = useState<Recording | null>(null);
    const [adminActiveTab, setAdminActiveTab] = useState<'arabic' | 'chinese'>('arabic');
    const [adminTranscriptZh, setAdminTranscriptZh] = useState<string>('');
    const [loadingAdminTranslation, setLoadingAdminTranslation] = useState(false);
    const isSDLevel = profile?.role === 'sd' || profile?.role === 'super_admin';

    useEffect(() => {
        if (viewingTranscriptRecording) {
            setAdminActiveTab('arabic');
            setAdminTranscriptZh((viewingTranscriptRecording as any).transcriptZh || '');
        } else {
            setAdminActiveTab('arabic');
            setAdminTranscriptZh('');
        }
    }, [viewingTranscriptRecording]);

    useEffect(() => {
        if (viewingTranscriptRecording && (viewingTranscriptRecording as any).transcriptZh && !adminTranscriptZh) {
            setAdminTranscriptZh((viewingTranscriptRecording as any).transcriptZh);
            return;
        }

        if (adminActiveTab === 'chinese' && !adminTranscriptZh && viewingTranscriptRecording && !((viewingTranscriptRecording as any).transcriptZh) && isSDLevel) {
            setLoadingAdminTranslation(true);
            fetch('/.netlify/functions/translate-transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recordingId: viewingTranscriptRecording.id,
                    title: viewingTranscriptRecording.title,
                    description: viewingTranscriptRecording.description,
                    lecturerName: viewingTranscriptRecording.lecturerName,
                    categoryName: viewingTranscriptRecording.categoryName,
                    displayId: viewingTranscriptRecording.displayId,
                    transcript: (viewingTranscriptRecording as any).transcript
                })
            })
            .then(res => {
                if (!res.ok) throw new Error("HTTP error " + res.status);
                return res.json();
            })
            .then(data => {
                if (data.success && data.transcriptZh) {
                    setAdminTranscriptZh(data.transcriptZh);
                    (viewingTranscriptRecording as any).transcriptZh = data.transcriptZh;
                } else {
                    throw new Error(data.error || "Failed to translate");
                }
            })
            .catch(err => {
                console.error("Error loading admin translation:", err);
                setAdminTranscriptZh(t('learning_hub.no_translation_available', '暂无中文对照翻译（翻译生成失败，请检查 API 配置或重试）'));
            })
            .finally(() => setLoadingAdminTranslation(false));
        }
    }, [adminActiveTab, viewingTranscriptRecording, adminTranscriptZh, isSDLevel, t]);

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
    const [businessType, setBusinessType] = useState<'kid' | 'adult' | 'ss' | 'leader'>('kid');
    const [hasSetDefaultBusiness, setHasSetDefaultBusiness] = useState(false);
    const [hubScope, setHubScope] = useState<'public' | 'team'>('public');
    const [targetSmId, setTargetSmId] = useState<string>('');
    const [targetHubs, setTargetHubs] = useState<string[]>(['public']);
    const [adminSmFilter, setAdminSmFilter] = useState<string>('all');
    const [promotingRecording, setPromotingRecording] = useState<Recording | null>(null);
    const [promoteCategoryId, setPromoteCategoryId] = useState<string>('');
    
    // Upload States
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    // Attachment States
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [uploadingAttachments, setUploadingAttachments] = useState<Record<string, number>>({});

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

    // Compute Non-sales departments list dynamically from systemUsers
    const depList = React.useMemo(() => {
        const deps = new Set<string>();
        systemUsers.forEach(u => {
            const hasSd = !!u.sd;
            const isSd = u.role === 'sd';
            const isSuper = u.role === 'super_admin';
            if (!hasSd && !isSd && !isSuper) {
                // If it is a non-sales user, their "team" field represents their functional department/team
                if (u.team && u.team.trim()) {
                    deps.add(u.team.trim().toUpperCase());
                } else if (u.dep && u.dep.trim()) {
                    deps.add(u.dep.trim().toUpperCase());
                }
            }
        });
        return Array.from(deps).sort();
    }, [systemUsers]);

    const getTlTeamName = React.useCallback((tlCrmId: string) => {
        const match = systemUsers.find(u => {
            const uTl = (u.tl || '').toUpperCase();
            const uCrmId = (u.crmId || '').toUpperCase();
            const search = tlCrmId.toUpperCase();
            return (uTl === search || (u.role === 'tl' && uCrmId === search)) && u.team && u.team.trim();
        });
        return match ? match.team.trim() : tlCrmId;
    }, [systemUsers]);

    // Unified list of targets (SD Teams, SM Teams, TL Teams and Non-sales Departments)
    const pushGroupList = React.useMemo(() => {
        const groups: { id: string; name: string; type: 'sd' | 'sm' | 'tl' | 'dep'; rawId: string }[] = [];
        const isSuper = profile?.role === 'super_admin';
        const userRole = String(profile?.role || 'user').trim().toLowerCase();
        const userCrmId = (profile?.crmId || '').toUpperCase();
        
        if (isSuper) {
            // Super Admin sees SD Teams
            sdList.forEach(sd => {
                groups.push({
                    id: `sd:${sd}`,
                    name: `${sd} ${t('recordings_manager.team_suffix', '团队')}`,
                    type: 'sd',
                    rawId: sd
                });
            });
            
            // Super Admin also sees Non-Sales Departments (for back-office)
            depList.forEach(dep => {
                groups.push({
                    id: `dep:${dep}`,
                    name: `${dep} ${t('recordings_manager.dep_suffix', '部门')}`,
                    type: 'dep',
                    rawId: dep
                });
            });

            // Super Admin sees custom roles
            groups.push({ id: 'role:cctl', name: 'CCTL', type: 'dep', rawId: 'cctl' });
            groups.push({ id: 'role:ccsm', name: 'CCSM', type: 'dep', rawId: 'ccsm' });
            groups.push({ id: 'role:ccsd', name: 'CCSD', type: 'dep', rawId: 'ccsd' });
            groups.push({ id: 'role:sstl', name: 'SSTL', type: 'dep', rawId: 'sstl' });
            groups.push({ id: 'role:sssm', name: 'SSSM', type: 'dep', rawId: 'sssm' });
            groups.push({ id: 'role:sssd', name: 'SSSD', type: 'dep', rawId: 'sssd' });
        } 
        else if (userRole === 'sd') {
            // SD logs in: show SM Teams under this SD
            const sms = new Set<string>();
            systemUsers.forEach(u => {
                const uSd = (u.sd || '').toUpperCase();
                // If user is under this SD and has an SM
                if (uSd === userCrmId && u.sm) {
                    sms.add(u.sm.toUpperCase());
                }
                // If user is an SM under this SD
                if (u.role === 'sm' && uSd === userCrmId && u.crmId) {
                    sms.add(u.crmId.toUpperCase());
                }
            });
            
            Array.from(sms).sort().forEach(sm => {
                groups.push({
                    id: `sm:${sm}`,
                    name: `${sm} ${t('recordings_manager.team_suffix', '团队')}`,
                    type: 'sm',
                    rawId: sm
                });
            });
            
            // Add a fallback for SD's direct management team if any exists
            const hasSdDirect = systemUsers.some(u => (u.sd || '').toUpperCase() === userCrmId && !u.sm);
            if (hasSdDirect) {
                groups.push({
                    id: `sd:${profile.crmId}`,
                    name: `${profile.crmId} (${t('recordings_manager.direct_team', '直带团队')})`,
                    type: 'sd',
                    rawId: profile.crmId
                });
            }
        } 
        else if (userRole === 'sm') {
            // SM logs in: show TL Teams under this SM
            const tls = new Set<string>();
            systemUsers.forEach(u => {
                const uSm = (u.sm || '').toUpperCase();
                if (uSm === userCrmId && u.tl) {
                    tls.add(u.tl.toUpperCase());
                }
                if (u.role === 'tl' && uSm === userCrmId && u.crmId) {
                    tls.add(u.crmId.toUpperCase());
                }
            });
            
            Array.from(tls).sort().forEach(tl => {
                const teamName = getTlTeamName(tl);
                groups.push({
                    id: `tl:${tl}`,
                    name: `${teamName} ${t('recordings_manager.team_suffix', '团队')}`,
                    type: 'tl',
                    rawId: tl
                });
            });
            
            // Add fallback for SM's direct management team if any exists
            const hasSmDirect = systemUsers.some(u => (u.sm || '').toUpperCase() === userCrmId && !u.tl);
            if (hasSmDirect) {
                groups.push({
                    id: `sm:${profile.crmId}`,
                    name: `${profile.crmId} (${t('recordings_manager.direct_team', '直带团队')})`,
                    type: 'sm',
                    rawId: profile.crmId
                });
            }
        } 
        else if (userRole === 'tl') {
            // TL logs in: show only their own TL Team
            const teamName = getTlTeamName(profile.crmId);
            groups.push({
                id: `tl:${profile.crmId}`,
                name: `${teamName} ${t('recordings_manager.team_suffix', '团队')}`,
                type: 'tl',
                rawId: profile.crmId
            });
        }
        
        return groups;
    }, [sdList, depList, systemUsers, profile, t, getTlTeamName]);

    const filteredRecordings = recordings.filter(rec => {
        const isSuper = profile?.role === 'super_admin';
        const isSd = profile?.role === 'sd';
        const isSm = profile?.role === 'sm';

        if (isSm) {
            if ((rec as any).hubScope !== 'team' || (rec as any).targetSmId !== profile.crmId) {
                return false;
            }
        } else if (isSd) {
            const smId = (rec as any).targetSmId;
            const isDownlineSm = systemUsers.some(u => u.crmId === smId && u.sd === profile.crmId);
            if ((rec as any).hubScope !== 'team' || !isDownlineSm) {
                return false;
            }
            if (adminSmFilter !== 'all' && smId !== adminSmFilter) {
                return false;
            }
        } else if (isSuper) {
            if (adminSmFilter === 'public') {
                if ((rec as any).hubScope === 'team') return false;
            } else if (adminSmFilter !== 'all') {
                if ((rec as any).hubScope !== 'team' || (rec as any).targetSmId !== adminSmFilter) {
                    return false;
                }
            }
        }

        if (!isSuper) {
            if (profile?.dep === 'SS') {
                if (isLeader) {
                    if (rec.businessType !== 'ss' && rec.businessType !== 'leader') return false;
                } else {
                    if (rec.businessType !== 'ss') return false;
                }
            } else {
                if (isLeader) {
                    if (rec.businessType === 'ss') return false;
                } else {
                    if (rec.businessType === 'ss' || rec.businessType === 'leader') return false;
                }
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
                    businessType: docData.businessType || 'kid',
                    hubScope: docData.hubScope || 'public',
                    targetSmId: docData.targetSmId || ''
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

    // Polling effect: auto-refresh list if any recording is in 'transcribing' state
    useEffect(() => {
        const hasTranscribing = recordings.some(rec => (rec as any).transcriptStatus === 'transcribing');
        if (!hasTranscribing) return;

        console.log("Detected transcribing recording(s). Activating 10-second polling interval...");
        const interval = setInterval(() => {
            fetchData();
        }, 10000);

        return () => clearInterval(interval);
    }, [recordings]);

    useEffect(() => {
        if (profile && !hasSetDefaultBusiness) {
            setBusinessType(profile.dep === 'SS' ? 'ss' : 'kid');
            if (profile.role === 'sm') {
                setHubScope('team');
                setTargetSmId(profile.crmId || '');
            }
            setHasSetDefaultBusiness(true);
        }
    }, [profile, hasSetDefaultBusiness]);

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

    const handlePromoteToPublic = async (rec: Recording, targetCatId: string) => {
        try {
            setUploading(true);
            setPageError(null);

            const docRef = doc(db, 'recordings', rec.id);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                throw new Error("Recording not found");
            }
            const originalData = docSnap.data();

            let maxId = 0;
            recordings.forEach(r => {
                if (r.displayId && r.displayId.startsWith('RD')) {
                    const numPart = parseInt(r.displayId.substring(2), 10);
                    if (!isNaN(numPart) && numPart > maxId) {
                        maxId = numPart;
                    }
                }
            });
            const nextDisplayId = `RD${(maxId + 1).toString().padStart(4, '0')}`;

            const targetCat = categories.find(c => c.id === targetCatId);
            const targetCatName = targetCat?.name || t('common.uncategorized');

            const promotedData = {
                ...originalData,
                displayId: nextDisplayId,
                hubScope: 'public',
                targetSmId: '',
                targetSmName: '',
                categoryId: targetCatId,
                categoryName: targetCatName,
                isPromoted: true,
                promotedFromTeam: originalData.targetSmName || originalData.targetSmId || '',
                promotedBy: profile?.crmId || user?.email || '',
                promotedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                playCount: 0,
                likes: []
            };

            await addDoc(collection(db, 'recordings'), promotedData);
            alert(t('recordings_manager.promote_success', '成功同步晋升至公共库！'));
            await fetchData();
        } catch (error: any) {
            console.error("Promotion failed:", error);
            setPageError(`${t('common.process_fail')} ${error.message}`);
        } finally {
            setUploading(false);
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
        setHubScope(profile?.role === 'sm' ? 'team' : 'public');
        setTargetSmId(profile?.role === 'sm' ? (profile?.crmId || '') : '');
        setTargetHubs(['public']);
        setAttachments([]);
        setUploadingAttachments({});
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

    const getFileType = (fileName: string): Attachment['type'] => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (!ext) return 'other';
        if (['ppt', 'pptx'].includes(ext)) return 'ppt';
        if (['pdf'].includes(ext)) return 'pdf';
        if (['doc', 'docx'].includes(ext)) return 'doc';
        if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
        if (['zip', 'rar', '7z'].includes(ext)) return 'zip';
        if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
        return 'other';
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setPageError(null);
        const fileList = Array.from(files);

        for (const file of fileList) {
            if (file.size > 50 * 1024 * 1024) {
                setPageError(`${t('common.unsupported_file_type', '不支持的文件类型（仅支持 PPT, PDF, DOC, XLS, ZIP, 图片）')}: ${file.name} - 最大支持 50MB`);
                continue;
            }

            const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            try {
                const storageRef = ref(storage, `attachments/${Date.now()}_${file.name}`);
                const uploadTask = uploadBytesResumable(storageRef, file);

                setUploadingAttachments(prev => ({ ...prev, [tempId]: 0 }));

                await new Promise<void>((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadingAttachments(prev => ({ ...prev, [tempId]: Math.round(prog) }));
                        },
                        (error) => reject(error),
                        async () => {
                            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                            
                            const newAttachment: Attachment = {
                                id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                name: file.name,
                                url: downloadUrl,
                                type: getFileType(file.name),
                                size: formatFileSize(file.size),
                                uploadedAt: new Date().toISOString()
                            };

                            setAttachments(prev => [...prev, newAttachment]);
                            resolve();
                        }
                    );
                });
            } catch (error: any) {
                console.error("Attachment upload failed:", error);
                setPageError(`${t('common.process_fail', '处理失败:')} ${error.message}`);
            } finally {
                setUploadingAttachments(prev => {
                    const copy = { ...prev };
                    delete copy[tempId];
                    return copy;
                });
            }
        }
    };

    const handleRemoveAttachment = async (attId: string, attUrl: string) => {
        if (!window.confirm(t('common.confirm_delete_attachment', '确定要移除此附件文件吗？'))) return;
        
        try {
            if (attUrl.includes('firebasestorage')) {
                const fileRef = ref(storage, attUrl);
                await deleteObject(fileRef);
            }
        } catch (e) {
            console.error("Failed to delete attachment file from Storage", e);
        }

        setAttachments(prev => prev.filter(att => att.id !== attId));
    };

    const handleTranscribe = async (rec: Recording) => {
        if (!rec.id) return;
        setTranscribingIds(prev => ({ ...prev, [rec.id]: true }));
        
        const recordingRef = doc(db, 'recordings', rec.id);
        try {
            await updateDoc(recordingRef, { transcriptStatus: 'transcribing' });
            setRecordings(prev => prev.map(r => r.id === rec.id ? { ...r, transcriptStatus: 'transcribing' } as any : r));
        } catch (dbErr) {
            console.error("Failed to update status in Firestore:", dbErr);
        }

        try {
            const res = await fetch('/.netlify/functions/transcribe-background', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordingId: rec.id })
            });

            if (res.status === 202) {
                alert(t('recordings_manager.transcribe_started', '后台语音解析已启动！系统正在后台安全处理中，您无需在此等待，可直接进行其他操作，1-2分钟后将自动就绪。'));
                await fetchData();
            } else {
                throw new Error(t('recordings_manager.transcribe_fail', '语音解析启动失败，请稍后重试。'));
            }
        } catch (error: any) {
            console.error("Transcription failed:", error);
            alert(`${t('recordings_manager.transcribe_fail', '语音解析失败')} : ${error.message}`);
            try {
                await updateDoc(recordingRef, { transcriptStatus: 'error' });
                await fetchData();
            } catch (dbErr) {
                console.error("Failed to revert status in Firestore:", dbErr);
            }
        } finally {
            setTranscribingIds(prev => ({ ...prev, [rec.id]: false }));
        }
    };

    const handlePushToDingTalkClick = (rec: Recording) => {
        setSelectedRecordingForPush(rec);
        const targetType = isSuperAdmin ? 'group' : 'individuals';
        setPushTargetType(targetType);
        
        if (targetType === 'individuals' && pushGroupList.length === 1) {
            setSelectedSdsForPush([pushGroupList[0].id]);
        } else {
            setSelectedSdsForPush([]);
        }
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
                const successMsg = pushTargetType === 'app'
                    ? t('recordings_manager.push_success_app', '精品素材已成功推送至 App 锁屏！')
                    : t('recordings_manager.push_success', '精品素材已成功推送至钉钉！');
                alert(successMsg);
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
        setAttachments(rec.attachments || []);
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
        setHubScope((rec as any).hubScope || 'public');
        setTargetSmId((rec as any).targetSmId || '');
        const currentTargetHubs = (rec as any).targetHubs || [];
        setTargetHubs(currentTargetHubs.length > 0 ? currentTargetHubs : ['public']);
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

    const handleTogglePin = async (rec: Recording) => {
        try {
            setUploading(true);
            setPageError(null);
            const recordingRef = doc(db, 'recordings', rec.id);
            const newPinned = !rec.isPinned;
            await updateDoc(recordingRef, { isPinned: newPinned });
            await fetchData();
        } catch (error: any) {
            console.error("Toggle pin failed:", error);
            setPageError(`Toggle pin failed: ${error.message}`);
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
        
        if (uploading) return;
        
        // Prevent submission if attachments are still uploading
        if (Object.keys(uploadingAttachments).length > 0) {
            alert(t('recordings_manager.waiting_attachments', '正在等待附件讲义上传完成，请稍后提交...'));
            return;
        }
        
        // Require file only if creating new and no attachments exist
        if (!editingId && !file && attachments.length === 0) return;
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
            const resolvedBusinessType = category?.businessType || businessType;
            const dataToSave: any = {
                title,
                description,
                lecturerName,
                audioUrl,
                avatarUrl,
                categoryId: category?.id || '',
                categoryName: category?.name || t('common.uncategorized'),
                businessType: resolvedBusinessType,
                uploaderId: user?.uid || '',
                uploaderCrmId: profile?.crmId || '',
                attachments: attachments || [],
                hubScope,
                targetSmId,
                targetSmName: hubScope === 'team' && targetSmId ? (systemUsers.find(u => u.crmId === targetSmId)?.name || targetSmId) : '',
                targetHubs: targetHubs.length > 0 ? targetHubs : ['public']
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
                    isPinned: false,
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

    const getGroupCcs = React.useCallback((group: { id: string; type: string; rawId: string }) => {
        const raw = group.rawId.toUpperCase();
        return systemUsers.filter(u => {
            if (u.role === 'super_admin') return false;
            const uCrmId = (u.crmId || '').toUpperCase();
            
            if (group.type === 'sd') {
                return (u.sd || '').toUpperCase() === raw || (u.role === 'sd' && uCrmId === raw);
            }
            if (group.type === 'sm') {
                return (u.sm || '').toUpperCase() === raw || (u.role === 'sm' && uCrmId === raw);
            }
            if (group.type === 'tl') {
                const teamName = getTlTeamName(group.rawId);
                const isSameTeam = teamName && teamName !== group.rawId && u.team && u.team.trim().toUpperCase() === teamName.trim().toUpperCase();
                const isDirectCc = (u.tl || '').toUpperCase() === raw;
                const isSelf = uCrmId === raw;
                return isSameTeam || isDirectCc || isSelf;
            }
            if (group.type === 'dep') {
                if (group.id.startsWith('role:')) {
                    const userDepUpper = String(u.dep || '').trim().toUpperCase();
                    const userRoleLower = String(u.role || '').trim().toLowerCase();
                    if (group.rawId === 'cctl' && userDepUpper === 'CC' && userRoleLower === 'tl') return true;
                    if (group.rawId === 'ccsm' && userDepUpper === 'CC' && userRoleLower === 'sm') return true;
                    if (group.rawId === 'ccsd' && userDepUpper === 'CC' && userRoleLower === 'sd') return true;
                    if (group.rawId === 'sstl' && userDepUpper === 'SS' && userRoleLower === 'tl') return true;
                    if (group.rawId === 'sssm' && userDepUpper === 'SS' && userRoleLower === 'sm') return true;
                    if (group.rawId === 'sssd' && userDepUpper === 'SS' && userRoleLower === 'sd') return true;
                    return false;
                }
                const hasSd = !!u.sd;
                const isSd = u.role === 'sd';
                const userDep = String(u.dep || '').trim().toUpperCase();
                const userTeam = String(u.team || '').trim().toUpperCase();
                return !hasSd && !isSd && (userDep === raw || userTeam === raw);
            }
            return false;
        }).sort((a, b) => (a.name || a.crmId || '').localeCompare(b.name || b.crmId || ''));
    }, [systemUsers, getTlTeamName]);

    const handleCcToggle = React.useCallback((ccCrmId: string, group: { id: string; type: string; rawId: string }) => {
        const ccId = `cc:${ccCrmId.toLowerCase()}`;
        const groupCcs = getGroupCcs(group);
        const isGroupSelected = selectedSdsForPush.includes(group.id);
        
        if (isGroupSelected) {
            // Remove group and add all other CCs in this group
            const otherCcIds = groupCcs
                .filter(u => u.crmId.toLowerCase() !== ccCrmId.toLowerCase())
                .map(u => `cc:${u.crmId.toLowerCase()}`);
            setSelectedSdsForPush(prev => [
                ...prev.filter(x => x !== group.id),
                ...otherCcIds
            ]);
        } else {
            const isCcSel = selectedSdsForPush.includes(ccId);
            if (isCcSel) {
                setSelectedSdsForPush(prev => prev.filter(x => x !== ccId));
            } else {
                const nextCcIds = [...selectedSdsForPush.filter(x => x.startsWith('cc:')), ccId];
                const allCcsSelected = groupCcs.every(u => nextCcIds.includes(`cc:${u.crmId.toLowerCase()}`));
                if (allCcsSelected && groupCcs.length > 0) {
                    const groupCcIds = groupCcs.map(u => `cc:${u.crmId.toLowerCase()}`);
                    setSelectedSdsForPush(prev => [
                        ...prev.filter(x => !groupCcIds.includes(x)),
                        group.id
                    ]);
                } else {
                    setSelectedSdsForPush(prev => [...prev, ccId]);
                }
            }
        }
    }, [selectedSdsForPush, getGroupCcs]);

    const isUserSelected = React.useCallback((crmId: string, group: { id: string }) => {
        const ccId = `cc:${crmId.toLowerCase()}`;
        return selectedSdsForPush.includes(group.id) || selectedSdsForPush.includes(ccId);
    }, [selectedSdsForPush]);

    const isTlSelected = React.useCallback((tlCrmId: string, tlUsers: any[], group: { id: string }) => {
        if (selectedSdsForPush.includes(group.id)) return true;
        if (tlUsers.length === 0) return false;
        return tlUsers.every(u => isUserSelected(u.crmId, group));
    }, [selectedSdsForPush, isUserSelected]);

    const isSmSelected = React.useCallback((smCrmId: string, smUsers: any[], group: { id: string }) => {
        if (selectedSdsForPush.includes(group.id)) return true;
        if (smUsers.length === 0) return false;
        return smUsers.every(u => isUserSelected(u.crmId, group));
    }, [selectedSdsForPush, isUserSelected]);

    const handleTlToggle = React.useCallback((tlCrmId: string, tlUsers: any[], group: { id: string; type: string; rawId: string }) => {
        const groupCcs = getGroupCcs(group);
        const isSelected = isTlSelected(tlCrmId, tlUsers, group);
        const tlCcIds = tlUsers.map(u => `cc:${u.crmId.toLowerCase()}`);
        
        if (isSelected) {
            if (selectedSdsForPush.includes(group.id)) {
                const otherCcIds = groupCcs
                    .filter(u => !tlCcIds.includes(`cc:${u.crmId.toLowerCase()}`))
                    .map(u => `cc:${u.crmId.toLowerCase()}`);
                setSelectedSdsForPush(prev => [
                    ...prev.filter(x => x !== group.id),
                    ...otherCcIds
                ]);
            } else {
                setSelectedSdsForPush(prev => prev.filter(x => !tlCcIds.includes(x)));
            }
        } else {
            const nextCcIds = [
                ...selectedSdsForPush.filter(x => x.startsWith('cc:') && !tlCcIds.includes(x)),
                ...tlCcIds
            ];
            const allCcsSelected = groupCcs.every(u => nextCcIds.includes(`cc:${u.crmId.toLowerCase()}`));
            if (allCcsSelected && groupCcs.length > 0) {
                setSelectedSdsForPush(prev => [
                    ...prev.filter(x => !nextCcIds.includes(x) && x !== group.id),
                    group.id
                ]);
            } else {
                setSelectedSdsForPush(prev => [
                    ...prev.filter(x => !tlCcIds.includes(x)),
                    ...tlCcIds
                ]);
            }
        }
    }, [selectedSdsForPush, getGroupCcs, isTlSelected]);

    const handleSmToggle = React.useCallback((smCrmId: string, smUsers: any[], group: { id: string; type: string; rawId: string }) => {
        const groupCcs = getGroupCcs(group);
        const isSelected = isSmSelected(smCrmId, smUsers, group);
        const smCcIds = smUsers.map(u => `cc:${u.crmId.toLowerCase()}`);
        
        if (isSelected) {
            if (selectedSdsForPush.includes(group.id)) {
                const otherCcIds = groupCcs
                    .filter(u => !smCcIds.includes(`cc:${u.crmId.toLowerCase()}`))
                    .map(u => `cc:${u.crmId.toLowerCase()}`);
                setSelectedSdsForPush(prev => [
                    ...prev.filter(x => x !== group.id),
                    ...otherCcIds
                ]);
            } else {
                setSelectedSdsForPush(prev => prev.filter(x => !smCcIds.includes(x)));
            }
        } else {
            const nextCcIds = [
                ...selectedSdsForPush.filter(x => x.startsWith('cc:') && !smCcIds.includes(x)),
                ...smCcIds
            ];
            const allCcsSelected = groupCcs.every(u => nextCcIds.includes(`cc:${u.crmId.toLowerCase()}`));
            if (allCcsSelected && groupCcs.length > 0) {
                setSelectedSdsForPush(prev => [
                    ...prev.filter(x => !nextCcIds.includes(x) && x !== group.id),
                    group.id
                ]);
            } else {
                setSelectedSdsForPush(prev => [
                    ...prev.filter(x => !smCcIds.includes(x)),
                    ...smCcIds
                ]);
            }
        }
    }, [selectedSdsForPush, getGroupCcs, isSmSelected]);

    const buildGroupHierarchy = React.useCallback((users: any[]) => {
        const getUserName = (crmId: string) => {
            const u = systemUsers.find(x => (x.crmId || '').toUpperCase() === crmId.toUpperCase());
            return u ? (u.name || crmId) : crmId;
        };

        const smMap: Record<string, any[]> = {};
        const directToSd: any[] = [];
        
        users.forEach(u => {
            if (u.role === 'sd') return;
            if (u.sm) {
                const smKey = u.sm.toUpperCase();
                if (!smMap[smKey]) smMap[smKey] = [];
                smMap[smKey].push(u);
            } else {
                directToSd.push(u);
            }
        });
        
        const smGroups = Object.keys(smMap).sort().map(smKey => {
            const smUsers = smMap[smKey];
            const smUserObj = users.find(u => u.role === 'sm' && (u.crmId || '').toUpperCase() === smKey);
            const smName = smUserObj ? (smUserObj.name || smKey) : getUserName(smKey);
            
            const tlMap: Record<string, any[]> = {};
            const directToSm: any[] = [];
            
            smUsers.forEach(u => {
                if (u.role === 'sm') return;
                if (u.tl) {
                    const tlKey = u.tl.toUpperCase();
                    if (!tlMap[tlKey]) tlMap[tlKey] = [];
                    tlMap[tlKey].push(u);
                } else {
                    directToSm.push(u);
                }
            });
            
            const tlGroups = Object.keys(tlMap).sort().map(tlKey => {
                const tlUsers = tlMap[tlKey];
                const tlUserObj = users.find(u => u.role === 'tl' && (u.crmId || '').toUpperCase() === tlKey) || 
                                  systemUsers.find(u => u.role === 'tl' && (u.crmId || '').toUpperCase() === tlKey);
                const tlName = tlUserObj ? (tlUserObj.name || tlKey) : tlKey;
                const tlTeamName = tlUserObj?.team ? `${tlUserObj.team.trim()}` : tlName;
                
                return {
                    tlKey,
                    tlName: tlTeamName,
                    users: tlUsers,
                    tlUserObj
                };
            });
            
            return {
                smKey,
                smName,
                tlGroups,
                directToSm,
                smUserObj
            };
        });
        
        const sdTlMap: Record<string, any[]> = {};
        const directRepsToSd: any[] = [];
        
        directToSd.forEach(u => {
            if (u.tl) {
                const tlKey = u.tl.toUpperCase();
                if (!sdTlMap[tlKey]) sdTlMap[tlKey] = [];
                sdTlMap[tlKey].push(u);
            } else {
                directRepsToSd.push(u);
            }
        });
        
        const sdTlGroups = Object.keys(sdTlMap).sort().map(tlKey => {
            const tlUsers = sdTlMap[tlKey];
            const tlUserObj = users.find(u => u.role === 'tl' && (u.crmId || '').toUpperCase() === tlKey) ||
                              systemUsers.find(u => u.role === 'tl' && (u.crmId || '').toUpperCase() === tlKey);
            const tlName = tlUserObj ? (tlUserObj.name || tlKey) : tlKey;
            const tlTeamName = tlUserObj?.team ? `${tlUserObj.team.trim()}` : tlName;
            
            return {
                tlKey,
                tlName: tlTeamName,
                users: tlUsers,
                tlUserObj
            };
        });
        
        return {
            smGroups,
            sdTlGroups,
            directRepsToSd
        };
    }, [systemUsers]);

    const handleGroupToggle = React.useCallback((group: { id: string; type: string; rawId: string }) => {
        const isGroupSelected = selectedSdsForPush.includes(group.id);
        const groupCcs = getGroupCcs(group);
        const groupCcIds = groupCcs.map(u => `cc:${u.crmId.toLowerCase()}`);
        
        if (isGroupSelected) {
            setSelectedSdsForPush(prev => prev.filter(x => x !== group.id && !groupCcIds.includes(x)));
        } else {
            setSelectedSdsForPush(prev => [
                ...prev.filter(x => !groupCcIds.includes(x)),
                group.id
            ]);
        }
    }, [selectedSdsForPush, getGroupCcs]);

    const toggleGroupExpand = React.useCallback((groupId: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    }, []);

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

            <div className={isWriteAllowed ? "grid grid-cols-1 lg:grid-cols-3 gap-8" : "w-full"}>
                {/* Left Column: Category & Upload Form */}
                {isWriteAllowed && (
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
                                >
                                    <option value="">{t('common.uncategorized', '未分类')}</option>
                                    {categories.filter(cat => {
                                        if ((cat.businessType || 'kid') !== businessType) return false;
                                        const isSm = profile?.role === 'sm';
                                        const activeSm = isSm ? profile?.crmId : targetSmId;

                                        if (hubScope === 'team') {
                                            const catScope = cat.hubScope || 'public';
                                            return catScope === 'public' || (catScope === 'team' && cat.targetSmId === activeSm);
                                        } else {
                                            // Public scope recordings can only use public hub categories
                                            if ((cat.hubScope || 'public') !== 'public') return false;
                                            
                                            // Check zone scope: new_cc categories are only select-able if recording targetHubs includes 'new_cc'
                                            const catZoneScope = cat.scope || 'public';
                                            if (catZoneScope === 'new_cc') {
                                                return targetHubs.includes('new_cc');
                                            }
                                            return true;
                                        }
                                    }).map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Publish Scope Selection */}
                            <div>
                                <label className="block text-sm font-semibold text-deep-teal mb-1">
                                    {t('recordings_manager.scope_label', '发布范围')}
                                </label>
                                <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-semibold border border-gray-200">
                                    <button
                                        type="button"
                                        disabled={profile?.role === 'sm'}
                                        onClick={() => {
                                            setHubScope('public');
                                            setTargetSmId('');
                                            // Safeguard: Reset category if it is team-scoped
                                            const currentCat = categories.find(c => c.id === selectedCategoryId);
                                            if (currentCat && currentCat.hubScope === 'team') {
                                                setSelectedCategoryId('');
                                            }
                                        }}
                                        className={`flex-1 py-1.5 rounded-md transition-all duration-200 ${
                                            hubScope === 'public'
                                                ? 'bg-white text-deep-teal shadow-sm border-gray-200/50 font-bold'
                                                : 'text-gray-400 hover:text-gray-600 disabled:opacity-50'
                                        }`}
                                    >
                                        {t('recordings_manager.scope_public', '公共公共库')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setHubScope('team');
                                            if (profile?.role === 'sm') {
                                                setTargetSmId(profile.crmId || '');
                                            } else {
                                                const sms = systemUsers.filter(u => u.role === 'sm' && (profile?.role === 'super_admin' || u.sd === profile?.crmId));
                                                if (sms.length > 0 && !targetSmId) {
                                                    setTargetSmId(sms[0].crmId);
                                                }
                                            }
                                        }}
                                        className={`flex-1 py-1.5 rounded-md transition-all duration-200 ${
                                            hubScope === 'team'
                                                ? 'bg-white text-deep-teal shadow-sm border-gray-200/50 font-bold'
                                                : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                    >
                                        {t('recordings_manager.scope_team', '团队专属库')}
                                    </button>
                                </div>
                            </div>

                            {/* Target SM Selector */}
                            {hubScope === 'team' && (
                                <div>
                                    <label className="block text-sm font-semibold text-deep-teal mb-1">
                                        {t('learning_hub.select_sm_team', '选择SM团队')}
                                    </label>
                                    {profile?.role === 'sm' ? (
                                        <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm font-bold">
                                            {profile.crmId} ({t('recordings_manager.direct_team', '直带团队')})
                                        </div>
                                    ) : (
                                        <select
                                            value={targetSmId}
                                            onChange={(e) => setTargetSmId(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white/50 text-sm font-semibold"
                                            required
                                        >
                                            <option value="">{t('recordings_manager.select_placeholder', '请选择团队...')}</option>
                                            {systemUsers
                                                .filter(u => u.role === 'sm' && (profile?.role === 'super_admin' || u.sd === profile?.crmId))
                                                .map(u => (
                                                    <option key={u.crmId} value={u.crmId}>
                                                        {u.name || u.crmId} ({u.crmId})
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    )}
                                </div>
                            )}

                            {/* Distribution Channels Selector */}
                            <div>
                                <label className="block text-sm font-semibold text-deep-teal mb-1">
                                    {t('recordings_manager.distribution_channels', '分发渠道')}
                                </label>
                                <div className="flex gap-6 mt-2 bg-white/40 p-3 rounded-xl border border-gray-200/50">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={targetHubs.includes('public')}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setTargetHubs(prev => {
                                                    if (checked) {
                                                        return prev.includes('public') ? prev : [...prev, 'public'];
                                                    } else {
                                                        if (prev.length === 1 && prev.includes('public')) return prev;
                                                        return prev.filter(h => h !== 'public');
                                                    }
                                                });
                                            }}
                                            className="w-4 h-4 text-desert-gold focus:ring-desert-gold rounded"
                                        />
                                        <span className="text-sm font-bold text-arabian-night">
                                            {t('recordings_manager.scope_public', '公共公共库')}
                                        </span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={targetHubs.includes('new_cc')}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setTargetHubs(prev => {
                                                    if (checked) {
                                                        return prev.includes('new_cc') ? prev : [...prev, 'new_cc'];
                                                    } else {
                                                        if (prev.length === 1 && prev.includes('new_cc')) return prev;
                                                        return prev.filter(h => h !== 'new_cc');
                                                    }
                                                });
                                            }}
                                            className="w-4 h-4 text-desert-gold focus:ring-desert-gold rounded"
                                        />
                                        <span className="text-sm font-bold text-arabian-night">
                                            {t('recordings_manager.scope_new_cc', '新CC专区')}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-deep-teal mb-1">{t('common.business_type', '业务线')}</label>
                                {profile?.role === 'super_admin' ? (
                                    <div className="flex items-center gap-6 mt-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="businessType"
                                                value="kid"
                                                checked={businessType === 'kid'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
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
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
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
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                className="w-4 h-4 text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span className="text-sm font-semibold text-arabian-night">{t('common.type_ss', 'SS 业务')}</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="businessType"
                                                value="leader"
                                                checked={businessType === 'leader'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                className="w-4 h-4 text-desert-gold focus:ring-desert-gold"
                                            />
                                            <span className="text-sm font-semibold text-arabian-night">{t('common.type_leader', 'Leader 学院')}</span>
                                        </label>
                                    </div>
                                ) : isLeader ? (
                                    profile?.dep === 'SS' ? (
                                        <div className="flex items-center gap-6 mt-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="businessType"
                                                    value="ss"
                                                    checked={businessType === 'ss'}
                                                    onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                    className="w-4 h-4 text-desert-gold focus:ring-desert-gold"
                                                />
                                                <span className="text-sm font-semibold text-arabian-night">{t('common.type_ss', 'SS 业务')}</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="businessType"
                                                    value="leader"
                                                    checked={businessType === 'leader'}
                                                    onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                    className="w-4 h-4 text-desert-gold focus:ring-desert-gold"
                                                />
                                                <span className="text-sm font-semibold text-arabian-night">{t('common.type_leader', 'Leader 学院')}</span>
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
                                                    onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
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
                                                    onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                    className="w-4 h-4 text-desert-gold focus:ring-desert-gold"
                                                />
                                                <span className="text-sm font-semibold text-arabian-night">{t('common.type_adult', '成人业务')}</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="businessType"
                                                    value="leader"
                                                    checked={businessType === 'leader'}
                                                    onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
                                                    className="w-4 h-4 text-desert-gold focus:ring-desert-gold"
                                                />
                                                <span className="text-sm font-semibold text-arabian-night">{t('common.type_leader', 'Leader 学院')}</span>
                                            </label>
                                        </div>
                                    )
                                ) : profile?.dep === 'SS' ? (
                                    <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm border border-orange-400 select-none mt-1 animate-pulse">
                                        ✨ {t('common.type_ss', 'SS 业务')}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-6 mt-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="businessType"
                                                value="kid"
                                                checked={businessType === 'kid'}
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
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
                                                onChange={(e) => setBusinessType(e.target.value as 'kid' | 'adult' | 'ss' | 'leader')}
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
                                                        const isSm = profile?.role === 'sm';
                                                        if (isSm || hubScope === 'team') {
                                                            const activeSm = isSm ? profile?.crmId : targetSmId;
                                                            if (activeSm && u.sm !== activeSm && u.crmId !== activeSm) {
                                                                return false;
                                                            }
                                                        }
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
                                                    const isSm = profile?.role === 'sm';
                                                    if (isSm || hubScope === 'team') {
                                                        const activeSm = isSm ? profile?.crmId : targetSmId;
                                                        if (activeSm && u.sm !== activeSm && u.crmId !== activeSm) {
                                                            return false;
                                                        }
                                                    }
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
                                            accept="audio/*,video/*"
                                            required={!editingId && attachments.length === 0}
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    const selectedFile = e.target.files[0];
                                                    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
                                                    const allowedExtensions = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv'];
                                                    if (ext && !allowedExtensions.includes(ext)) {
                                                        alert(t('recordings_manager.main_media_validation_error', "主学习资料只支持音频或视频格式。如果您想上传课件、PPT、PDF等配套文档，请将其上传至下方的 '配套讲义与附件' 区域！"));
                                                        e.target.value = '';
                                                        setFile(null);
                                                        return;
                                                    }
                                                    setFile(selectedFile);
                                                }
                                            }}
                                            className="hidden"
                                        />
                                    </label>
                                    <span className="text-sm text-gray-500 truncate max-w-[200px]">
                                        {file ? file.name : t('common.no_file_chosen', '未选择任何文件')}
                                    </span>
                                </div>
                            </div>

                            {/* Supplementary Attachments Upload Box */}
                            <div className="mt-5 border border-desert-gold/25 rounded-2xl p-4.5 bg-gradient-to-br from-desert-gold/5 to-transparent relative overflow-hidden group/attachments">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-desert-gold/3 rounded-full blur-2xl pointer-events-none group-hover/attachments:bg-desert-gold/8 transition-all duration-700" />
                                <label className="block text-sm font-bold text-deep-teal mb-1 flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-desert-gold" />
                                    {t('common.attachments', '配套讲义与附件')}
                                </label>
                                <p className="text-[11px] text-arabian-night/60 mb-3 leading-relaxed font-semibold">
                                    💡 {t('recordings_manager.attachments_tip', '可选。可上传配套课件、PDF指南、脑图或附件压缩包，单个大小上限 50MB。')}
                                </p>
                                
                                <div className="flex flex-col gap-2.5">
                                    {/* Upload Button */}
                                    <label className={`border-2 border-dashed border-desert-gold/20 rounded-xl p-4 flex flex-col items-center justify-center gap-1 bg-white/40 transition-all duration-300 ${
                                        uploading 
                                            ? 'opacity-40 cursor-not-allowed pointer-events-none' 
                                            : 'cursor-pointer hover:border-desert-gold/50 hover:bg-desert-gold/5 hover:-translate-y-0.5 shadow-sm hover:shadow-md active:translate-y-0 active:shadow-sm'
                                    }`}>
                                        <UploadCloud className="w-5 h-5 text-desert-gold/80" />
                                        <span className="text-xs font-bold text-arabian-night/60">{t('common.add_attachment', '添加附件课件')}</span>
                                        <input
                                            type="file"
                                            multiple
                                            disabled={uploading}
                                            onChange={handleAttachmentUpload}
                                            className="hidden"
                                        />
                                    </label>
                                    
                                    {/* Active Uploading Attachment Progresses */}
                                    {Object.entries(uploadingAttachments).map(([tempId, prog]) => (
                                        <div key={tempId} className="bg-desert-gold/5 border border-desert-gold/10 p-2.5 rounded-xl text-xs space-y-1.5 animate-pulse">
                                            <div className="flex justify-between font-bold text-deep-teal">
                                                <span>{t('common.loading', '加载中...')}</span>
                                                <span className="text-desert-gold">{prog}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden">
                                                <div className="bg-desert-gold h-full rounded-full transition-all duration-300" style={{ width: `${prog}%` }}></div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Uploaded Attachments List */}
                                    {attachments.length > 0 && (
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                            {attachments.map(att => (
                                                <div key={att.id} className="flex justify-between items-center bg-white border border-gray-100 p-2 rounded-xl text-xs group shadow-sm">
                                                    <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                                        <span className="text-base shrink-0" role="img" aria-label="file">
                                                            {att.type === 'ppt' ? '📊' : att.type === 'pdf' ? '📕' : att.type === 'image' ? '🖼️' : '📄'}
                                                        </span>
                                                        <span className="font-semibold text-arabian-night truncate" title={att.name}>
                                                            {att.name}
                                                        </span>
                                                        <span className="text-[10px] text-arabian-night/40 scale-95 origin-left shrink-0">
                                                            ({att.size})
                                                        </span>
                                                    </div>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleRemoveAttachment(att.id, att.url)}
                                                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 opacity-60 group-hover:opacity-100 transition-all shrink-0 cursor-pointer"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                                disabled={uploading || Object.keys(uploadingAttachments).length > 0 || (!editingId && !file && attachments.length === 0) || categories.length === 0}
                                className={`w-full py-3 mt-4 rounded-xl font-bold text-white shadow-md transition-all ${
                                    uploading || Object.keys(uploadingAttachments).length > 0 || (!editingId && !file && attachments.length === 0) || categories.length === 0 
                                        ? 'bg-gray-400 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-deep-teal to-teal-700 hover:-translate-y-0.5 hover:shadow-lg'
                                }`}
                            >
                                {categories.length === 0 
                                    ? t('recordings_manager.create_cat_first') 
                                    : Object.keys(uploadingAttachments).length > 0
                                        ? t('recordings_manager.waiting_attachments', '正在等待附件讲义上传完成...')
                                        : uploading 
                                            ? t('common.processing') 
                                            : (editingId ? t('recordings_manager.save_changes') : t('recordings_manager.start_upload'))}
                            </button>
                        </form>
                    </div>
                </div>
                )}

                {/* Right Column: Recordings List */}
                <div className={isWriteAllowed ? "lg:col-span-2" : "w-full"}>
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
                                {(profile?.role === 'super_admin' || profile?.role === 'sd') && (
                                    <select
                                        value={adminSmFilter}
                                        onChange={(e) => setAdminSmFilter(e.target.value)}
                                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white/50 focus:ring-2 focus:ring-desert-gold focus:border-transparent outline-none transition-all font-semibold"
                                    >
                                        {profile?.role === 'super_admin' ? (
                                            <>
                                                <option value="all">{t('learning_hub.all_content', '全部可见')}</option>
                                                <option value="public">{t('recordings_manager.scope_public', '公共公共库')}</option>
                                            </>
                                        ) : (
                                            <option value="all">{t('learning_hub.all_content', '下辖所有团队')}</option>
                                        )}
                                        {systemUsers
                                            .filter(u => u.role === 'sm' && (profile?.role === 'super_admin' || u.sd === profile?.crmId))
                                            .map(u => (
                                                <option key={u.crmId} value={u.crmId}>
                                                    {u.name || u.crmId} ({u.crmId})
                                                </option>
                                            ))
                                        }
                                    </select>
                                )}
                                {selectedIds.length > 0 && isWriteAllowed && (
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

                        {filteredRecordings.length > 0 && isWriteAllowed && (
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
                                {filteredRecordings.map((rec) => {
                                    const url = rec.audioUrl?.toLowerCase() || '';
                                    const cleanUrl = url.split('?')[0];
                                    const isVideo = cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.m4v') || cleanUrl.endsWith('.avi') || cleanUrl.endsWith('.mkv');

                                    return (
                                        <div key={rec.id} className={`bg-white/60 p-4 rounded-xl flex items-center justify-between hover:bg-white transition-colors border ${editingId === rec.id ? 'border-desert-gold shadow-md' : 'border-transparent hover:border-desert-gold/30'} group`}>
                                            <div className="flex items-start gap-4">
                                                {isWriteAllowed && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(rec.id)}
                                                        onChange={() => toggleSelect(rec.id)}
                                                        className="mt-3.5 w-4 h-4 text-desert-gold border-gray-300 rounded focus:ring-desert-gold cursor-pointer shrink-0"
                                                    />
                                                )}
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
                                                                : (rec.businessType || 'kid') === 'leader'
                                                                    ? 'bg-amber-50 text-yellow-800 border border-desert-gold/30 font-bold'
                                                                    : (rec.businessType || 'kid') === 'kid' 
                                                                        ? 'bg-blue-100 text-blue-700' 
                                                                        : (rec.businessType || 'kid') === 'adult'
                                                                            ? 'bg-purple-100 text-purple-700'
                                                                            : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                            {(rec.businessType || 'kid') === 'ss'
                                                                ? t('common.type_ss')
                                                                : (rec.businessType || 'kid') === 'leader'
                                                                    ? t('common.type_leader')
                                                                    : (rec.businessType || 'kid') === 'kid'
                                                                        ? t('common.type_kid')
                                                                        : t('common.type_adult')
                                                            }
                                                        </span>
                                                        <span className="text-[10px] bg-desert-gold text-white px-2 py-0.5 rounded-full font-semibold">
                                                            {rec.categoryName || t('common.uncategorized')}
                                                        </span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                                            (rec as any).hubScope === 'team'
                                                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        }`}>
                                                            {(rec as any).hubScope === 'team'
                                                                ? `👥 ${t('recordings_manager.scope_team', '团队专属')}: ${(rec as any).targetSmId}`
                                                                : `🌍 ${t('recordings_manager.scope_public', '公共')}`
                                                            }
                                                        </span>
                                                        {(() => {
                                                            const hubs = (rec as any).targetHubs || ['public'];
                                                            return hubs.map((h: string) => (
                                                                <span key={h} className={`text-[9px] px-2 py-0.5 rounded-full font-bold border select-none ${
                                                                    h === 'new_cc' 
                                                                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                                                        : 'bg-teal-50 text-teal-700 border-teal-200'
                                                                }`}>
                                                                    {h === 'new_cc' ? 'New CC' : 'Public'}
                                                                </span>
                                                            ));
                                                        })()}
                                                        {(rec as any).transcript && (rec as any).transcriptStatus !== 'transcribing' && (
                                                             <span 
                                                                 onClick={() => setViewingTranscriptRecording(rec)}
                                                                 className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold cursor-pointer hover:bg-green-600 hover:text-white hover:border-transparent transition-all active:scale-95 flex items-center shrink-0"
                                                                 title={t('learning_hub.click_to_view_direct', '点击直接查看阿语逐字稿')}
                                                             >
                                                                 📝 {t('recordings_manager.transcript_ready', '阿语逐字稿已就绪')}
                                                             </span>
                                                         )}
                                                         {false && ((rec as any).transcriptStatus === 'transcribing' || transcribingIds[rec.id]) && !isVideo && (
                                                             <span className="text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5 animate-pulse">
                                                                 ⚙️ {t('recordings_manager.transcribing', '正在解析为逐字稿...')}
                                                             </span>
                                                         )}
                                                         {false && (rec as any).transcriptStatus === 'error' && !isVideo && (
                                                             <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-semibold">
                                                                 ❌ {t('recordings_manager.transcribe_fail', '语音解析失败')}
                                                             </span>
                                                         )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-arabian-night flex items-center flex-wrap gap-1.5">
                                                            {rec.displayId && <span className="text-desert-gold mr-1.5 text-sm">[{rec.displayId}]</span>}
                                                            {rec.title}
                                                            {rec.isPinned && (
                                                                <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-50 text-[#a88216] border border-[#d4af37]/30 px-1.5 py-0.5 rounded font-bold shadow-sm select-none" title={t('recordings_manager.pinned', '已置顶')}>
                                                                    📌 {t('recordings_manager.pinned', '已置顶')}
                                                                </span>
                                                            )}
                                                        </h3>
                                                    </div>
                                                    <p className="text-sm text-arabian-night/60 mt-1 line-clamp-1">{rec.description}</p>
                                                    {rec.lecturerName && (
                                                        <p className="text-xs text-desert-gold mt-1 font-medium flex items-center gap-1">
                                                            <User className="h-3 w-3" /> {rec.lecturerName}
                                                        </p>
                                                    )}
                                                    {rec.attachments && rec.attachments.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 mt-2 select-none">
                                                            {rec.attachments.map((att: Attachment) => (
                                                                <a 
                                                                    key={att.id} 
                                                                    href={att.url} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    title={`${att.name} (${att.size})`}
                                                                    className="inline-flex items-center gap-1 bg-desert-gold/10 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full hover:bg-desert-gold/20 transition-all border border-desert-gold/20 hover:scale-[1.03] shrink-0"
                                                                >
                                                                    <span>{att.type === 'ppt' ? '📊' : att.type === 'pdf' ? '📕' : att.type === 'image' ? '🖼️' : '📄'}</span>
                                                                    <span className="max-w-[140px] truncate">{att.name}</span>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 ml-4">
                                                <div className="flex gap-2">
                                                    {/* Temporarily hidden transcription generation button */}
                                                    {isWriteAllowed && (
                                                        <button 
                                                            onClick={() => {
                                                                if ((rec as any).transcript) {
                                                                    setViewingTranscriptRecording(rec);
                                                                } else {
                                                                    handleTranscribe(rec);
                                                                }
                                                            }} 
                                                            disabled={transcribingIds[rec.id] || (rec as any).transcriptStatus === 'transcribing' || uploading}
                                                            className={`p-1.5 bg-white rounded-md transition-colors shadow-sm border border-gray-100 disabled:opacity-50 ${
                                                                (rec as any).transcript 
                                                                    ? 'text-green-600 hover:bg-green-50' 
                                                                    : 'text-arabian-night/40 hover:text-desert-gold hover:bg-yellow-50'
                                                            }`} 
                                                            title={(rec as any).transcript ? t('learning_hub.click_to_view_direct', '点击直接查看阿语逐字稿') : t('recordings_manager.generate_transcript', '自动生成阿语逐字稿')}
                                                        >
                                                            {transcribingIds[rec.id] || (rec as any).transcriptStatus === 'transcribing' ? (
                                                                <RefreshCw className="h-4 w-4 animate-spin text-desert-gold" />
                                                            ) : (
                                                                <FileText className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    )}
                                                    {isWriteAllowed && (
                                                        <button 
                                                            onClick={() => handleTogglePin(rec)} 
                                                            disabled={uploading} 
                                                            className={`p-1.5 bg-white rounded-md transition-colors shadow-sm border border-gray-100 disabled:opacity-50 ${
                                                                rec.isPinned 
                                                                    ? 'text-desert-gold hover:bg-yellow-50 hover:text-desert-gold' 
                                                                    : 'text-arabian-night/40 hover:text-desert-gold hover:bg-yellow-50'
                                                            }`} 
                                                            title={rec.isPinned ? t('recordings_manager.unpin', '取消置顶') : t('recordings_manager.pin', '置顶')}
                                                        >
                                                            <Pin className={`h-4 w-4 ${rec.isPinned ? 'fill-current' : ''}`} />
                                                        </button>
                                                    )}
                                                    {profile?.role === 'super_admin' && (rec as any).hubScope === 'team' && (
                                                        <button 
                                                            onClick={() => {
                                                                setPromotingRecording(rec);
                                                                const isCatPublic = rec.categoryId && categories.find(c => c.id === rec.categoryId)?.hubScope !== 'team';
                                                                setPromoteCategoryId(isCatPublic ? rec.categoryId : '');
                                                            }} 
                                                            disabled={uploading} 
                                                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1 shrink-0" 
                                                            title={t('recordings_manager.promote_btn', '一键转为公共库')}
                                                        >
                                                            <Sparkles className="h-3.5 w-3.5" />
                                                            <span>{t('recordings_manager.promote_btn', '转为公共库')}</span>
                                                        </button>
                                                    )}
                                                    <button onClick={() => handlePushToDingTalkClick(rec)} className="p-1.5 bg-white rounded-md text-arabian-night/40 hover:text-teal-600 hover:bg-teal-50 transition-colors shadow-sm border border-gray-100" title={t('recordings_manager.push_dingtalk', '推送至钉钉')}>
                                                        <Send className="h-4 w-4" />
                                                    </button>
                                                    {isWriteAllowed && (
                                                        <button onClick={() => handleEdit(rec)} className="p-1.5 bg-white rounded-md text-arabian-night/40 hover:text-deep-teal hover:bg-gray-100 transition-colors shadow-sm border border-gray-100" title="编辑">
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {isWriteAllowed && (
                                                        <button onClick={() => handleDelete(rec)} disabled={uploading} className="p-1.5 bg-white rounded-md text-arabian-night/40 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm border border-gray-100 disabled:opacity-50" title="删除">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            {(() => {
                                                const url = rec.audioUrl?.toLowerCase() || '';
                                                const cleanUrl = url.split('?')[0];
                                                const isVideo = cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.m4v') || cleanUrl.endsWith('.avi') || cleanUrl.endsWith('.mkv');
                                                const isAudio = cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') || cleanUrl.endsWith('.m4a') || cleanUrl.endsWith('.ogg') || cleanUrl.endsWith('.aac') || cleanUrl.endsWith('.flac');
                                                
                                                if (!rec.audioUrl) {
                                                    return (
                                                        <span className="inline-flex items-center gap-1 text-xs text-arabian-night/60 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200 mt-1 font-semibold select-none">
                                                            📄 {t('recordings_manager.attachments_only', '仅含附件/课件')} ({rec.attachments?.length || 0})
                                                        </span>
                                                    );
                                                }
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
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Direct Transcript View Modal for Admin */}
            {viewingTranscriptRecording && (
                <div className="fixed inset-0 bg-arabian-night/40 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300">
                    <div className="bg-white/95 rounded-3xl shadow-2xl border border-white/60 p-6 md:p-8 max-w-2xl w-full mx-4 transform transition-all animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] text-arabian-night relative">
                        {/* Gold header accent line */}
                        <div className="h-1.5 w-full bg-gradient-to-r from-deep-teal via-desert-gold to-deep-teal absolute top-0 left-0 right-0 rounded-t-3xl" />
                        
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-gray-100 pb-4 mt-1">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-deep-teal">
                                    <FileText className="w-5 h-5 text-desert-gold shrink-0 animate-pulse" />
                                    <span className="text-xs font-black tracking-widest uppercase bg-desert-gold/10 px-2 py-0.5 rounded border border-desert-gold/25 select-none">
                                        {adminActiveTab === 'chinese' ? t('learning_hub.chinese_transcript', '中文翻译') : t('learning_hub.arabic_transcript', '阿语逐字稿')}
                                    </span>
                                </div>
                                <h3 className="text-lg font-black text-slate-800 line-clamp-1 leading-snug">
                                    {viewingTranscriptRecording.title}
                                </h3>
                                {viewingTranscriptRecording.lecturerName && (
                                    <p className="text-xs text-desert-gold font-bold flex items-center gap-1">
                                        <User className="w-3.5 h-3.5 shrink-0" />
                                        <span>{viewingTranscriptRecording.lecturerName}</span>
                                    </p>
                                )}
                            </div>
                            
                            <button 
                                onClick={() => setViewingTranscriptRecording(null)}
                                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shadow-sm cursor-pointer active:scale-95 shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Control Toolbar */}
                        <div className="bg-slate-50/80 px-4 py-3 rounded-xl border border-gray-100 flex flex-wrap justify-between items-center gap-4 select-none my-3">
                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const textToCopy = adminActiveTab === 'chinese' ? adminTranscriptZh : viewingTranscriptRecording.transcript;
                                        if (textToCopy) {
                                            navigator.clipboard.writeText(textToCopy);
                                            alert(t('common.copied', '已复制到剪贴板！'));
                                        }
                                    }}
                                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                                >
                                    <BookOpen className="w-3.5 h-3.5 text-desert-gold" />
                                    <span>{t('common.copy', '复制')}</span>
                                </button>
                                
                                <button
                                    onClick={() => {
                                        const textToDownload = adminActiveTab === 'chinese' ? adminTranscriptZh : viewingTranscriptRecording.transcript;
                                        if (!textToDownload) return;
                                        const element = document.createElement("a");
                                        const file = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
                                        element.href = URL.createObjectURL(file);
                                        element.download = `${viewingTranscriptRecording.title}_transcript_${adminActiveTab}.txt`;
                                        document.body.appendChild(element);
                                        element.click();
                                        document.body.removeChild(element);
                                    }}
                                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5 text-desert-gold" />
                                    <span>{t('common.download', '下载')}</span>
                                </button>
                            </div>

                            {/* Bilingual Translation Toggle */}
                            {isSDLevel && (
                                <div className="flex bg-gray-200 p-0.5 rounded-lg text-xs font-semibold border border-gray-300/30 select-none">
                                    <button
                                        onClick={() => setAdminActiveTab('arabic')}
                                        className={`px-3 py-1.5 rounded-md transition-all duration-200 cursor-pointer ${
                                            adminActiveTab === 'arabic'
                                                ? 'bg-white text-deep-teal shadow-sm border border-gray-200/20'
                                                : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                    >
                                        🌐 {t('learning_hub.original_transcript', 'Original')}
                                    </button>
                                    <button
                                        onClick={() => setAdminActiveTab('chinese')}
                                        className={`px-3 py-1.5 rounded-md transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                                            adminActiveTab === 'chinese'
                                                ? 'bg-white text-deep-teal shadow-sm border border-gray-200/20'
                                                : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                    >
                                        🇨🇳 {t('learning_hub.chinese_transcript', '中文')}
                                    </button>
                                </div>
                            )}

                            {/* Trigger Regeneration inside viewer */}
                            <button
                                onClick={() => {
                                    if (window.confirm(t('recordings_manager.regenerate_confirm', '确定要重新生成阿语逐字稿吗？这可能需要几分钟。'))) {
                                        handleTranscribe(viewingTranscriptRecording);
                                        setViewingTranscriptRecording(null);
                                    }
                                }}
                                className="bg-amber-50 hover:bg-amber-100 border border-desert-gold/25 text-yellow-800 text-xs font-bold py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                            >
                                <RefreshCw className="w-3.5 h-3.5 text-desert-gold animate-spin-hover" />
                                <span>{t('recordings_manager.regenerate_transcript', '重新生成阿语逐字稿')}</span>
                            </button>
                        </div>
                        
                        {/* Transcript Body */}
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30 rounded-2xl border border-gray-100 max-h-[40vh] my-1 flex flex-col">
                            {adminActiveTab === 'chinese' && loadingAdminTranslation ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                                    <RefreshCw className="w-6 h-6 animate-spin text-desert-gold" />
                                    <span className="text-xs font-bold animate-pulse">{t('learning_hub.generating_translation', '正在智能生成中文对照翻译...')}</span>
                                </div>
                            ) : (
                                <div 
                                    className={`bg-white border border-slate-100 rounded-xl p-5 md:p-6 shadow-sm text-sm leading-relaxed whitespace-pre-line ${
                                        adminActiveTab === 'chinese' ? 'text-left font-sans' : 'text-right font-medium'
                                    } text-slate-800`}
                                    dir={adminActiveTab === 'chinese' ? 'ltr' : 'rtl'}
                                    style={{ 
                                        fontFamily: adminActiveTab === 'chinese' 
                                            ? "'Inter', 'Noto Sans SC', sans-serif" 
                                            : "'Noto Sans Arabic', 'Inter', sans-serif" 
                                    }}
                                >
                                    {adminActiveTab === 'chinese' ? (adminTranscriptZh || t('learning_hub.no_translation_available', '暂无中文对照翻译')) : viewingTranscriptRecording.transcript}
                                </div>
                            )}
                        </div>
                        
                        {/* Footer */}
                        <div className="pt-4 border-t border-gray-100 text-center select-none mt-4">
                            {isSDLevel && (
                                <p className="text-[10px] text-slate-400 font-bold mb-2">
                                    🔒 {t('learning_hub.sd_translation_notice', '🔒 SD 总监层级以上特权：中文对照翻译通道已激活')}
                                </p>
                            )}
                            <p className="text-[10px] text-slate-400 font-bold tracking-wide">
                                ME 云学堂 · 管理控制台
                            </p>
                        </div>
                    </div>
                </div>
            )}

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
                            {isSuperAdmin && (
                                <button
                                    type="button"
                                    onClick={() => setPushTargetType('group')}
                                    className={`flex-1 py-2.5 px-3 rounded-lg text-[11px] md:text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-0 bg-transparent cursor-pointer ${
                                        pushTargetType === 'group'
                                            ? 'bg-white text-deep-teal shadow-md border border-gray-100'
                                            : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/40'
                                    }`}
                                >
                                    {t('recordings_manager.push_to_group', '👥 钉钉群助手')}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setPushTargetType('individuals')}
                                className={`flex-1 py-2.5 px-3 rounded-lg text-[11px] md:text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-0 bg-transparent cursor-pointer ${
                                    pushTargetType === 'individuals'
                                        ? 'bg-white text-deep-teal shadow-md border border-gray-100'
                                        : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/40'
                                }`}
                            >
                                {t('recordings_manager.push_to_individuals', '👤 钉钉个人')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setPushTargetType('app')}
                                className={`flex-1 py-2.5 px-3 rounded-lg text-[11px] md:text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-0 bg-transparent cursor-pointer ${
                                    pushTargetType === 'app'
                                        ? 'bg-white text-deep-teal shadow-md border border-gray-100'
                                        : 'text-arabian-night/60 hover:text-arabian-night hover:bg-white/40'
                                }`}
                            >
                                {t('recordings_manager.push_to_app', '📱 App系统通知')}
                            </button>
                        </div>

                        {pushTargetType === 'app' && selectedSdsForPush.length === 0 && (
                            <p className="text-[11px] text-[#a88216] bg-desert-gold/5 border border-desert-gold/15 rounded-xl p-2.5 font-medium leading-relaxed">
                                💡 {t('recordings_manager.app_push_all_tip', '提示：未选择任何部门，本次推送将广播给所有已注册 App 推送的员工。若只需推送给特定团队，请勾选下方对应的部门。')}
                            </p>
                        )}

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
                                        🇬🇧 {t('recordings_manager.lang_en', 'English')}
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
                                        🇨🇳 {t('recordings_manager.lang_zh', '中文')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* SD Selection Checklist (When individual push or app push is active) */}
                        {(pushTargetType === 'individuals' || pushTargetType === 'app') && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-300 flex flex-col gap-2">
                                <div className="flex items-center justify-between text-xs font-bold text-arabian-night/70">
                                    <span>{t('recordings_manager.select_sd_teams', '选择接收部门 (按 SD 维度及职能部门)')}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (selectedSdsForPush.length === pushGroupList.length) {
                                                setSelectedSdsForPush([]);
                                            } else {
                                                setSelectedSdsForPush(pushGroupList.map(g => g.id));
                                            }
                                        }}
                                        className="text-deep-teal hover:text-desert-gold transition-colors"
                                    >
                                        {selectedSdsForPush.length === pushGroupList.length ? t('recordings_manager.deselect_all', '取消全选') : t('recordings_manager.select_all', '全选')}
                                    </button>
                                </div>
                                <div className="border border-gray-100 rounded-2xl bg-white/50 p-3 flex flex-col gap-2 max-h-60 overflow-y-auto mt-1 custom-scrollbar">
                                    {pushGroupList.length === 0 ? (
                                        <p className="text-xs text-arabian-night/40 py-4 text-center">{t('recordings_manager.no_sds', '暂无可用接收部门/团队')}</p>
                                    ) : (
                                        pushGroupList.map(group => {
                                            const isChecked = selectedSdsForPush.includes(group.id);
                                            const groupCcs = getGroupCcs(group);
                                            const isExpanded = !!expandedGroups[group.id];
                                            
                                            return (
                                                <div key={group.id} className="flex flex-col gap-1 bg-white/30 rounded-xl p-1.5 border border-gray-100/50 shadow-sm">
                                                    {/* Group Header Row */}
                                                    <div className="flex items-center justify-between group/row">
                                                        <label className="flex items-center gap-2.5 text-xs font-bold hover:bg-deep-teal/5 p-1.5 rounded-lg transition-colors cursor-pointer select-none flex-1 min-w-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => handleGroupToggle(group)}
                                                                ref={el => {
                                                                    if (el) {
                                                                        // Indeterminate state if some but not all CCs are checked
                                                                        const selectedCount = groupCcs.filter(u => selectedSdsForPush.includes(`cc:${u.crmId.toLowerCase()}`)).length;
                                                                        el.indeterminate = !isChecked && selectedCount > 0 && selectedCount < groupCcs.length;
                                                                    }
                                                                }}
                                                                className="h-4 w-4 rounded border-gray-300 text-deep-teal focus:ring-deep-teal transition-all"
                                                            />
                                                            <span className="truncate">{group.name}</span>
                                                        </label>
                                                        
                                                        {groupCcs.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleGroupExpand(group.id)}
                                                                className="p-1 hover:bg-deep-teal/10 rounded-lg text-deep-teal transition-colors shrink-0 mr-1 flex items-center gap-0.5"
                                                                title="查看成员"
                                                            >
                                                                <span className="text-[10px] text-gray-400 font-medium">({groupCcs.length})</span>
                                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Expanded CC Checklist */}
                                                    {isExpanded && groupCcs.length > 0 && (
                                                        <div className="pl-6 pr-2 py-2 flex flex-col gap-2 border-t border-gray-100/50 bg-white/20 rounded-b-xl animate-in slide-in-from-top-1 duration-200 text-[11px]">
                                                            {(() => {
                                                                if (group.type !== 'sd' && group.type !== 'sm') {
                                                                    return groupCcs.map(cc => {
                                                                        const isCcChecked = isChecked || selectedSdsForPush.includes(`cc:${cc.crmId.toLowerCase()}`);
                                                                        return (
                                                                            <label 
                                                                                key={cc.id} 
                                                                                className="flex items-center gap-2 py-1.5 px-2 hover:bg-deep-teal/5 rounded-md font-semibold text-arabian-night/80 cursor-pointer select-none transition-colors"
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isCcChecked}
                                                                                    onChange={() => handleCcToggle(cc.crmId, group)}
                                                                                    className="h-3.5 w-3.5 rounded border-gray-300 text-deep-teal focus:ring-deep-teal transition-all scale-90"
                                                                                />
                                                                                <span className="truncate">{cc.name || cc.crmId}</span>
                                                                                {cc.crmId && <span className="text-[9px] text-gray-400 font-medium font-mono">({cc.crmId})</span>}
                                                                            </label>
                                                                        );
                                                                    });
                                                                }

                                                                const { smGroups, sdTlGroups, directRepsToSd } = buildGroupHierarchy(groupCcs);

                                                                const renderTlNode = (tl: any) => {
                                                                    const allTlUsers = [...tl.users, ...(tl.tlUserObj ? [tl.tlUserObj] : [])];
                                                                    const isAllChecked = isTlSelected(tl.tlKey, allTlUsers, group);
                                                                    const isSomeChecked = !isAllChecked && allTlUsers.some(u => isUserSelected(u.crmId, group));
                                                                    const isTlExpanded = !!expandedGroups[`tl:${group.id}:${tl.tlKey}`];

                                                                    return (
                                                                        <div key={tl.tlKey} className="flex flex-col gap-1 pl-4 border-l border-gray-200/60 my-0.5">
                                                                            <div className="flex items-center justify-between group/tl-row py-1">
                                                                                <label className="flex items-center gap-2 font-bold text-arabian-night/80 cursor-pointer select-none flex-1 min-w-0">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isAllChecked}
                                                                                        onChange={() => handleTlToggle(tl.tlKey, allTlUsers, group)}
                                                                                        ref={el => { if (el) el.indeterminate = isSomeChecked; }}
                                                                                        className="h-3.5 w-3.5 rounded border-gray-300 text-deep-teal focus:ring-deep-teal transition-all scale-90"
                                                                                    />
                                                                                    <span className="truncate">{tl.tlName} {t('recordings_manager.team_suffix', '团队')}</span>
                                                                                </label>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggleGroupExpand(`tl:${group.id}:${tl.tlKey}`)}
                                                                                    className="p-0.5 hover:bg-deep-teal/15 rounded text-deep-teal transition-colors shrink-0 flex items-center mr-1"
                                                                                >
                                                                                    <span className="text-[9px] text-gray-400 font-medium mr-0.5">({allTlUsers.length})</span>
                                                                                    {isTlExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                                </button>
                                                                            </div>
                                                                            {isTlExpanded && (
                                                                                <div className="pl-6 flex flex-col gap-1 border-l border-dotted border-gray-200/50 py-0.5">
                                                                                    {allTlUsers.map(cc => {
                                                                                        const isCcChecked = isUserSelected(cc.crmId, group);
                                                                                        return (
                                                                                            <label 
                                                                                                key={cc.crmId} 
                                                                                                className="flex items-center gap-2 py-1 px-1.5 hover:bg-deep-teal/5 rounded text-[10.5px] text-arabian-night/70 cursor-pointer select-none transition-colors"
                                                                                            >
                                                                                                <input
                                                                                                    type="checkbox"
                                                                                                    checked={isCcChecked}
                                                                                                    onChange={() => handleCcToggle(cc.crmId, group)}
                                                                                                    className="h-3 w-3 rounded border-gray-300 text-deep-teal focus:ring-deep-teal transition-all scale-90"
                                                                                                />
                                                                                                <span className="truncate">{cc.name || cc.crmId}</span>
                                                                                                {cc.role && cc.role !== 'rep' && cc.role !== 'user' && (
                                                                                                    <span className="text-[8px] bg-desert-gold/10 border border-desert-gold/25 text-[#a88216] px-1 rounded scale-90 origin-left">{cc.role.toUpperCase()}</span>
                                                                                                )}
                                                                                            </label>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                };

                                                                const renderSmNode = (sm: any) => {
                                                                    const allSmUsers = [...sm.directToSm];
                                                                    sm.tlGroups.forEach((tl: any) => {
                                                                        allSmUsers.push(...tl.users);
                                                                        if (tl.tlUserObj) allSmUsers.push(tl.tlUserObj);
                                                                    });
                                                                    if (sm.smUserObj) allSmUsers.push(sm.smUserObj);

                                                                    const isAllChecked = isSmSelected(sm.smKey, allSmUsers, group);
                                                                    const isSomeChecked = !isAllChecked && allSmUsers.some(u => isUserSelected(u.crmId, group));
                                                                    const isSmExpanded = !!expandedGroups[`sm:${group.id}:${sm.smKey}`];

                                                                    return (
                                                                        <div key={sm.smKey} className="flex flex-col gap-1 pl-2 border-l border-gray-300/80 my-1">
                                                                            <div className="flex items-center justify-between group/sm-row py-1">
                                                                                <label className="flex items-center gap-2 font-bold text-arabian-night/90 cursor-pointer select-none flex-1 min-w-0">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isAllChecked}
                                                                                        onChange={() => handleSmToggle(sm.smKey, allSmUsers, group)}
                                                                                        ref={el => { if (el) el.indeterminate = isSomeChecked; }}
                                                                                        className="h-3.5 w-3.5 rounded border-gray-300 text-deep-teal focus:ring-deep-teal transition-all scale-95"
                                                                                    />
                                                                                    <span className="truncate">{sm.smName} {t('recordings_manager.team_suffix', '团队')}</span>
                                                                                </label>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggleGroupExpand(`sm:${group.id}:${sm.smKey}`)}
                                                                                    className="p-0.5 hover:bg-deep-teal/15 rounded text-deep-teal transition-colors shrink-0 flex items-center mr-1"
                                                                                >
                                                                                    <span className="text-[9px] text-gray-400 font-medium mr-0.5">({allSmUsers.length})</span>
                                                                                    {isSmExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                                </button>
                                                                            </div>
                                                                            {isSmExpanded && (
                                                                                <div className="pl-4 flex flex-col gap-1.5 py-1">
                                                                                    {sm.tlGroups.map((tl: any) => renderTlNode(tl))}
                                                                                    {sm.directToSm.map(cc => {
                                                                                        const isCcChecked = isUserSelected(cc.crmId, group);
                                                                                        return (
                                                                                            <label 
                                                                                                key={cc.crmId} 
                                                                                                className="flex items-center gap-2 py-1 px-1.5 hover:bg-deep-teal/5 rounded text-[10.5px] text-arabian-night/70 cursor-pointer select-none transition-colors"
                                                                                            >
                                                                                                <input
                                                                                                    type="checkbox"
                                                                                                    checked={isCcChecked}
                                                                                                    onChange={() => handleCcToggle(cc.crmId, group)}
                                                                                                    className="h-3 w-3 rounded border-gray-300 text-deep-teal focus:ring-deep-teal transition-all scale-90"
                                                                                                />
                                                                                                <span className="truncate">{cc.name || cc.crmId}</span>
                                                                                            </label>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                };

                                                                return (
                                                                    <>
                                                                        {smGroups.map(sm => renderSmNode(sm))}
                                                                        {sdTlGroups.map(tl => renderTlNode(tl))}
                                                                        {directRepsToSd.length > 0 && (
                                                                            <div className="flex flex-col gap-1 pl-2 my-1">
                                                                                <div className="text-[10px] text-gray-400 font-bold px-1.5 mb-1">{t('recordings_manager.direct_members', '直属成员')}</div>
                                                                                {directRepsToSd.map(cc => {
                                                                                    const isCcChecked = isUserSelected(cc.crmId, group);
                                                                                    return (
                                                                                        <label 
                                                                                            key={cc.crmId} 
                                                                                            className="flex items-center gap-2 py-1 px-1.5 hover:bg-deep-teal/5 rounded text-[10.5px] text-arabian-night/70 cursor-pointer select-none transition-colors"
                                                                                        >
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={isCcChecked}
                                                                                                onChange={() => handleCcToggle(cc.crmId, group)}
                                                                                                className="h-3 w-3 rounded border-gray-300 text-deep-teal focus:ring-deep-teal transition-all scale-90"
                                                                                            />
                                                                                            <span className="truncate">{cc.name || cc.crmId}</span>
                                                                                        </label>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
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
                                className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 rounded-xl transition-all shadow-lg hover:shadow-xl shadow-teal-600/10 hover:shadow-teal-600/25 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed border-0 cursor-pointer"
                            >
                                {pushingToDingTalk ? (
                                    <>
                                        <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        {t('recordings_manager.pushing', '正在推送...')}
                                    </>
                                ) : pushTargetType === 'group' ? (
                                    t('recordings_manager.push_btn_group', '广播推送至工作群')
                                ) : pushTargetType === 'app' ? (
                                    selectedSdsForPush.length === 0
                                        ? t('recordings_manager.push_btn_app_all', '全局广播推送至 App')
                                        : t('recordings_manager.push_btn_app_targeted', '推送至 App (共 {{count}} 个团队)', { count: selectedSdsForPush.length })
                                ) : (
                                    t('recordings_manager.push_btn_individuals', '推送给选定团队 (共 {{count}} 个)', { count: selectedSdsForPush.length })
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Promotion Category Selector Modal */}
            {promotingRecording && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-arabian-night/50 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-100 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-deep-teal">
                                {t('recordings_manager.promote_modal_title', '同步晋升至公共库')}
                            </h3>
                            <button 
                                onClick={() => setPromotingRecording(null)} 
                                className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4 py-2">
                            <p className="text-xs text-arabian-night/60 leading-relaxed">
                                {t('recordings_manager.promote_modal_desc', '确定要将此团队专属素材同步复制到公共库吗？晋升后它将被所有业务线用户共享。由于该素材当前属于团队特有目录，请为其指定公共库下的目标分类目录：')}
                            </p>
                            
                            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100/80">
                                <div className="text-xs text-arabian-night/40 font-semibold mb-1">{t('recordings_manager.recording_title', '素材名称')}</div>
                                <div className="text-sm font-bold text-deep-teal truncate">{promotingRecording.title}</div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-deep-teal mb-1.5">{t('recordings_manager.select_category', '选择公共库分类')}</label>
                                <select
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-desert-gold focus:border-transparent bg-white"
                                    value={promoteCategoryId}
                                    onChange={(e) => setPromoteCategoryId(e.target.value)}
                                >
                                    <option value="">{t('common.uncategorized', '未分类')}</option>
                                    {categories
                                        .filter(c => ((c.businessType || 'kid') === promotingRecording.businessType) && ((c as any).hubScope || 'public') === 'public')
                                        .map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setPromotingRecording(null)}
                                className="px-4 py-2 text-xs font-bold text-arabian-night/60 hover:text-arabian-night hover:bg-gray-100 rounded-xl transition-all"
                            >
                                {t('common.cancel', '取消')}
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const rec = promotingRecording;
                                    const catId = promoteCategoryId;
                                    setPromotingRecording(null);
                                    await handlePromoteToPublic(rec, catId);
                                }}
                                className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 rounded-xl transition-all shadow-lg hover:shadow-xl shadow-amber-500/10 flex items-center gap-1.5 border-0 cursor-pointer"
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>{t('recordings_manager.promote_confirm_btn', '确认晋升并同步')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
