import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  AlertTriangle,
  Footprints,
  Coffee,
  Play,
  RotateCcw,
} from 'lucide-react';
import { NodeExecutionStatus, ViolationData } from '../../types';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { ChibiAvatar3D, ChibiAction } from './ChibiAvatar3D';
import { NODE_SKINS } from '../../services/skinThemes';
import { getChibiDialogue } from '../../services/chibiDialogues';

export interface AgentNodeData {
  id: string;
  preset_id?: string;
  role_name: string;
  node_type?: string;
  icon?: string;
  color_theme?: string;
  system_prompt?: string;
  task_prompt?: string;
  allowed_paths?: string[];
  read_only_paths?: string[];
  require_human_approval?: boolean;
  simulate_violation?: boolean;
  status?: NodeExecutionStatus;
  violation_data?: ViolationData | null;
  error_message?: string | null;
  onOpenViolationModal?: (violation: ViolationData) => void;
  [key: string]: unknown;
}

export const AgentNode = memo(({ data, selected }: NodeProps) => {
  const { nodeSkin, language, t } = useThemeLanguage();
  const nodeData = data as AgentNodeData;
  const status = nodeData.status || 'idle';
  const presetKey = (nodeData.preset_id || 'backend').toLowerCase();

  // Manual interactive action override (Đi, Ngồi, Chạy)
  const [manualAction, setManualAction] = useState<ChibiAction | null>(null);

  // Retrieve Themed Skin Profile (Phong kiến, Tư bản, Công ty, Cyberpunk)
  const currentSkinDef = NODE_SKINS[nodeSkin] || NODE_SKINS.corporate;
  const themedRole = currentSkinDef.roles[presetKey] || currentSkinDef.roles['backend'];

  // Display Titles: Show the specific pipeline role (e.g. System Architect, Canvas Game Dev)
  const displayTitle = nodeData.role_name || (language === 'vi' ? themedRole?.themeTitleVi : themedRole?.themeTitleEn);
  const displaySubtitle =
    language === 'vi' ? themedRole?.themeTitleVi || themedRole?.subtitleVi : themedRole?.themeTitleEn || themedRole?.subtitleEn;
  const displayBadge = language === 'vi' ? themedRole?.badgeVi : themedRole?.badgeEn;

  const colorTheme = themedRole?.primaryColor || nodeData.color_theme || '#3b82f6';
  const hasViolation = status === 'violation_paused';

  // Effective action: User manual override takes precedence, otherwise auto-derived from status
  const effectiveAction: ChibiAction = manualAction || (
    hasViolation
      ? 'panic'
      : status === 'running'
      ? 'run'
      : status === 'completed'
      ? 'cheer'
      : status === 'pending' || status === 'waiting_approval' || status === 'queued_lock'
      ? 'sit'
      : 'walk'
  );

  // Live status dialogue for Speech Bubble
  const dialogueText = getChibiDialogue(nodeSkin, presetKey, status, language);

  // RPG Status pill tag over character's head
  const getRPGStatusTag = () => {
    if (hasViolation) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (nodeData.onOpenViolationModal && nodeData.violation_data) {
              nodeData.onOpenViolationModal(nodeData.violation_data);
            }
          }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-500/60 animate-bounce border border-red-300"
          title={t('inspect_violation_btn')}
        >
          <AlertTriangle className="w-2.5 h-2.5 text-amber-200" />
          <span>{t('status_violation')} [XEM]</span>
        </button>
      );
    }

    if (effectiveAction === 'run') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-600 text-white shadow-md shadow-blue-500/40 animate-pulse border border-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping" />
          <span>{t('status_running')}</span>
        </span>
      );
    }

    if (effectiveAction === 'sit') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-black/60 dark:bg-black/80 text-amber-300 border border-amber-500/40 backdrop-blur-sm">
          <span>🍵</span>
          <span>{status === 'pending' ? t('status_pending') : 'Đang ngồi nghỉ'}</span>
        </span>
      );
    }

    if (effectiveAction === 'cheer') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-600 text-white shadow-md shadow-emerald-500/40 border border-emerald-400">
          <span>🎉</span>
          <span>{t('status_completed')}</span>
        </span>
      );
    }

    // Default: Walking / Idle
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-black/60 dark:bg-black/80 text-emerald-400 border border-emerald-500/30 backdrop-blur-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>{t('status_idle')}</span>
      </span>
    );
  };

  return (
    <div className="relative flex flex-col items-center justify-end select-none group min-w-[140px] max-w-[210px] pb-2">
      {/* React Flow Connection Handles (Glow Gem Handles) */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3.5 h-3.5 !bg-blue-500 !border-2 !border-white dark:!border-gray-900 rounded-full transition-transform hover:scale-150 shadow-[0_0_8px_rgba(59,130,246,0.9)]"
        style={{ top: '65%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3.5 h-3.5 !bg-emerald-500 !border-2 !border-white dark:!border-gray-900 rounded-full transition-transform hover:scale-150 shadow-[0_0_8px_rgba(16,185,129,0.9)]"
        style={{ top: '65%' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-2.5 h-2.5 !bg-amber-400 !border-2 !border-white dark:!border-gray-900 rounded-full opacity-60 hover:opacity-100"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-2.5 h-2.5 !bg-amber-400 !border-2 !border-white dark:!border-gray-900 rounded-full opacity-60 hover:opacity-100"
      />

      {/* ================================================================ */}
      {/* 1. OVERHEAD FLOATING GAME TAGS (Speech Bubble, Name, Title, Status) */}
      {/* ================================================================ */}
      <div className="flex flex-col items-center space-y-1 mb-2 z-20 pointer-events-none">
        {/* Floating Comic / Manga Speech Bubble */}
        <div className="animate-bubble-float max-w-[190px]">
          <div
            className={`relative px-2.5 py-1 rounded-xl text-[10px] font-semibold leading-tight shadow-lg border backdrop-blur-md flex items-center justify-center text-center ${
              hasViolation
                ? 'bg-red-600 text-white border-red-300 shadow-red-500/50 animate-pulse'
                : effectiveAction === 'run'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400/60 shadow-blue-500/40'
                : 'bg-white/95 dark:bg-gray-950/95 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700/80 shadow-md'
            }`}
          >
            <span className="truncate">{dialogueText}</span>
            {/* Bubble pointer tail */}
            <div
              className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b ${
                hasViolation
                  ? 'bg-red-600 border-red-300'
                  : effectiveAction === 'run'
                  ? 'bg-indigo-600 border-blue-400/60'
                  : 'bg-white/95 dark:bg-gray-950/95 border-gray-300 dark:border-gray-700/80'
              }`}
            />
          </div>
        </div>

        {/* RPG Character Nameplate (Tên nhân vật như trong game) */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-black/85 dark:bg-black/90 text-white border border-amber-500/60 shadow-md backdrop-blur-sm pointer-events-auto">
          {displayBadge && (
            <span className="text-[9px] font-bold text-amber-300 font-mono uppercase bg-amber-500/20 px-1 py-0.2 rounded border border-amber-500/40">
              {displayBadge}
            </span>
          )}
          <span className="text-xs font-black tracking-wide text-white drop-shadow truncate max-w-[140px]">
            {displayTitle}
          </span>
        </div>

        {/* Guild / Function Title Tag (Chức năng / Danh hiệu game) */}
        <div className="text-[9.5px] font-semibold text-amber-600 dark:text-amber-400/95 drop-shadow-sm font-mono truncate max-w-[170px]">
          « {displaySubtitle} »
        </div>

        {/* Status Pill Badge / Action Tag */}
        <div className="pointer-events-auto pt-0.5">{getRPGStatusTag()}</div>
      </div>

      {/* ================================================================ */}
      {/* 2. CHIBI CHARACTER SPRITE WITH ACTIONS (Walk, Sit, Run) */}
      {/* ================================================================ */}
      <div className="relative flex flex-col items-center justify-center">
        {/* Interactive Action Control Pills on Hover */}
        <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 bg-black/80 backdrop-blur-md p-1 rounded-full border border-gray-700 z-30 shadow-lg pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setManualAction('walk');
            }}
            className={`p-1 rounded-full text-[9px] font-semibold flex items-center gap-0.5 transition ${
              effectiveAction === 'walk'
                ? 'bg-emerald-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
            title="Hành động: Đi dạo xung quanh"
          >
            <Footprints className="w-2.5 h-2.5" />
            <span>Đi</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setManualAction('sit');
            }}
            className={`p-1 rounded-full text-[9px] font-semibold flex items-center gap-0.5 transition ${
              effectiveAction === 'sit'
                ? 'bg-amber-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
            title="Hành động: Ngồi nghỉ ngơi / Uống trà"
          >
            <Coffee className="w-2.5 h-2.5" />
            <span>Ngồi</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setManualAction('run');
            }}
            className={`p-1 rounded-full text-[9px] font-semibold flex items-center gap-0.5 transition ${
              effectiveAction === 'run'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
            title="Hành động: Chạy truyền lệnh sang node kế tiếp"
          >
            <Play className="w-2.5 h-2.5" />
            <span>Chạy</span>
          </button>

          {manualAction && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setManualAction(null);
              }}
              className="p-1 rounded-full text-gray-400 hover:text-red-400"
              title="Đặt lại theo trạng thái hệ thống"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        {/* 3D Chibi Avatar (Frameless, living RPG entity) */}
        <ChibiAvatar3D
          roleId={presetKey}
          skin={nodeSkin}
          status={status}
          action={effectiveAction}
          primaryColor={colorTheme}
          size={86}
        />

        {/* ============================================================== */}
        {/* 3. ISOMETRIC GROUND PEDESTAL / AURA RING UNDER FEET */}
        {/* ============================================================== */}
        <div className="relative -mt-3.5 flex items-center justify-center pointer-events-none">
          {/* Ground Contact Shadow */}
          <div className="w-16 h-4 rounded-full bg-black/35 dark:bg-black/75 blur-[2px]" />

          {/* Magical RPG Hero Selection Ring (When selected) */}
          {selected && (
            <div className="absolute w-20 h-8 rounded-full border-2 border-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.9)] rpg-selection-ring" />
          )}

          {/* Energetic Running Aura Ring (When sprinting) */}
          {effectiveAction === 'run' && (
            <div className="absolute w-20 h-7 rounded-full border border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.9)] animate-pulse" />
          )}

          {/* Alarm Ring (When Git Violation) */}
          {hasViolation && (
            <div className="absolute w-22 h-8 rounded-full border-2 border-red-500 shadow-[0_0_25px_rgba(239,68,68,1)] animate-ping" />
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* 4. CHIBI MESSENGER SPRINTS TO ADJACENT NODE (Tương tác node liền kề) */}
      {/* ================================================================ */}
      {effectiveAction === 'run' && (
        <div className="absolute top-[65%] left-1/2 pointer-events-none z-30 animate-sprint-to-adjacent flex items-center gap-1">
          {/* Running Mini-Messenger Chibi Sprite / Mandate Delivery */}
          {nodeSkin === 'feudal' && presetKey.includes('pm') ? (
            <div className="flex items-center gap-1 bg-amber-500/90 text-black px-2 py-0.5 rounded-full text-[10px] font-black shadow-lg border border-amber-300">
              <span className="text-base animate-bounce">🏃‍♂️📜</span>
              <span className="font-mono text-[9px]">Thánh Chỉ</span>
            </div>
          ) : nodeSkin === 'feudal' ? (
            <div className="flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-lg border border-red-300">
              <span className="text-base animate-bounce">🏇⚔️</span>
              <span className="font-mono text-[9px]">Quân Lệnh</span>
            </div>
          ) : nodeSkin === 'capitalist' ? (
            <div className="flex items-center gap-1 bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-lg border border-emerald-300">
              <span className="text-base animate-bounce">🏃‍♂️💼</span>
              <span className="font-mono text-[9px]">Giải Ngân</span>
            </div>
          ) : nodeSkin === 'cyberpunk' ? (
            <div className="flex items-center gap-1 bg-fuchsia-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-lg border border-cyan-300">
              <span className="text-base animate-bounce">🛰️⚡</span>
              <span className="font-mono text-[9px]">Sync Core</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-lg border border-blue-300">
              <span className="text-base animate-bounce">🏃‍♂️🎫</span>
              <span className="font-mono text-[9px]">User Story</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

AgentNode.displayName = 'AgentNode';
