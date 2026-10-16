import React, { useState } from 'react';
import {
  Layers,
  GripVertical,
  Plus,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Wrench,
  RefreshCw,
  Database,
  Flame,
} from 'lucide-react';
import { AgentPreset, WorkflowTemplate } from '../../types';
import { IconMapper } from '../Common/IconMapper';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

interface LeftSidebarProps {
  presets: AgentPreset[];
  templates: WorkflowTemplate[];
  onSelectTemplate: (templateId: string) => void;
  onAddAgentPreset: (preset: AgentPreset) => void;
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
  onSelectTemplate,
  onAddAgentPreset,
}) => {
  const { t } = useThemeLanguage();
  const [activeTab, setActiveTab] = useState<'agents' | 'templates'>('agents');
  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, preset: AgentPreset) => {
    e.dataTransfer.setData('application/agent-preset', JSON.stringify(preset));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-80 h-full bg-white dark:bg-[#0D131F] border-r border-gray-200 dark:border-gray-800 flex flex-col z-20 shrink-0 select-none shadow-lg dark:shadow-2xl transition-colors duration-200">
      {/* Sidebar Header Tabs */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111827]">
        <div className="flex bg-gray-200 dark:bg-gray-900/90 p-1 rounded-xl border border-gray-300 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab('agents')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'agents'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-300/60 dark:hover:bg-gray-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('agent_library')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'templates'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-300/60 dark:hover:bg-gray-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('workflow_templates', { count: templates.length })}</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-800">
        {activeTab === 'agents' ? (
          /* ======================================================== */
          /* 7 ENTERPRISE AGENT PRESETS (DRAG & DROP) */
          /* ======================================================== */
          <div className="space-y-2.5">
            <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>{t('standard_enterprise_roles')}</span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">{t('drag_to_canvas')}</span>
            </div>

            {presets.map((preset) => {
              const isExpanded = expandedPresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, preset)}
                  onClick={() => onAddAgentPreset(preset)}
                  className="group relative p-3 rounded-xl bg-gray-50 dark:bg-[#131B2A] border border-gray-200 dark:border-gray-800 hover:border-blue-500/80 hover:shadow-lg dark:hover:shadow-blue-900/30 transition-all cursor-pointer active:scale-[0.98]"
                  title={t('click_to_add')}
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

                  {/* Allowed paths preview chips */}
                  <div className="mt-2.5 pl-2 flex flex-wrap gap-1">
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
        ) : (
          /* ======================================================== */
          /* 7 WORKFLOW TEMPLATES (1-CLICK CREATION) */
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
