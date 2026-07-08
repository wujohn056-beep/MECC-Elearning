import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FileSpreadsheet, Link as LinkIcon, Search, ShieldCheck, Wrench } from 'lucide-react';
import { db } from '../services/firebase';
import { getUserTeam, useAuth } from '../contexts/AuthContext';

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
    updatedAt?: any;
}

const teamLabels: Record<ToolScope, string> = {
    all: 'All',
    KCC: 'KCC',
    GCC: 'GCC',
    Adult: 'ACC',
    SS: 'SS'
};

export default function DailyToolsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { profile, userTeam } = useAuth();
    const [tools, setTools] = useState<DailyTool[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const activeTeam = useMemo<ToolScope>(() => {
        const derived = getUserTeam(profile) || userTeam;
        if (derived === 'KCC' || derived === 'GCC' || derived === 'Adult' || derived === 'SS') return derived;
        return 'KCC';
    }, [profile, userTeam]);

    useEffect(() => {
        const q = query(collection(db, 'daily_tools'), orderBy('sortOrder', 'asc'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => {
            const list: DailyTool[] = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.visible === false) return;
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
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt
                });
            });
            setTools(list);
            setLoading(false);
        }, (error) => {
            console.error('Failed to load daily tools:', error);
            setLoading(false);
        });

        return () => unsub();
    }, []);

    const visibleTools = useMemo(() => {
        const q = search.trim().toLowerCase();
        return tools
            .filter(tool => tool.targetTeam === 'all' || tool.targetTeam === activeTeam)
            .filter(tool => {
                if (!q) return true;
                return `${tool.title} ${tool.description || ''}`.toLowerCase().includes(q);
            });
    }, [tools, activeTeam, search]);

    const openTool = (tool: DailyTool) => {
        if (!tool.url) return;
        window.open(tool.url, '_blank', 'noopener,noreferrer');
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

    const getToolTypeIcon = (type?: ToolType) => {
        switch (type) {
            case 'dashboard': return '📊';
            case 'form': return '📝';
            case 'sop': return '📘';
            case 'system': return '🔗';
            case 'other': return '🧰';
            case 'sheet':
            default:
                return '📋';
        }
    };

    const getToolHost = (url: string) => {
        try {
            return new URL(url).hostname;
        } catch {
            return url || t('daily_tools.online_link', '在线链接');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/hub')}
                        className="p-2.5 bg-white/80 hover:bg-white rounded-xl border border-gray-200/60 shadow-sm transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
                        title={t('daily_tools.back_to_hub', '返回学习中心')}
                    >
                        <ArrowLeft className="h-5 w-5 text-deep-teal" />
                    </button>
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-deep-teal/10 text-deep-teal px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]">
                            <Wrench className="w-3.5 h-3.5" />
                            {t('daily_tools.badge', '日常工具')}
                        </div>
                        <h1 className="mt-2 text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-deep-teal to-teal-800 tracking-tight">
                            {t('daily_tools.title', '日常工具中心')}
                        </h1>
                        <p className="mt-1 text-sm font-semibold text-arabian-night/60">
                            {t('daily_tools.subtitle', '运营维护的在线表格、工作链接和常用工具入口。')}
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl bg-white/60 backdrop-blur-md border border-white/70 px-4 py-3 shadow-sm flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-desert-gold" />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('daily_tools.visible_scope', '当前可见范围')}</p>
                        <p className="text-sm font-black text-deep-teal">{teamLabels[activeTeam]} + {t('daily_tools.global_tools', '全员工具')}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5">
                <section className="rounded-3xl border border-white/70 bg-white/65 backdrop-blur-xl p-5 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                        <div>
                            <h2 className="text-xl font-black text-slate-900">{t('daily_tools.available_tools', '可用工具')}</h2>
                            <p className="text-xs font-semibold text-slate-500 mt-1">
                                {t('daily_tools.available_count', '{{count}} 个链接工具', { count: visibleTools.length })}
                            </p>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t('daily_tools.search_placeholder', '搜索表格、工具或说明...')}
                                className="w-full ps-10 pe-4 py-3 rounded-2xl border border-slate-200 bg-white/80 text-sm font-semibold outline-none focus:border-desert-gold focus:ring-4 focus:ring-desert-gold/15"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-20 flex justify-center">
                            <div className="w-10 h-10 rounded-full border-4 border-deep-teal/20 border-b-deep-teal animate-spin" />
                        </div>
                    ) : visibleTools.length === 0 ? (
                        <div className="py-20 text-center rounded-3xl bg-slate-50/70 border border-slate-100">
                            <FileSpreadsheet className="w-14 h-14 mx-auto text-slate-300 mb-3" />
                            <h3 className="text-lg font-black text-slate-700">{t('daily_tools.empty_title', '暂无可用工具')}</h3>
                            <p className="text-sm text-slate-500 mt-1">{t('daily_tools.empty_desc', '运营还没有为当前业务线发布日常工具链接。')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {visibleTools.map(tool => (
                                <button
                                    key={tool.id}
                                    onClick={() => openTool(tool)}
                                    className="group text-left rounded-2xl border border-slate-100 bg-white hover:border-desert-gold/45 hover:shadow-lg hover:-translate-y-0.5 transition-all p-5 cursor-pointer"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-deep-teal to-teal-700 text-white flex items-center justify-center shadow-md shrink-0">
                                            <span className="text-xl">{getToolTypeIcon(tool.toolType)}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-desert-gold/10 text-[#9b7415]">
                                                    {tool.targetTeam === 'all' ? t('daily_tools.global_tools', '全员工具') : teamLabels[tool.targetTeam]}
                                                </span>
                                                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                                                    {getToolTypeLabel(tool.toolType)}
                                                </span>
                                            </div>
                                            <h3 className="mt-3 text-lg font-black text-slate-900 leading-snug group-hover:text-deep-teal transition-colors line-clamp-2">
                                                {tool.title}
                                            </h3>
                                            {tool.description && (
                                                <p className="mt-2 text-sm font-medium text-slate-500 leading-relaxed line-clamp-3">
                                                    {tool.description}
                                                </p>
                                            )}
                                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                                                <span className="text-xs font-bold text-slate-400 truncate flex items-center gap-1.5">
                                                    <LinkIcon className="w-3.5 h-3.5" />
                                                    {getToolHost(tool.url)}
                                                </span>
                                                <span className="text-sm font-black text-deep-teal inline-flex items-center gap-1">
                                                    {t('daily_tools.open_tool', '打开工具')}
                                                    <ExternalLink className="w-4 h-4" />
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <aside className="rounded-3xl border border-white/70 bg-gradient-to-br from-deep-teal to-teal-800 text-white p-6 shadow-lg h-fit">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-desert-gold">{t('daily_tools.operator_note_badge', '运营维护')}</p>
                    <h2 className="mt-2 text-2xl font-black leading-tight">{t('daily_tools.operator_note_title', '常用链接统一入口')}</h2>
                    <p className="mt-3 text-sm text-white/75 leading-relaxed">
                        {t('daily_tools.operator_note_desc', '这里适合放排班表、数据表、SOP 检查表、活动登记表等在线工具。销售只需要点击即可进入原链接。')}
                    </p>
                </aside>
            </div>
        </div>
    );
}
