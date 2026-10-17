import React, { useState } from 'react';
import {
  Layers,
  GripVertical,
  Plus,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
  Wrench,
  RefreshCw,
  Database,
  Flame,
  FolderKanban,
  FolderOpen,
  Trash2,
  Search,
  X,
  Clock,
  Download,
  FolderPlus,
} from 'lucide-react';
import { AgentPreset, WorkflowTemplate, Workflow } from '../../types';
import { IconMapper } from '../Common/IconMapper';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

interface LeftSidebarProps {
  presets: AgentPreset[];
  templates: WorkflowTemplate[];
  myWorkflows?: Workflow[];
  currentWorkflowId?: string | null;
  onSelectTemplate: (templateId: string) => void;
  onAddAgentPreset: (preset: AgentPreset) => void;
  onSelectWorkflow?: (workflowId: string) => void;
  onDeleteWorkflow?: (workflowId: string) => void;
  onRefreshWorkflows?: () => void;
  onCreateNewWorkflow?: () => void;
  onSaveCurrentWorkflow?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const getTemplateMeta = (id: string) => {
  switch (id) {
    case 'fullstack_sdlc':
      return {
        icon: <Zap className="w-4 h-4" />,
        badge: 'SDLC',
        badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
        iconBg: 'bg-blue-600 text-white',
        border: 'border-blue-300 dark:border-blue-500/50 shadow-md dark:shadow-lg dark:shadow-blue-900/30',
        bg: 'bg-blue-50/70 dark:bg-gradient-to-b dark:from-[#182238] dark:to-[#121A2C]',
        btnPrimary: true,
      };
    case 'fast_feature':
      return {
        icon: <Zap className="w-4 h-4" />,
        badge: 'Feature',
        badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
        iconBg: 'bg-purple-600 text-white',
        border: 'border-gray-200 dark:border-gray-800 hover:border-purple-400',
        bg: 'bg-gray-50 dark:bg-[#131B2A]',
        btnPrimary: false,
      };
    case 'bug_hotfix':
      return {
        icon: <Flame className="w-4 h-4" />,
        badge: 'Hotfix',
        badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
        iconBg: 'bg-rose-600 text-white',
        border: 'border-gray-200 dark:border-gray-800 hover:border-rose-400',
        bg: 'bg-gray-50 dark:bg-[#131B2A]',
        btnPrimary: false,
      };
    case 'feature_update':
      return {
        icon: <RefreshCw className="w-4 h-4" />,
        badge: 'Feature Update',
        badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
        iconBg: 'bg-amber-600 text-white',
        border: 'border-gray-200 dark:border-gray-800 hover:border-amber-400',
        bg: 'bg-gray-50 dark:bg-[#131B2A]',
        btnPrimary: false,
      };
    case 'security_audit':
      return {
        icon: <ShieldAlert className="w-4 h-4" />,
        badge: 'Security Audit',
        badgeColor: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border-red-200 dark:border-red-500/30',
        iconBg: 'bg-red-600 text-white',
        border: 'border-gray-200 dark:border-gray-800 hover:border-red-400',
        bg: 'bg-gray-50 dark:bg-[#131B2A]',
        btnPrimary: false,
      };
    case 'code_review_refactor':
      return {
        icon: <Wrench className="w-4 h-4" />,
        badge: 'Review & Refactor',
        badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
        iconBg: 'bg-indigo-600 text-white',
        border: 'border-gray-200 dark:border-gray-800 hover:border-indigo-400',
        bg: 'bg-gray-50 dark:bg-[#131B2A]',
        btnPrimary: false,
      };
    case 'db_migration_audit':
      return {
        icon: <Database className="w-4 h-4" />,
        badge: 'DB Migration',
        badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
        iconBg: 'bg-emerald-600 text-white',
        border: 'border-gray-200 dark:border-gray-800 hover:border-emerald-400',
        bg: 'bg-gray-50 dark:bg-[#131B2A]',
        btnPrimary: false,
      };
    default:
      return {
        icon: <Layers className="w-4 h-4" />,
        badge: 'Pipeline',
        badgeColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
        iconBg: 'bg-blue-600 text-white',
        border: 'border-gray-200 dark:border-gray-800',
        bg: 'bg-gray-50 dark:bg-[#131B2A]',
        btnPrimary: false,
      };
  }
};

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  presets,
  templates,
  myWorkflows = [],
  currentWorkflowId = null,
  onSelectTemplate,
  onAddAgentPreset,
  onSelectWorkflow,
  onDeleteWorkflow,
  onRefreshWorkflows,
  onCreateNewWorkflow,
  onSaveCurrentWorkflow,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { t, language } = useThemeLanguage();
  const [activeTab, setActiveTab] = useState<'agents' | 'templates' | 'my_workflows'>('agents');
  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);
  const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleDragStart = (e: React.DragEvent, preset: AgentPreset) => {
    e.dataTransfer.setData('application/agent-preset', JSON.stringify(preset));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefreshWorkflows) {
      await onRefreshWorkflows();
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleExportWorkflowJson = (wf: Workflow) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(wf, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${(wf.name || 'workflow').toLowerCase().replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredWorkflows = myWorkflows.filter((w) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (w.name && w.name.toLowerCase().includes(q)) ||
      (w.description && w.description.toLowerCase().includes(q)) ||
      (w.id && w.id.toLowerCase().includes(q))
    );
  });

  if (isCollapsed) {
    return (
      <aside className="w-14 h-full bg-white dark:bg-[#0D131F] border-r border-gray-200 dark:border-gray-800 flex flex-col items-center py-3 z-20 shrink-0 select-none shadow-md transition-all duration-200">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition mb-2"
          title={t('expand_panel')}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Quick Tab Switcher Icons */}
        <div className="flex flex-col items-center gap-1.5 mb-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('agents');
              onToggleCollapse?.();
            }}
            className={`p-2 rounded-xl transition ${
              activeTab === 'agents'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={t('agent_library')}
          >
            <Sparkles className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('templates');
              onToggleCollapse?.();
            }}
            className={`p-2 rounded-xl transition ${
              activeTab === 'templates'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={t('workflow_templates', { count: templates.length })}
          >
            <Layers className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('my_workflows');
              onToggleCollapse?.();
            }}
            className={`relative p-2 rounded-xl transition ${
              activeTab === 'my_workflows'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={t('my_workflows_title')}
          >
            <FolderKanban className="w-4 h-4" />
            {myWorkflows.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {myWorkflows.length}
              </span>
            )}
          </button>
        </div>

        <div className="w-8 h-px bg-gray-200 dark:bg-gray-800 my-1" />

        <div className="flex-1 flex flex-col items-center gap-2 overflow-y-auto py-2 scrollbar-none">
          {presets.map((preset) => (
            <div
              key={preset.id}
              draggable
              onDragStart={(e) => handleDragStart(e, preset)}
              onClick={() => onAddAgentPreset(preset)}
              className="p-2 rounded-xl hover:scale-110 cursor-pointer transition shadow-xs border"
              style={{
                backgroundColor: `${preset.color_theme}15`,
                borderColor: `${preset.color_theme}40`,
                color: preset.color_theme,
              }}
              title={`${preset.role_name} - ${language === 'vi' ? 'Bấm hoặc kéo thả để thêm vào canvas' : 'Click or drag to add'}`}
            >
              <IconMapper name={preset.icon} className="w-4 h-4" />
            </div>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 h-full bg-white dark:bg-[#0D131F] border-r border-gray-200 dark:border-gray-800 flex flex-col z-20 shrink-0 select-none shadow-lg dark:shadow-2xl transition-colors duration-200">
      {/* Sidebar Header Tabs: 3 Tabs (Agents, Templates, My Workflows) */}
      <div className="p-2.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111827] flex items-center gap-1.5">
        <div className="flex-1 grid grid-cols-3 bg-gray-200 dark:bg-gray-900/90 p-1 rounded-xl border border-gray-300 dark:border-gray-800 gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab('agents')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg font-semibold transition truncate ${
              activeTab === 'agents'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-300/60 dark:hover:bg-gray-800'
            }`}
            title={t('agent_library')}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{language === 'vi' ? 'Thư viện' : 'Agents'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg font-semibold transition truncate ${
              activeTab === 'templates'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-300/60 dark:hover:bg-gray-800'
            }`}
            title={t('workflow_templates', { count: templates.length })}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{language === 'vi' ? 'Mẫu' : 'Templates'}</span>
            <span className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
              activeTab === 'templates' ? 'bg-white/20' : 'bg-gray-300 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}>
              {templates.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('my_workflows')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg font-semibold transition truncate ${
              activeTab === 'my_workflows'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-300/60 dark:hover:bg-gray-800'
            }`}
            title={t('my_workflows', { count: myWorkflows.length })}
          >
            <FolderKanban className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{language === 'vi' ? 'Của tôi' : 'Saved'}</span>
            {myWorkflows.length > 0 && (
              <span className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
                activeTab === 'my_workflows' ? 'bg-white/20' : 'bg-blue-500/20 text-blue-500 dark:text-blue-400'
              }`}>
                {myWorkflows.length}
              </span>
            )}
          </button>
        </div>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 transition shrink-0"
            title={t('collapse_panel')}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-800">
        {activeTab === 'agents' ? (
          /* ======================================================== */
          /* 1. ENTERPRISE AGENT PRESETS (DRAG & DROP) */
          /* ======================================================== */
          <div className="space-y-2.5">
            <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>{t('standard_enterprise_roles')}</span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">{t('drag_to_canvas')}</span>
            </div>

            {presets.map((preset) => {
              const isExpanded = expandedPresetId === preset.id;
              const coreFunction =
                language === 'vi'
                  ? preset.core_function_vi || preset.role_name
                  : preset.core_function_en || preset.role_name;

              return (
                <div
                  key={preset.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, preset)}
                  onClick={() => onAddAgentPreset(preset)}
                  className="group relative p-3 rounded-xl bg-gray-50 dark:bg-[#131B2A] border border-gray-200 dark:border-gray-800 hover:border-blue-500/80 hover:shadow-lg dark:hover:shadow-blue-900/30 transition-all cursor-pointer active:scale-[0.98]"
                  title={`${preset.role_name}\n• ${t('core_function_label')}: ${coreFunction}\n• ${t('hover_instruction')}`}
                >
                  {/* Left Color Accent Bar */}
                  <div
                    className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                    style={{ backgroundColor: preset.color_theme }}
                  />

                  <div className="pl-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="p-2 rounded-lg shrink-0 flex items-center justify-center border"
                        style={{
                          backgroundColor: `${preset.color_theme}15`,
                          borderColor: `${preset.color_theme}40`,
                          color: preset.color_theme,
                        }}
                      >
                        <IconMapper name={preset.icon} className="w-4 h-4" />
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-xs text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-300 transition">
                          {preset.role_name}
                        </div>
                        <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                          {t('allowed_paths_count', { count: preset.default_allowed_paths.length })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddAgentPreset(preset);
                        }}
                        className="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-blue-600 text-gray-700 dark:text-gray-400 hover:text-white transition shadow-sm"
                        title={t('click_to_add')}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <div className="text-gray-400 group-hover:text-gray-600 dark:text-gray-600 dark:group-hover:text-gray-400 p-1">
                        <GripVertical className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Core Function Highlights on Hover & Default */}
                  <div className="mt-2 pl-2 pr-1 py-1.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/25 border border-blue-200/60 dark:border-blue-900/40 text-[10.5px] leading-relaxed transition-all group-hover:border-blue-400/80 dark:group-hover:border-blue-700/60 group-hover:bg-blue-100/60 dark:group-hover:bg-blue-900/30">
                    <div className="flex items-center gap-1 font-bold text-blue-700 dark:text-blue-300 text-[10px]">
                      <Sparkles className="w-3 h-3 text-blue-500 shrink-0" />
                      <span>{t('core_function_label')}:</span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mt-0.5 line-clamp-2 font-normal">
                      {coreFunction}
                    </p>
                  </div>

                  {/* Allowed paths preview chips */}
                  <div className="mt-2 pl-2 flex flex-wrap gap-1">
                    {preset.default_allowed_paths.map((p, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-200/80 dark:bg-gray-900 text-gray-700 dark:text-gray-400 border border-gray-300 dark:border-gray-800 truncate max-w-[210px]"
                        title={p}
                      >
                        {p}
                      </span>
                    ))}
                  </div>

                  {/* Expand Prompt Details Toggle */}
                  <div className="mt-2 pl-2 pt-1 border-t border-gray-200 dark:border-gray-800/60 flex items-center justify-between text-[10px] text-gray-500">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedPresetId(isExpanded ? null : preset.id);
                      }}
                      className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-300"
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>{isExpanded ? t('hide_prompt') : t('view_scope_prompt')}</span>
                    </button>
                    <span className="font-mono text-[9px] text-gray-400 dark:text-gray-600">ID: {preset.id}</span>
                  </div>

                  {isExpanded && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 pl-2 text-[10px] text-gray-800 dark:text-gray-300 bg-gray-200/60 dark:bg-black/40 p-2 rounded border border-gray-300 dark:border-gray-800 font-mono whitespace-pre-wrap leading-relaxed animate-in fade-in duration-150"
                    >
                      {preset.default_system_prompt}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : activeTab === 'templates' ? (
          /* ======================================================== */
          /* 2. WORKFLOW TEMPLATES (1-CLICK CREATION) */
          /* ======================================================== */
          <div className="space-y-3">
            <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('enterprise_pipelines')}
            </div>

            {templates.map((tpl) => {
              const meta = getTemplateMeta(tpl.id);
              return (
                <div
                  key={tpl.id}
                  onClick={() => onSelectTemplate(tpl.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-lg active:scale-[0.98] ${meta.bg} ${meta.border}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${meta.iconBg}`}>
                        {meta.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-xs text-gray-900 dark:text-white leading-tight">
                            {tpl.name}
                          </h4>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${meta.badgeColor}`}>
                            {meta.badge}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                          {t('nodes_count', { nodes: tpl.nodes_count })} • {t('edges_count', { edges: tpl.edges_count })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2 line-clamp-3 leading-relaxed">
                    {tpl.description}
                  </p>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTemplate(tpl.id);
                    }}
                    className={`mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition transform active:scale-95 ${
                      meta.btnPrimary
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30'
                        : 'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <span>{t('load_template', { name: tpl.name })}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* ======================================================== */
          /* 3. MY WORKFLOWS (SAVED WORKFLOWS LIST & REUSE) */
          /* ======================================================== */
          <div className="space-y-3">
            {/* Action Bar: Search, Refresh, New */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-1.5 px-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t('my_workflows_title')}
                </span>
                <div className="flex items-center gap-1">
                  {onCreateNewWorkflow && (
                    <button
                      type="button"
                      onClick={onCreateNewWorkflow}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/40 border border-blue-200 dark:border-blue-700/50 transition"
                      title={t('new_blank_workflow')}
                    >
                      <Plus className="w-3 h-3" />
                      <span>{language === 'vi' ? 'Tạo mới' : 'New'}</span>
                    </button>
                  )}
                  {onRefreshWorkflows && (
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="p-1 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
                      title={t('refresh_workflows')}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('search_workflows_placeholder')}
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-[#131B2A] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* List or Empty State */}
            {filteredWorkflows.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-gray-50 dark:bg-[#131B2A] border border-dashed border-gray-300 dark:border-gray-800">
                <div className="w-10 h-10 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <h5 className="font-semibold text-xs text-gray-800 dark:text-gray-200 mb-1">
                  {searchQuery
                    ? language === 'vi' ? 'Không tìm thấy quy trình' : 'No matching workflows'
                    : t('no_saved_workflows')}
                </h5>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                  {searchQuery
                    ? language === 'vi' ? 'Thử tìm kiếm với từ khóa khác.' : 'Try a different search query.'
                    : t('no_saved_workflows_sub')}
                </p>
                {!searchQuery && onSaveCurrentWorkflow && (
                  <button
                    type="button"
                    onClick={onSaveCurrentWorkflow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/30 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('save_current_to_list')}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredWorkflows.map((wf) => {
                  const isActive = wf.id === currentWorkflowId;
                  const isExpanded = expandedWorkflowId === wf.id;
                  const nodesCount = wf.nodes_count ?? wf.nodes?.length ?? 0;
                  const edgesCount = wf.edges_count ?? wf.edges?.length ?? 0;
                  const dateStr = wf.updated_at || wf.created_at;
                  let formattedDate = '';
                  if (dateStr) {
                    try {
                      formattedDate = new Date(dateStr).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    } catch {
                      formattedDate = dateStr;
                    }
                  }

                  return (
                    <div
                      key={wf.id}
                      className={`group p-3 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-blue-50/60 dark:bg-gradient-to-b dark:from-[#182338] dark:to-[#121A2C] border-blue-400 dark:border-blue-500/60 shadow-md dark:shadow-lg dark:shadow-blue-900/30'
                          : 'bg-gray-50 dark:bg-[#131B2A] border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-700/60 hover:shadow-md'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`p-2 rounded-lg shrink-0 ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-800 text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            <FolderKanban className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-xs text-gray-900 dark:text-white truncate max-w-[170px]" title={wf.name}>
                                {wf.name}
                              </h4>
                              {isActive && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  {t('workflow_active_badge')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                              <span>{nodesCount} agents • {edgesCount} edges</span>
                              {formattedDate && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formattedDate}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description if present */}
                      {wf.description && (
                        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                          {wf.description}
                        </p>
                      )}

                      {/* Expand details for nodes if loaded */}
                      {wf.nodes && wf.nodes.length > 0 && (
                        <div className="mt-2 pt-1 border-t border-gray-200 dark:border-gray-800/60">
                          <button
                            type="button"
                            onClick={() => setExpandedWorkflowId(isExpanded ? null : wf.id)}
                            className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
                          >
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            <span>{isExpanded ? t('hide_nodes_detail') : t('view_nodes_detail', { count: wf.nodes.length })}</span>
                          </button>

                          {isExpanded && (
                            <div className="mt-2 space-y-1 pl-1 max-h-36 overflow-y-auto scrollbar-thin">
                              {wf.nodes.map((node, nIdx) => (
                                <div
                                  key={node.id || nIdx}
                                  className="flex items-center gap-1.5 p-1 rounded bg-gray-200/50 dark:bg-gray-900/60 text-[10px]"
                                >
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: node.color_theme || '#3b82f6' }}
                                  />
                                  <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                                    {node.role_name}
                                  </span>
                                  {node.allowed_paths && node.allowed_paths.length > 0 && (
                                    <span className="text-[9px] font-mono text-gray-500 ml-auto truncate max-w-[120px]">
                                      {node.allowed_paths[0]}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Buttons: Open, Export, Delete */}
                      <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-gray-200/80 dark:border-gray-800/80">
                        {onSelectWorkflow && (
                          <button
                            type="button"
                            onClick={() => onSelectWorkflow(wf.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition ${
                              isActive
                                ? 'bg-blue-600/10 text-blue-600 dark:text-blue-300 border border-blue-400/40 hover:bg-blue-600 hover:text-white'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs shadow-blue-600/30'
                            }`}
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>{t('load_workflow')}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleExportWorkflowJson(wf)}
                          className="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition"
                          title={t('export_json_tooltip')}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {onDeleteWorkflow && (
                          <button
                            type="button"
                            onClick={() => onDeleteWorkflow(wf.id)}
                            className="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-rose-500 hover:text-white text-gray-600 dark:text-gray-400 transition"
                            title={t('delete_workflow')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar Footer with Copyright (ONLY PLACE RETAINED) */}
      <div className="p-3 bg-gray-50 dark:bg-[#0B0F19] border-t border-gray-200 dark:border-gray-800 text-center">
        <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
          {t('sidebar_version')}
        </div>
        <div className="text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-400/90 mt-0.5">
          Copyright by phamanh.bac
        </div>
      </div>
    </aside>
  );
};
