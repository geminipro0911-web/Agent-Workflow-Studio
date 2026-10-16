import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Trash2,
  Copy,
  Check,
  Circle,
  ArrowDownCircle,
} from 'lucide-react';
import { TerminalLog } from '../../types';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

interface LiveTerminalProps {
  logs: TerminalLog[];
  isConnected: boolean;
  onClearLogs: () => void;
}

export const LiveTerminal: React.FC<LiveTerminalProps> = ({
  logs,
  isConnected,
  onClearLogs,
}) => {
  const { t } = useThemeLanguage();
  const [filterNode, setFilterNode] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Unique node list from logs
  const nodeOptions = Array.from(new Set(logs.map((l) => l.node_id).filter(Boolean)));

  const filteredLogs = logs.filter((log) => {
    if (filterNode === 'all') return true;
    return log.node_id === filterNode;
  });

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.node_id || 'SYSTEM'}] [${l.stream_type}]: ${l.chunk}`)
      .join('');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-200 font-mono text-xs select-none border-t border-gray-300 dark:border-gray-800 transition-colors duration-200">
      {/* Terminal Toolbar */}
      <div className="px-4 py-2 bg-gray-950/80 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <TerminalIcon className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-gray-200">{t('terminal_title')}</span>
          </div>

          {/* Connection status indicator */}
          <div className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-gray-900 border border-gray-700">
            <Circle
              className={`w-2 h-2 ${
                isConnected ? 'fill-emerald-400 text-emerald-400' : 'fill-rose-500 text-rose-500'
              }`}
            />
            <span className={isConnected ? 'text-emerald-400' : 'text-rose-400'}>
              {isConnected ? t('terminal_connected') : t('terminal_offline')}
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Node Filter */}
          <select
            value={filterNode}
            onChange={(e) => setFilterNode(e.target.value)}
            className="px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-gray-300 focus:outline-none"
          >
            <option value="all">{t('all_nodes', { count: logs.length })}</option>
            {nodeOptions.map((nid) => (
              <option key={nid} value={nid}>
                Node: {nid.slice(-10)}
              </option>
            ))}
          </select>

          {/* Auto-scroll toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition ${
              autoScroll ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50' : 'bg-gray-800 text-gray-400'
            }`}
            title="Auto-scroll to bottom"
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            <span>{t('scroll_btn')}</span>
          </button>

          {/* Copy logs */}
          <button
            type="button"
            onClick={handleCopyLogs}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition"
            title="Copy logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Clear logs */}
          <button
            type="button"
            onClick={onClearLogs}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-red-400 transition"
            title="Clear terminal logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-gray-800">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 italic py-6 text-center select-none">
            {t('terminal_ready')}
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            const isStderr = log.stream_type === 'stderr';
            const isSystem = log.stream_type === 'system';
            const isViolation = log.chunk.includes('VIOLATION') || log.chunk.includes('UNAUTHORIZED');

            return (
              <div
                key={log.id || idx}
                className={`flex items-start gap-2 py-0.5 px-1 rounded ${
                  isViolation
                    ? 'bg-red-950/40 text-red-300 font-bold border-l-2 border-red-500'
                    : isStderr
                    ? 'text-rose-400'
                    : isSystem
                    ? 'text-cyan-400 font-semibold'
                    : 'text-gray-300'
                }`}
              >
                <span className="text-gray-500 select-none text-[10px] shrink-0 font-mono">
                  [{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '00:00:00'}]
                </span>

                {log.node_id && (
                  <span className="text-blue-400 shrink-0 font-semibold text-[10px]">
                    [{log.node_id.slice(-8)}]
                  </span>
                )}

                <span className="whitespace-pre-wrap break-all flex-1">{log.chunk}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
