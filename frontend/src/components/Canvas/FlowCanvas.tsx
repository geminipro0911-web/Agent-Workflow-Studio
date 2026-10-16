import React, { useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { AgentNode } from './AgentNode';
import { AgentPreset, ViolationData } from '../../types';
import { Sparkles, Layers, ShieldAlert, Wrench, RefreshCw, Database, Flame, Zap } from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

const nodeTypes = {
  agentNode: AgentNode,
};

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeClick: (nodeId: string) => void;
  onOpenViolationModal: (violation: ViolationData) => void;
  onAddAgentPreset: (preset: AgentPreset, position: { x: number; y: number }) => void;
  onLoadTemplate: (templateId: string) => void;
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onOpenViolationModal,
  onAddAgentPreset,
  onLoadTemplate,
}) => {
  const { theme, t } = useThemeLanguage();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Expose global fitView helper for Playwright and automated testing
  useEffect(() => {
    (window as any).__fitView = () => {
      fitView({ padding: 0.25, duration: 300 });
    };
  }, [fitView]);

  // Auto-fit whenever nodes load or change count
  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.25, duration: 350 });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  const flowNodes = useMemo(() => {
    return nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onOpenViolationModal,
      },
    }));
  }, [nodes, onOpenViolationModal]);

  const flowEdges = useMemo(() => {
    return edges.map((e) => ({
      ...e,
      animated: true,
      style: {
        stroke: theme === 'dark' ? '#4B5563' : '#94A3B8',
        strokeWidth: 2,
        ...e.style,
      },
    }));
  }, [edges, theme]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const presetDataString = event.dataTransfer.getData('application/agent-preset');
      if (!presetDataString) return;

      try {
        const preset: AgentPreset = JSON.parse(presetDataString);
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        onAddAgentPreset(preset, position);
      } catch (err) {
        console.error('Failed to parse dropped preset:', err);
      }
    },
    [screenToFlowPosition, onAddAgentPreset]
  );

  return (
    <div ref={reactFlowWrapper} className="relative w-full h-full bg-slate-100 dark:bg-[#090D16] select-none transition-colors duration-200">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#3B82F6', strokeWidth: 2 },
        }}
        className="touch-none"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color={theme === 'dark' ? '#1F2937' : '#CBD5E1'}
          className="opacity-70"
        />

        <Controls className="!bg-white dark:!bg-[#111827] !border !border-gray-300 dark:!border-gray-800 !rounded-xl !shadow-lg dark:!shadow-2xl [&>button]:!bg-gray-100 dark:[&>button]:!bg-[#1F2937] [&>button]:!border-gray-300 dark:[&>button]:!border-gray-700 [&>button]:!text-gray-700 dark:[&>button]:!text-gray-200 hover:[&>button]:!bg-gray-200 dark:hover:[&>button]:!bg-[#374151]" />

        <MiniMap
          nodeColor={(node) => {
            const data = node.data as any;
            if (data?.status === 'violation_paused') return '#EF4444';
            if (data?.status === 'running') return '#3B82F6';
            if (data?.status === 'completed') return '#10B981';
            return data?.color_theme || '#4B5563';
          }}
          maskColor={theme === 'dark' ? 'rgba(11, 15, 25, 0.75)' : 'rgba(240, 244, 248, 0.75)'}
          className="!bg-white dark:!bg-[#111827] !border !border-gray-300 dark:!border-gray-800 !rounded-xl !overflow-hidden !shadow-lg dark:!shadow-2xl"
          zoomable
          pannable
        />
      </ReactFlow>

      {/* Empty State Overlay */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div className="max-w-md p-8 rounded-2xl bg-white/90 dark:bg-[#111827]/90 border border-gray-200 dark:border-gray-700/80 shadow-xl dark:shadow-2xl backdrop-blur-md space-y-4 pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/10 dark:bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Sparkles className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('drag_drop_guide_title')}</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {t('drag_drop_guide_desc')}
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => onLoadTemplate('fullstack_sdlc')}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/30 transition transform active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Full-Stack SDLC Pipeline</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 font-mono">7 Agents</span>
              </button>

              <button
                type="button"
                onClick={() => onLoadTemplate('feature_update')}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 transition transform active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                  <span>Feature Enhancement</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 font-mono">5 Agents</span>
              </button>

              <button
                type="button"
                onClick={() => onLoadTemplate('code_review_refactor')}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 transition transform active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Review & Refactor</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-mono">5 Agents</span>
              </button>

              <button
                type="button"
                onClick={() => onLoadTemplate('security_audit')}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 transition transform active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  <span>Security & Compliance</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 font-mono">3 Agents</span>
              </button>

              <button
                type="button"
                onClick={() => onLoadTemplate('fast_feature')}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 transition transform active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-purple-500" />
                  <span>Fast Feature Pipeline</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 font-mono">4 Agents</span>
              </button>

              <button
                type="button"
                onClick={() => onLoadTemplate('db_migration_audit')}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 transition transform active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Database Migration</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-mono">3 Agents</span>
              </button>

              <button
                type="button"
                onClick={() => onLoadTemplate('bug_hotfix')}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 transition transform active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                  <span>Bug Hotfix Pipeline</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 font-mono">3 Agents</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
