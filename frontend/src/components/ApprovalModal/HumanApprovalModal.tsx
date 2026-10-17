import React, { useState } from 'react';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  X,
  FolderLock,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import { ApprovalRequestedPayload } from '../../types';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

interface HumanApprovalModalProps {
  isOpen: boolean;
  approvalData: ApprovalRequestedPayload | null;
  onClose: () => void;
  onApprove: (nodeId: string, comment?: string) => Promise<void>;
  onReject: (nodeId: string, reason?: string) => Promise<void>;
  isProcessing?: boolean;
}

export const HumanApprovalModal: React.FC<HumanApprovalModalProps> = ({
  isOpen,
  approvalData,
  onClose,
  onApprove,
  onReject,
  isProcessing = false,
}) => {
  const { t } = useThemeLanguage();
  const [comment, setComment] = useState('');

  if (!isOpen || !approvalData) return null;

  const handleApprove = async () => {
    await onApprove(approvalData.node_id, comment || 'Approved by Lead / User');
    setComment('');
  };

  const handleReject = async () => {
    await onReject(approvalData.node_id, comment || 'Rejected by Lead / User');
    setComment('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl flex flex-col bg-white dark:bg-[#111827] border-2 border-amber-500 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.35)] overflow-hidden transition-colors duration-200">
        {/* Animated Approval Header */}
        <div className="relative px-6 py-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 dark:from-amber-950/90 dark:via-orange-950/80 dark:to-amber-900/90 border-b border-amber-500/50 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 dark:bg-amber-600/30 border border-white/40 dark:border-amber-500 rounded-xl animate-pulse">
              <UserCheck className="w-6 h-6 text-white dark:text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 bg-black/40 text-amber-200 rounded-full">
                  {t('approval_modal_title')}
                </span>
                <span className="text-xs text-amber-100 dark:text-amber-200/70 font-mono">
                  {t('approval_modal_sub')}
                </span>
              </div>
              <h2 className="text-base font-bold text-white mt-0.5 flex items-center gap-2">
                {t('approval_node_heading', { role: approvalData.role_name || approvalData.node_id })}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
            title="Dismiss dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[75vh] space-y-4 text-sm text-gray-800 dark:text-gray-200">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
              {t('approval_box_desc')}
            </p>
          </div>

          {/* Node Meta Details */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800 text-xs">
              <span className="font-bold text-gray-700 dark:text-gray-300">Node Identifier:</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">{approvalData.node_id}</span>
            </div>

            {/* Planned Task Prompt */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                <span>Planned Task Prompt:</span>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-700/80 font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {approvalData.task_prompt || '(No prompt defined)'}
              </div>
            </div>

            {/* Allowed Paths to be locked */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <FolderLock className="w-3.5 h-3.5" />
                <span>Designated Write Paths (Glob Pattern):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(approvalData.allowed_paths || []).length > 0 ? (
                  approvalData.allowed_paths.map((p, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-mono"
                    >
                      {p}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-500 italic">None (Strict read-only)</span>
                )}
              </div>
            </div>
          </div>

          {/* User Sign-off Directives */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              {t('approval_note_label')}
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('approval_note_placeholder')}
              className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleReject}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 transition transform active:scale-95 disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            <span>{t('reject_btn')}</span>
          </button>

          <button
            type="button"
            onClick={handleApprove}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/30 transition transform active:scale-95 disabled:opacity-50"
          >
            <CheckCircle2 className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>{t('approve_btn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
