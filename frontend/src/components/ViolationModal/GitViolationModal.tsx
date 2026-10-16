import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  X,
  FileCode,
  ShieldCheck,
  FolderLock,
  Clock,
} from 'lucide-react';
import { ViolationData } from '../../types';
import { DiffViewer } from './DiffViewer';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

interface GitViolationModalProps {
  isOpen: boolean;
  violation: ViolationData | null;
  onClose: () => void;
  onRevert: (comment?: string) => Promise<void>;
  onApprove: (reason?: string) => Promise<void>;
  isProcessing?: boolean;
}

export const GitViolationModal: React.FC<GitViolationModalProps> = ({
  isOpen,
  violation,
  onClose,
  onRevert,
  onApprove,
  isProcessing = false,
}) => {
  const { t } = useThemeLanguage();
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [comment, setComment] = useState('');

  if (!isOpen || !violation) return null;

  const unauthorizedFiles = violation.unauthorized_files || [];
  const diffs = violation.diffs || [];
  const currentDiff = diffs[selectedFileIdx] || {
    file_path: unauthorizedFiles[selectedFileIdx] || 'unknown',
    status: 'modified' as const,
    diff_text: '',
  };

  const handleRevertClick = async () => {
    await onRevert(comment || 'Reverted unauthorized modifications made outside allowed scope.');
    setComment('');
  };

  const handleApproveClick = async () => {
    await onApprove(comment || 'User approved scope exception to proceed with workflow.');
    setComment('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-[#111827] border-2 border-red-500 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.35)] overflow-hidden transition-colors duration-200">
        {/* Animated Warning Header */}
        <div className="relative px-6 py-4 bg-gradient-to-r from-red-600 via-red-700 to-amber-700 dark:from-red-950/90 dark:via-red-900/60 dark:to-amber-950/80 border-b border-red-500/50 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 dark:bg-red-600/30 border border-white/40 dark:border-red-500 rounded-xl animate-pulse">
              <ShieldAlert className="w-6 h-6 text-white dark:text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 bg-black/40 text-white rounded-full">
                  {t('violation_detected_title')}
                </span>
                <span className="text-xs text-red-100 dark:text-red-200/70 font-mono">
                  {t('violation_detected_sub')}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
                {t('violation_agent_heading', { role: violation.role_name || violation.node_id || '' })}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              title="Dismiss dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-700">
          {/* Explanation Alert Box */}
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-800 dark:text-gray-300 space-y-1">
              <p>
                {t('violation_box_desc', { count: unauthorizedFiles.length })}
              </p>
              {violation.detected_at && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 pt-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t('detected_at')}: {new Date(violation.detected_at).toLocaleTimeString()} ({violation.detected_at})</span>
                </div>
              )}
            </div>
          </div>

          {/* Scope Comparison Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Authorized Paths */}
            <div className="p-3.5 bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700/80 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                <FolderLock className="w-4 h-4" />
                <span>{t('authorized_paths')}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(violation.allowed_paths || []).length > 0 ? (
                  violation.allowed_paths?.map((path, i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 rounded-md font-mono"
                    >
                      {path}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-500 italic">{t('no_allowed_paths')}</span>
                )}
              </div>
            </div>

            {/* Unauthorized Files Detected */}
            <div className="p-3.5 bg-gray-50 dark:bg-gray-900/70 border border-red-300 dark:border-red-700/60 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
                <ShieldAlert className="w-4 h-4" />
                <span>{t('unauthorized_files', { count: unauthorizedFiles.length })}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {unauthorizedFiles.map((file, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedFileIdx(i)}
                    className={`text-xs px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5 transition ${
                      selectedFileIdx === i
                        ? 'bg-red-600 text-white font-bold ring-2 ring-red-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800/60 hover:bg-red-200 dark:hover:bg-red-900/50'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>{file}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Diff Viewer Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                {t('inspect_diff_label')}: <code className="text-blue-600 dark:text-white normal-case font-mono">{currentDiff.file_path}</code>
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-[11px]">
                {t('showing_file_of', { current: selectedFileIdx + 1, total: unauthorizedFiles.length || 1 })}
              </span>
            </div>

            <DiffViewer
              diffText={currentDiff.diff_text || 'No diff available for this file.'}
              filePath={currentDiff.file_path}
              status={currentDiff.status}
            />
          </div>

          {/* User Comment / Reason Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              {t('audit_note_label')}:
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('audit_note_placeholder')}
              className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Modal Footer with Required 2 Action Buttons */}
        <div className="px-6 py-4 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t('resolving_note')}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Action 1: Revert Unauthorized Files & Continue */}
            <button
              onClick={handleRevertClick}
              disabled={isProcessing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-md shadow-red-600/30 border border-red-400/30 transition transform active:scale-95 disabled:opacity-50"
              title={t('revert_action_desc')}
            >
              <RotateCcw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{t('revert_action_btn')}</span>
            </button>

            {/* Action 2: Allow Exception & Continue */}
            <button
              onClick={handleApproveClick}
              disabled={isProcessing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/30 transition transform active:scale-95 disabled:opacity-50"
              title={t('approve_action_desc')}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('approve_action_btn')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
