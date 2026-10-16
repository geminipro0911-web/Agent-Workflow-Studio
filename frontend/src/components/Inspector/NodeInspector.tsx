import React, { useState } from 'react';
import {
  Sliders,
  FolderLock,
  Trash2,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { Node } from '@xyflow/react';
import { AgentNodeData } from '../Canvas/AgentNode';
import { IconMapper } from '../Common/IconMapper';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

interface NodeInspectorProps {
  selectedNode: Node | null;
  onUpdateNodeData: (nodeId: string, updatedData: Partial<AgentNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  onSimulateViolation: (nodeId: string, nodeData: AgentNodeData) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  selectedNode,
  onUpdateNodeData,
  onDeleteNode,
  onSimulateViolation,
}) => {
  const { t } = useThemeLanguage();
  const [newPathInput, setNewPathInput] = useState('');

  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-500 bg-white dark:bg-[#0D131F] transition-colors duration-200">
        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/60 flex items-center justify-center text-gray-400 mb-3">
          <Sliders className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-300">{t('no_node_selected_title')}</h4>
        <p className="text-xs text-gray-500 mt-1 max-w-[220px]">
          {t('no_node_selected_desc')}
        </p>
      </div>
    );
  }

  const data = selectedNode.data as AgentNodeData;
  const allowedPaths = data.allowed_paths || [];

  const handleAddPath = () => {
    const trimmed = newPathInput.trim();
    if (trimmed && !allowedPaths.includes(trimmed)) {
      onUpdateNodeData(selectedNode.id, {
        allowed_paths: [...allowedPaths, trimmed],
      });
      setNewPathInput('');
    }
  };

  const handleRemovePath = (pathToRemove: string) => {
    onUpdateNodeData(selectedNode.id, {
      allowed_paths: allowedPaths.filter((p) => p !== pathToRemove),
    });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0D131F] text-gray-800 dark:text-gray-200 select-none transition-colors duration-200">
      {/* Inspector Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111827] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="p-2 rounded-lg border flex items-center justify-center"
            style={{
              backgroundColor: `${data.color_theme || '#3b82f6'}1a`,
              borderColor: `${data.color_theme || '#3b82f6'}4d`,
              color: data.color_theme || '#3b82f6',
            }}
          >
            <IconMapper name={data.icon || 'Bot'} className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[170px]">
              {data.role_name || 'Agent Config'}
            </h3>
            <span className="text-[10px] font-mono text-gray-400">ID: {selectedNode.id}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDeleteNode(selectedNode.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
          title="Delete Node from Canvas"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Inspector Form Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-800">
        {/* Role Name */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
            {t('agent_role_name')}
          </label>
          <input
            type="text"
            value={data.role_name || ''}
            onChange={(e) => onUpdateNodeData(selectedNode.id, { role_name: e.target.value })}
            className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
          />
        </div>

        {/* Task Prompt */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              {t('task_prompt')}
            </label>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">DAG Step</span>
          </div>
          <textarea
            rows={3}
            value={data.task_prompt || ''}
            onChange={(e) => onUpdateNodeData(selectedNode.id, { task_prompt: e.target.value })}
            placeholder={t('task_prompt_placeholder')}
            className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500 font-mono leading-relaxed resize-none"
          />
        </div>

        {/* System Prompt */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
            {t('system_prompt')}
          </label>
          <textarea
            rows={5}
            value={data.system_prompt || ''}
            onChange={(e) => onUpdateNodeData(selectedNode.id, { system_prompt: e.target.value })}
            placeholder={t('system_prompt_placeholder')}
            className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:border-blue-500 font-mono text-[11px] leading-relaxed resize-none"
          />
        </div>

        {/* Allowed Paths Tag Manager */}
        <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <FolderLock className="w-3.5 h-3.5" />
              <span>{t('allowed_paths_box')}</span>
            </label>
            <span className="text-[10px] text-gray-500 font-mono">{t('paths_locked_count', { count: allowedPaths.length })}</span>
          </div>

          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
            {t('allowed_paths_info')}
          </p>

          {/* Tags List */}
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
            {allowedPaths.map((path) => (
              <span
                key={path}
                className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 group"
              >
                <span>{path}</span>
                <button
                  type="button"
                  onClick={() => handleRemovePath(path)}
                  className="text-emerald-600 hover:text-rose-500 dark:text-emerald-500 dark:hover:text-rose-400 transition"
                  title="Remove path"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          {/* Add Tag Input */}
          <div className="flex gap-1.5 pt-1">
            <input
              type="text"
              value={newPathInput}
              onChange={(e) => setNewPathInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddPath();
                }
              }}
              placeholder={t('add_path_placeholder')}
              className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-black/40 border border-gray-300 dark:border-gray-700 rounded text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="button"
              onClick={handleAddPath}
              className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition"
            >
              {t('add_btn')}
            </button>
          </div>
        </div>

        {/* Pre-Execution Approval Gate */}
        <div className="p-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!data.require_human_approval}
              onChange={(e) =>
                onUpdateNodeData(selectedNode.id, { require_human_approval: e.target.checked })
              }
              className="w-4 h-4 rounded text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:ring-0"
            />
            <span className="text-xs font-medium text-gray-800 dark:text-gray-300">
              {t('require_approval_label')}
            </span>
          </label>
          <p className="text-[10px] text-gray-500 pl-6 leading-tight">
            {t('require_approval_desc')}
          </p>
        </div>

        {/* ======================================================== */}
        {/* SIMULATE SCOPE VIOLATION SECTION */}
        {/* ======================================================== */}
        <div className="p-3.5 bg-red-50/70 dark:bg-gradient-to-b dark:from-red-950/40 dark:to-amber-950/20 border border-red-200 dark:border-red-700/60 rounded-xl space-y-2.5 shadow-inner">
          <div className="flex items-center justify-between text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{t('simulate_violation_title')}</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 font-mono">
              {t('simulate_violation_badge')}
            </span>
          </div>

          <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed">
            {t('simulate_violation_desc')}
          </p>

          {/* Toggle Flag in Node */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={!!data.simulate_violation}
              onChange={(e) =>
                onUpdateNodeData(selectedNode.id, { simulate_violation: e.target.checked })
              }
              className="w-4 h-4 rounded text-red-600 bg-gray-100 dark:bg-gray-800 border-red-300 dark:border-red-700 focus:ring-0"
            />
            <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
              {t('enable_violation_flag')}
            </span>
          </label>

          {/* Instant Trigger Test Button */}
          <button
            type="button"
            onClick={() => onSimulateViolation(selectedNode.id, data)}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-md shadow-red-900/30 border border-red-400/30 transition transform active:scale-95"
            title="Pop up Git Violation Alert Modal and set node to VIOLATION_PAUSED instantly"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{t('trigger_alert_btn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
