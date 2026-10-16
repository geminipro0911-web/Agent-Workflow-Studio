import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  RotateCcw,
  Save,
  Cpu,
  Layers,
  ShieldAlert,
  Sun,
  Moon,
  Languages,
  Palette,
  ChevronDown,
  Check,
  Crown,
  Briefcase,
  Building2,
  Zap,
} from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { NodeSkinTheme } from '../../types/skins';
import { NODE_SKINS } from '../../services/skinThemes';

interface HeaderProps {
  workflowName: string;
  isExecuting: boolean;
  mockMode: boolean;
  onToggleMockMode: (mock: boolean) => void;
  onRunWorkflow: () => void;
  onStopWorkflow: () => void;
  onSaveWorkflow: () => void;
  onResetCanvas: () => void;
  onTriggerGlobalViolationTest: () => void;
  onNameChange: (name: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  workflowName,
  isExecuting,
  mockMode,
  onToggleMockMode,
  onRunWorkflow,
  onStopWorkflow,
  onSaveWorkflow,
  onResetCanvas,
  onTriggerGlobalViolationTest,
  onNameChange,
}) => {
  const { theme, toggleTheme, language, toggleLanguage, nodeSkin, setNodeSkin, t } = useThemeLanguage();
  const [skinMenuOpen, setSkinMenuOpen] = useState(false);
  const skinMenuRef = useRef<HTMLDivElement>(null);

  // Close skin menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (skinMenuRef.current && !skinMenuRef.current.contains(e.target as Node)) {
        setSkinMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const skinOptions: { id: NodeSkinTheme; icon: any; labelEn: string; labelVi: string }[] = [
    { id: 'feudal', icon: Crown, labelEn: 'Feudal Dynasty 👑', labelVi: 'Phong Kiến (Vua/Quân Sư) 👑' },
    { id: 'capitalist', icon: Briefcase, labelEn: 'Wall St Capitalist 💼', labelVi: 'Tư Bản (Big Boss) 💼' },
    { id: 'corporate', icon: Building2, labelEn: 'Tech Enterprise 🏢', labelVi: 'Công Ty Công Nghệ 🏢' },
    { id: 'cyberpunk', icon: Zap, labelEn: 'Cyberpunk 2077 🚀', labelVi: 'Chiến Binh Cyberpunk 🚀' },
  ];

  const currentSkinOption = skinOptions.find((s) => s.id === nodeSkin) || skinOptions[0];
  const SkinIcon = currentSkinOption.icon;

  return (
    <header className="h-16 bg-white dark:bg-[#101726] border-b border-gray-200 dark:border-gray-800 px-5 flex items-center justify-between z-30 select-none shadow-md dark:shadow-xl transition-colors duration-200">
      {/* Brand & Workflow Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-gray-900 dark:text-white tracking-tight">
                {t('studio_title')}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/30">
                {t('studio_badge')}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
              {t('studio_subtitle')}
            </p>
          </div>
        </div>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 hidden md:block" />

        {/* Workflow Name Editable */}
        <div className="hidden sm:flex items-center gap-2 bg-gray-100 dark:bg-gray-900/80 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <Layers className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
          <input
            type="text"
            value={workflowName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('workflow_name_placeholder')}
            className="text-xs bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none font-semibold w-44 truncate"
          />
        </div>
      </div>

      {/* Middle & Right Actions */}
      <div className="flex items-center gap-2.5">
        {/* ======================================================== */}
        {/* NODE THEME SKIN SELECTOR (Phong Kiến, Tư Bản, Công Ty, Cyberpunk) */}
        {/* ======================================================== */}
        <div className="relative" ref={skinMenuRef}>
          <button
            type="button"
            onClick={() => setSkinMenuOpen(!skinMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/20 shadow-sm transition transform active:scale-95"
            title="Chuyển đổi giao diện hiển thị các Node dạng Chibi 3D animation"
          >
            <SkinIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden lg:inline text-gray-500 dark:text-gray-400 font-normal">
              {t('node_skin_label')}:
            </span>
            <span className="truncate max-w-[130px]">
              {language === 'vi' ? currentSkinOption.labelVi : currentSkinOption.labelEn}
            </span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {/* Skin Dropdown Menu */}
          {skinMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#161F30] border border-gray-200 dark:border-gray-700 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <span>Chọn Giao Diện Chibi 3D</span>
                <Palette className="w-3.5 h-3.5 text-blue-500" />
              </div>

              <div className="p-1 space-y-1">
                {skinOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = nodeSkin === opt.id;
                  const skinDef = NODE_SKINS[opt.id];
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setNodeSkin(opt.id);
                        setSkinMenuOpen(false);
                      }}
                      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-left transition ${
                        isSelected
                          ? 'bg-amber-500/15 dark:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/40 font-bold'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs truncate">
                            {language === 'vi' ? opt.labelVi : opt.labelEn}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5 font-normal">
                          {language === 'vi' ? skinDef.descriptionVi : skinDef.descriptionEn}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Execution Mode Segmented Switch */}
        <div className="hidden xl:flex items-center p-1 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-800 shadow-inner gap-1">
          <button
            type="button"
            onClick={() => onToggleMockMode(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !mockMode
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-1 ring-emerald-400'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${!mockMode ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
            <span>⚡ {language === 'vi' ? 'Thực thi Trực tiếp (Live Engine)' : 'Live Engine (Gemini CLI)'}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${!mockMode ? 'bg-black/30 text-emerald-200 border border-emerald-400/40' : 'text-gray-400'}`}>
              Git Auditor Active
            </span>
          </button>
          <button
            type="button"
            onClick={() => onToggleMockMode(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mockMode
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span>🧪 {language === 'vi' ? 'Giả lập (Mock CLI)' : 'Mock CLI (0 Tokens)'}</span>
          </button>
        </div>

        {/* Test Scope Violation Button */}
        <button
          type="button"
          onClick={onTriggerGlobalViolationTest}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-500/40 hover:bg-red-500/20 shadow-sm transition transform active:scale-95"
          title="Instantly simulate a Git Scope Violation alert with unified diff"
        >
          <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 animate-pulse" />
          <span className="hidden md:inline">{t('test_violation')}</span>
        </button>

        {/* Run / Stop Workflow Controls */}
        {isExecuting ? (
          <button
            type="button"
            onClick={onStopWorkflow}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 transition transform active:scale-95 animate-pulse"
          >
            <Square className="w-3.5 h-3.5 fill-white" />
            <span>{t('stop_execution')}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onRunWorkflow}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-400 text-white shadow-md shadow-blue-600/30 transition transform active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>{t('run_workflow')}</span>
          </button>
        )}

        {/* Save Workflow Button */}
        <button
          type="button"
          onClick={onSaveWorkflow}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 transition"
          title="Save layout and configurations"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{t('save_workflow')}</span>
        </button>

        {/* Reset Canvas */}
        <button
          type="button"
          data-testid="reset-canvas-btn"
          onClick={onResetCanvas}
          className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 transition"
          title={t('clear_canvas')}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <div className="h-5 w-px bg-gray-200 dark:bg-gray-800 mx-0.5" />

        {/* Language Switcher (ENG / VI) */}
        <button
          type="button"
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 transition"
          title="Toggle Language (ENG / VI)"
        >
          <Languages className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="font-mono">{language === 'en' ? 'ENG' : 'VI'}</span>
        </button>

        {/* Theme Switcher (Light / Dark) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 text-amber-600 dark:text-amber-400 transition"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Chuyển sang Giao diện Tối'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition duration-200" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600 hover:-rotate-12 transition duration-200" />
          )}
        </button>
      </div>
    </header>
  );
};
