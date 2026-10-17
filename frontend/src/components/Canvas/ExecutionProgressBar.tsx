import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Zap,
} from 'lucide-react';
import { Node } from '@xyflow/react';
import { AgentNodeData } from './AgentNode';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

interface ExecutionProgressBarProps {
  isExecuting: boolean;
  executionId: string | null;
  nodes: Node[];
  onSelectNode: (nodeId: string) => void;
  selectedNodeId: string | null;
}

export const ExecutionProgressBar: React.FC<ExecutionProgressBarProps> = ({
  isExecuting,
  executionId,
  nodes,
  onSelectNode,
  selectedNodeId,
}) => {
  const { t } = useThemeLanguage();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  // Timer while executing
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isExecuting) {
      interval = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (executionId === null) {
        setElapsedSeconds(0);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isExecuting, executionId]);

  if (!executionId && !isExecuting) return null;

  const totalNodes = nodes.length;
  const completedNodes = nodes.filter((n) => (n.data as AgentNodeData)?.status === 'completed').length;
  const runningNodes = nodes.filter((n) => (n.data as AgentNodeData)?.status === 'running').length;
  const violationNodes = nodes.filter((n) => (n.data as AgentNodeData)?.status === 'violation_paused').length;
  const approvalNodes = nodes.filter((n) => (n.data as AgentNodeData)?.status === 'waiting_approval').length;
  const failedNodes = nodes.filter((n) => (n.data as AgentNodeData)?.status === 'failed').length;

  const percent = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    if (violationNodes > 0) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white animate-pulse shadow-sm shadow-rose-500/40">
          <AlertTriangle className="w-3 h-3" />
          <span>VIOLATION PAUSED</span>
        </span>
      );
    }
    if (approvalNodes > 0) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black animate-pulse shadow-sm shadow-amber-500/40">
          <UserCheck className="w-3 h-3" />
          <span>NEEDS APPROVAL</span>
        </span>
      );
    }
    if (failedNodes > 0) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-700 text-white">
          <XCircle className="w-3 h-3" />
          <span>FAILED</span>
        </span>
      );
    }
    if (isExecuting) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-sm shadow-blue-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping" />
          <span>RUNNING ({runningNodes})</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
        <CheckCircle2 className="w-3 h-3" />
        <span>COMPLETED</span>
      </span>
    );
  };

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-xl w-[92%] transition-all animate-in fade-in duration-200">
      <div className="bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border border-gray-300 dark:border-gray-800 rounded-2xl shadow-xl p-3 flex flex-col gap-2">
        {/* Top summary row */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>{t('execution_hud_title')}</span>
                {getStatusBadge()}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                Session: {executionId ? executionId.slice(-12) : 'Active'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer */}
            <div className="flex items-center gap-1 text-[11px] font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">
              <Clock className="w-3 h-3 text-indigo-500" />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>

            {/* Nodes completed text */}
            <span className="font-bold font-mono text-blue-600 dark:text-blue-400 text-xs">
              {percent}% ({completedNodes}/{totalNodes})
            </span>

            {/* Minimize toggle */}
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title={isMinimized ? t('expand_panel') : t('collapse_panel')}
            >
              {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              violationNodes > 0
                ? 'bg-gradient-to-r from-red-500 to-amber-500 animate-pulse'
                : percent === 100
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Step Chain Pills (Hidden when minimized) */}
        {!isMinimized && (
          <div className="flex items-center gap-1.5 pt-1 overflow-x-auto scrollbar-none">
            {nodes.map((node) => {
              const d = node.data as AgentNodeData;
              const isSelected = selectedNodeId === node.id;
              const status = d.status || 'idle';

              let statusColor = 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800/80 dark:text-gray-400 dark:border-gray-700';
              let dotColor = 'bg-gray-400';

              if (status === 'completed') {
                statusColor = 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60';
                dotColor = 'bg-emerald-500';
              } else if (status === 'running') {
                statusColor = 'bg-blue-50 text-blue-800 border-blue-400 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-600 ring-2 ring-blue-400/40';
                dotColor = 'bg-blue-500 animate-ping';
              } else if (status === 'violation_paused') {
                statusColor = 'bg-rose-50 text-rose-800 border-rose-400 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-600 ring-2 ring-rose-400/50';
                dotColor = 'bg-rose-500 animate-bounce';
              } else if (status === 'waiting_approval') {
                statusColor = 'bg-amber-50 text-amber-800 border-amber-400 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-600';
                dotColor = 'bg-amber-500';
              } else if (status === 'failed') {
                statusColor = 'bg-red-50 text-red-800 border-red-400 dark:bg-red-950/60 dark:text-red-300 dark:border-red-600';
                dotColor = 'bg-red-600';
              }

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition shrink-0 ${statusColor} ${
                    isSelected ? 'ring-2 ring-blue-500 font-bold' : ''
                  }`}
                  title={`${d.role_name} (${status.toUpperCase()}) - Click to inspect`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                  <span className="truncate max-w-[100px]">{d.role_name || node.id}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
