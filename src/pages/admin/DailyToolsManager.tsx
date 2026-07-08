import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Edit3, ExternalLink, Eye, EyeOff, Link as LinkIcon, Plus, Save, Trash2, Wrench } from 'lucide-react';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

type ToolScope = 'KCC' | 'GCC' | 'Adult' | 'SS' | 'all';
type ToolType = 'sheet' | 'form' | 'dashboard' | 'sop' | 'system' | 'other';

interface DailyTool {
    id: string;
    title: string;
    description?: string;
    url: string;
    targetTeam: ToolScope;
    toolType?: ToolType;
    sortOrder: number;
    visible: boolean;
    ownerCrmId?: string;
    createdAt?: any;
}

const emptyForm = {
    title: '',
    description: '',
    url: '',
    targetTeam: 'all' as ToolScope,
    toolType: 'sheet' as ToolType,
    sortOrder: 0,
    visible: true
};

export default function DailyToolsManager() {
    const { t } = useTranslation();
    const { profile, hasPermission, isSuperAdmin } = useAuth();
    const [tools, setTools] = useState<DailyTool[]>([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const canManage = hasPermission('managePolicies');
    const adminScope = (profile?.policyScope || 'all') as ToolScope;
    const scopeLocked = !isSuperAdmin && adminScope !== 'all';

    useEffect(() => {
        const q = query(collection(db, 'daily_tools'), orderBy('sortOrder', 'asc'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => {
            const list: DailyTool[] = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                list.push({
                    id: docSnap.id,
                    title: data.title || '',
                    description: data.description || '',
                    url: data.url || '',
                    targetTeam: data.targetTeam || 'all',
                    toolType: data.toolType || data.icon || 'sheet',
                    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
                    visible: data.visible !== false,
                    ownerCrmId: data.ownerCrmId || '',
                    createdAt: data.createdAt
                });
            });
            setTools(list);
            setLoading(false);
        }, (err) => {
            console.error('Failed to load daily tools:', err);
            setError(t('daily_tools_admin.load_error', '工具列表加载失败，请检查权限或网络。'));
            setLoading(false);
        });

        return () => unsub();
    }, [t]);

    useEffect(() => {
        if (scopeLocked) {
            setForm(prev => ({ ...prev, targetTeam: adminScope }));
        }
    }, [scopeLocked, adminScope]);

    const scopedTools = useMemo(() => {
        if (adminScope === 'all') return tools;
        return tools.filter(tool => tool.targetTeam === adminScope);
    }, [tools, adminScope]);

    const resetForm = () => {
        setEditingId(null);
        setForm({ ...emptyForm, targetTeam: scopeLocked ? adminScope : 'all' });
        setError('');
        setMessage('');
    };

    const validateUrl = (value: string) => {
        try {
            const url = new URL(value);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setMessage('');

        if (!canManage) {
            setError(t('daily_tools_admin.no_permission', '当前账号没有维护日常工具的权限。'));
            return;
        }
        if (!form.title.trim()) {
            setError(t('daily_tools_admin.title_required', '请输入工具名称。'));
            return;
        }
        if (!validateUrl(form.url.trim())) {
            setError(t('daily_tools_admin.url_required', '请输入有效的 http/https 在线链接。'));
            return;
        }
        if (scopeLocked && form.targetTeam !== adminScope) {
            setError(t('daily_tools_admin.scope_locked_error', '当前账号只能维护自己业务线的工具。'));
            return;
        }

        const payload = {
            title: form.title.trim(),
            description: form.description.trim(),
            url: form.url.trim(),
            targetTeam: scopeLocked ? adminScope : form.targetTeam,
            toolType: form.toolType,
            sortOrder: Number(form.sortOrder) || 0,
            visible: !!form.visible,
            ownerCrmId: profile?.crmId || '',
            updatedAt: serverTimestamp()
        };

        try {
            setSaving(true);
            if (editingId) {
                await updateDoc(doc(db, 'daily_tools', editingId), payload);
                setMessage(t('daily_tools_admin.update_success', '工具已更新。'));
            } else {
                await addDoc(collection(db, 'daily_tools'), {
                    ...payload,
                    createdAt: serverTimestamp()
                });
                setMessage(t('daily_tools_admin.create_success', '工具已发布。'));
            }
            resetForm();
        } catch (err: any) {
            console.error('Failed to save daily tool:', err);
            setError(err.message || t('daily_tools_admin.save_error', '保存失败，请检查权限或网络。'));
        } finally {
            setSaving(false);
        }
    };

    const editTool = (tool: DailyTool) => {
        setEditingId(tool.id);
        setForm({
            title: tool.title,
            description: tool.description || '',
            url: tool.url,
            targetTeam: tool.targetTeam,
            toolType: tool.toolType || 'sheet',
            sortOrder: tool.sortOrder || 0,
            visible: tool.visible !== false
        });
        setError('');
        setMessage('');
    };

    const toggleVisible = async (tool: DailyTool) => {
        if (scopeLocked && tool.targetTeam !== adminScope) return;
        await updateDoc(doc(db, 'daily_tools', tool.id), {
            visible: !tool.visible,
            updatedAt: serverTimestamp()
        });
    };

    const deleteTool = async (tool: DailyTool) => {
        if (scopeLocked && tool.targetTeam !== adminScope) return;
        if (!window.confirm(t('daily_tools_admin.delete_confirm', '确定删除这个工具链接吗？'))) return;
        await deleteDoc(doc(db, 'daily_tools', tool.id));
    };

    const getTeamLabel = (team: ToolScope) => {
        switch (team) {
            case 'all': return t('daily_tools_admin.scope_all', '全员可见');
            case 'KCC': return 'KCC';
            case 'GCC': return 'GCC';
            case 'Adult': return 'ACC';
            case 'SS': return 'SS';
            default: return team;
        }
    };

    const getToolTypeLabel = (type?: ToolType) => {
        switch (type) {
            case 'form': return t('daily_tools.type_form', '在线表单');
            case 'dashboard': return t('daily_tools.type_dashboard', '数据看板');
            case 'sop': return t('daily_tools.type_sop', 'SOP/文档');
            case 'system': return t('daily_tools.type_system', '外部系统');
            case 'other': return t('daily_tools.type_other', '其他工具');
            case 'sheet':
            default:
                return t('daily_tools.type_sheet', '在线表格');
        }
    };

    if (!canManage) {
        return (
            <div className="p-10 text-center">
                <Wrench className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h2 className="text-xl font-black text-slate-800">{t('daily_tools_admin.no_permission', '当前账号没有维护日常工具的权限。')}</h2>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-deep-teal/10 text-deep-teal text-[11px] font-black uppercase tracking-[0.16em]">
                        <Wrench className="w-3.5 h-3.5" />
                        {t('daily_tools_admin.badge', '日常工具')}
                    </span>
                    <h1 className="mt-3 text-3xl font-black text-deep-teal">{t('daily_tools_admin.title', '日常工具维护')}</h1>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                        {t('daily_tools_admin.subtitle', '维护销售常用的在线表格、SOP 链接和工作工具入口。')}
                    </p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-100 px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('daily_tools_admin.admin_scope', '维护范围')}</p>
                    <p className="text-sm font-black text-deep-teal">
                        {scopeLocked ? t('daily_tools_admin.scope_locked', '{{scope}} 专属运营', { scope: getTeamLabel(adminScope) }) : t('daily_tools_admin.scope_global', '全局 / 所有业务线')}
                    </p>
                </div>
            </div>

            {(message || error) && (
                <div className={`rounded-2xl px-4 py-3 text-sm font-bold border ${error ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                    {error || message}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-8">
                <form onSubmit={handleSubmit} className="rounded-3xl bg-white/85 border border-white shadow-sm p-6 space-y-4 h-fit">
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-desert-gold" />
                        {editingId ? t('daily_tools_admin.edit_tool', '编辑工具') : t('daily_tools_admin.new_tool', '新增工具')}
                    </h2>

                    <label className="block">
                        <span className="text-sm font-black text-deep-teal">{t('daily_tools_admin.form_title', '工具名称')}</span>
                        <input
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-desert-gold focus:ring-4 focus:ring-desert-gold/15 font-semibold"
                            placeholder={t('daily_tools_admin.title_placeholder', '如：每日销售跟进表')}
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-black text-deep-teal">{t('daily_tools_admin.form_url', '在线链接')}</span>
                        <input
                            value={form.url}
                            onChange={(e) => setForm({ ...form, url: e.target.value })}
                            className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-desert-gold focus:ring-4 focus:ring-desert-gold/15 font-semibold"
                            placeholder="https://..."
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-black text-deep-teal">{t('daily_tools_admin.tool_type', '工具类型')}</span>
                        <select
                            value={form.toolType}
                            onChange={(e) => setForm({ ...form, toolType: e.target.value as ToolType })}
                            className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-desert-gold focus:ring-4 focus:ring-desert-gold/15 font-bold bg-white"
                        >
                            <option value="sheet">{t('daily_tools.type_sheet', '在线表格')}</option>
                            <option value="form">{t('daily_tools.type_form', '在线表单')}</option>
                            <option value="dashboard">{t('daily_tools.type_dashboard', '数据看板')}</option>
                            <option value="sop">{t('daily_tools.type_sop', 'SOP/文档')}</option>
                            <option value="system">{t('daily_tools.type_system', '外部系统')}</option>
                            <option value="other">{t('daily_tools.type_other', '其他工具')}</option>
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-sm font-black text-deep-teal">{t('daily_tools_admin.form_desc', '说明')}</span>
                        <textarea
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            rows={3}
                            className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-desert-gold focus:ring-4 focus:ring-desert-gold/15 font-semibold resize-none"
                            placeholder={t('daily_tools_admin.desc_placeholder', '说明这个表格/工具的用途，方便销售判断是否需要打开。')}
                        />
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-sm font-black text-deep-teal">{t('daily_tools_admin.target_team', '可见业务线')}</span>
                            <select
                                value={form.targetTeam}
                                disabled={scopeLocked}
                                onChange={(e) => setForm({ ...form, targetTeam: e.target.value as ToolScope })}
                                className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-desert-gold focus:ring-4 focus:ring-desert-gold/15 font-bold bg-white disabled:bg-slate-100"
                            >
                                {!scopeLocked && <option value="all">{t('daily_tools_admin.scope_all', '全员可见')}</option>}
                                <option value="KCC">KCC</option>
                                <option value="GCC">GCC</option>
                                <option value="Adult">ACC Adult</option>
                                <option value="SS">SS</option>
                            </select>
                        </label>

                        <label className="block">
                            <span className="text-sm font-black text-deep-teal">{t('daily_tools_admin.sort_order', '排序')}</span>
                            <input
                                type="number"
                                value={form.sortOrder}
                                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                                className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-desert-gold focus:ring-4 focus:ring-desert-gold/15 font-semibold"
                            />
                        </label>
                    </div>

                    <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.visible}
                            onChange={(e) => setForm({ ...form, visible: e.target.checked })}
                            className="w-5 h-5 accent-deep-teal"
                        />
                        <span className="font-black text-slate-700">{t('daily_tools_admin.visible', '上架给销售可见')}</span>
                    </label>

                    <div className="flex gap-3">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 rounded-xl bg-deep-teal hover:bg-teal-800 text-white font-black py-3 flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? t('daily_tools_admin.saving', '保存中...') : t('daily_tools_admin.save', '保存工具')}
                        </button>
                        {editingId && (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-black hover:bg-slate-200 transition-all cursor-pointer"
                            >
                                {t('common.cancel', '取消')}
                            </button>
                        )}
                    </div>
                </form>

                <section className="rounded-3xl bg-white/85 border border-white shadow-sm p-6">
                    <div className="flex items-center justify-between gap-3 mb-5">
                        <div>
                            <h2 className="text-xl font-black text-slate-900">{t('daily_tools_admin.list_title', '已发布工具')}</h2>
                            <p className="text-xs font-semibold text-slate-500 mt-1">{t('daily_tools_admin.list_count', '{{count}} 个工具链接', { count: scopedTools.length })}</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-16 flex justify-center">
                            <div className="w-10 h-10 rounded-full border-4 border-deep-teal/20 border-b-deep-teal animate-spin" />
                        </div>
                    ) : scopedTools.length === 0 ? (
                        <div className="py-16 rounded-2xl bg-slate-50 text-center">
                            <LinkIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                            <p className="text-sm font-bold text-slate-500">{t('daily_tools_admin.empty', '暂无工具链接。')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {scopedTools.map(tool => (
                                <div key={tool.id} className="rounded-2xl border border-slate-100 bg-white p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[10px] font-black rounded-full bg-deep-teal/10 text-deep-teal px-2.5 py-1">{getTeamLabel(tool.targetTeam)}</span>
                                            <span className="text-[10px] font-black rounded-full bg-desert-gold/10 text-[#9b7415] px-2.5 py-1">{getToolTypeLabel(tool.toolType)}</span>
                                            <span className={`text-[10px] font-black rounded-full px-2.5 py-1 ${tool.visible ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {tool.visible ? t('daily_tools_admin.status_visible', '已上架') : t('daily_tools_admin.status_hidden', '已隐藏')}
                                            </span>
                                        </div>
                                        <h3 className="mt-2 text-base font-black text-slate-900 truncate">{tool.title}</h3>
                                        <p className="mt-1 text-xs font-semibold text-slate-500 truncate">{tool.url}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <a
                                            href={tool.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 transition-all"
                                            title={t('daily_tools_admin.open_link', '打开链接')}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                        <button onClick={() => toggleVisible(tool)} className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 transition-all cursor-pointer">
                                            {tool.visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => editTool(tool)} className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 transition-all cursor-pointer">
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => deleteTool(tool)} className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition-all cursor-pointer">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
