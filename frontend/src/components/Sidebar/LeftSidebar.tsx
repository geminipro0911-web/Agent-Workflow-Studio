import React, { useState } from 'react';
import {
  Layers,
  GripVertical,
  Plus,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronRight,
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
            <span>{t('workflow_templates')}</span>
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
                  className="group relative p-3 rounded-xl bg-gray-50 dark:bg-[#131B2A] border border-gray-200 dark:border-gray-800 hover:border-blue-500/60 hover:shadow-md dark:hover:shadow-blue-900/20 transition-all cursor-grab active:cursor-grabbing"
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
                        className="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-blue-600 text-gray-700 dark:text-gray-400 hover:text-white transition"
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
                      onClick={() => setExpandedPresetId(isExpanded ? null : preset.id)}
                      className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-300"
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>{isExpanded ? t('hide_prompt') : t('view_scope_prompt')}</span>
                    </button>
                    <span className="font-mono text-[9px] text-gray-400 dark:text-gray-600">ID: {preset.id}</span>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 pl-2 text-[10px] text-gray-800 dark:text-gray-300 bg-gray-200/60 dark:bg-black/40 p-2 rounded border border-gray-300 dark:border-gray-800 font-mono whitespace-pre-wrap leading-relaxed animate-in fade-in duration-150">
                      {preset.default_system_prompt}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ======================================================== */
          /* 3 WORKFLOW TEMPLATES (1-CLICK CREATION) */
          /* ======================================================== */
          <div className="space-y-3">
            <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('enterprise_pipelines')}
            </div>

            {templates.map((tpl) => {
              const isSDLC = tpl.id === 'fullstack_sdlc';
              const isFast = tpl.id === 'fast_feature';
              return (
                <div
                  key={tpl.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isSDLC
                      ? 'bg-blue-50 dark:bg-gradient-to-b dark:from-[#182238] dark:to-[#121A2C] border-blue-300 dark:border-blue-500/50 shadow-md dark:shadow-lg dark:shadow-blue-900/30'
                      : 'bg-gray-50 dark:bg-[#131B2A] border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-2 rounded-lg ${
                          isSDLC
                            ? 'bg-blue-600 text-white'
                            : isFast
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-600/30 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-600/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40'
                        }`}
                      >
                        {isSDLC ? <Zap className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-gray-900 dark:text-white leading-tight">{tpl.name}</h4>
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
                    onClick={() => onSelectTemplate(tpl.id)}
                    className={`mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition transform active:scale-95 ${
                      isSDLC
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
