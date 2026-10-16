import React, { useState } from 'react';
import {
  Sliders,
  FolderLock,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  HelpCircle,
  Lightbulb,
  Check,
  Copy,
  Sparkles,
  X,
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

const getRoleGuide = (presetId?: string, roleName?: string) => {
  const pid = (presetId || '').toLowerCase();
  const rname = (roleName || '').toLowerCase();

  if (pid === 'pm' || rname.includes('product') || rname.includes('ba')) {
    return {
      roleNameHintVi: 'Nhập chức danh: Product Manager (BA), Technical BA hoặc Product Owner.',
      roleNameHintEn: 'Enter title: Product Manager (BA), Technical BA or Product Owner.',
      taskPromptHintVi: 'Mục tiêu thực thi: 1) Tài liệu đầu vào (README, docs/requirements/) ➔ 2) Phân rã nghiệp vụ chi tiết ➔ 3) File đặc tả đầu ra (docs/requirements/feature_spec.md) ➔ 4) Tiêu chuẩn nghiệm thu (Gherkin format: Given - When - Then).',
      taskPromptHintEn: 'Suggested structure: 1) Inputs to review ➔ 2) Functional breakdown ➔ 3) Output file path (docs/requirements/feature_spec.md) ➔ 4) Acceptance criteria in Gherkin format.',
      samplePrompt: 'Review product objectives in README.md. Formulate user stories with acceptance criteria (Gherkin format: Given-When-Then) and output comprehensive requirements to docs/requirements/feature_spec.md.',
      systemPromptHintVi: 'Thiết lập tư duy Product Owner, tập trung vào UX và tính năng nghiệp vụ, tuyệt đối không can thiệp code ứng dụng.',
      systemPromptHintEn: 'Focus on UX, business value, user journeys; never write code or database migrations directly.',
      allowedPathsHintVi: 'docs/requirements/**, docs/specs/**',
      allowedPathsHintEn: 'docs/requirements/**, docs/specs/**',
    };
  }
  if (pid === 'architect' || rname.includes('architect') || rname.includes('kiến trúc')) {
    return {
      roleNameHintVi: 'Nhập chức danh: System Architect, Solution Architect hoặc Principal Engineer.',
      roleNameHintEn: 'Enter title: System Architect, Solution Architect or Principal Engineer.',
      taskPromptHintVi: 'Mục tiêu thực thi: 1) Đọc yêu cầu từ PM ➔ 2) Thiết kế kiến trúc module, luồng dữ liệu ➔ 3) Quy định endpoint REST/WebSocket cụ thể trong api_spec.md ➔ 4) Ghi chép quyết định kiến trúc trong docs/architecture/ADR.md.',
      taskPromptHintEn: 'Suggested structure: 1) Read PM specs ➔ 2) Design module topology & data flows ➔ 3) Specify exact API endpoints in api_spec.md ➔ 4) Record ADRs in docs/architecture/.',
      samplePrompt: 'Review docs/requirements/feature_spec.md. Design modular system architecture, specify REST and WebSocket endpoints in api_spec.md, and draft ADR record under docs/architecture/ADR_001.md.',
      systemPromptHintVi: 'Đảm bảo tính mở rộng, bảo mật từ thiết kế (Security by Design), không viết code UI hoặc business logic chi tiết.',
      systemPromptHintEn: 'Enforce scalable patterns, clean contracts; do not write frontend view code or application business logic.',
      allowedPathsHintVi: 'docs/architecture/**, api_spec.md, docs/api/**',
      allowedPathsHintEn: 'docs/architecture/**, api_spec.md, docs/api/**',
    };
  }
  if (pid === 'database' || rname.includes('database') || rname.includes('csdl') || rname.includes('dba')) {
    return {
      roleNameHintVi: 'Nhập chức danh: Database Engineer, DBA hoặc Data Modeler.',
      roleNameHintEn: 'Enter title: Database Engineer, DBA or Data Modeler.',
      taskPromptHintVi: 'Mục tiêu thực thi: 1) Đọc sơ đồ kiến trúc ➔ 2) Thiết kế schema, khóa chính, khóa ngoại ➔ 3) Viết migration script DDL và script rollback ➔ 4) Thêm index tối ưu truy vấn.',
      taskPromptHintEn: 'Suggested structure: 1) Read architecture schema ➔ 2) Design tables, PKs, FKs, constraints ➔ 3) Write DDL migration and rollback scripts ➔ 4) Optimize query indexes.',
      samplePrompt: 'Design relational schema and write non-locking DDL migration and rollback scripts under backend/migrations/, adding appropriate indexes for high-traffic query patterns.',
      systemPromptHintVi: 'Đảm bảo tính toàn vẹn dữ liệu, các bảng phải có created_at/updated_at, chỉ thao tác trong thư mục migration/model.',
      systemPromptHintEn: 'Enforce relational integrity, audit timestamps, foreign keys; write only in backend/migrations/ and models.',
      allowedPathsHintVi: 'backend/migrations/**, backend/app/models/**',
      allowedPathsHintEn: 'backend/migrations/**, backend/app/models/**',
    };
  }
  if (pid === 'backend' || rname.includes('backend') || rname.includes('api')) {
    return {
      roleNameHintVi: 'Nhập chức danh: Backend Developer, FastAPI Engineer hoặc API Lead.',
      roleNameHintEn: 'Enter title: Backend Developer, FastAPI Engineer or API Lead.',
      taskPromptHintVi: 'Mục tiêu thực thi: 1) Đọc hợp đồng API trong api_spec.md ➔ 2) Triển khai router, controller, service ➔ 3) Kiểm tra dữ liệu đầu vào bằng Pydantic ➔ 4) Xử lý ngoại lệ HTTP và kết nối CSDL.',
      taskPromptHintEn: 'Suggested structure: 1) Adhere to api_spec.md contracts ➔ 2) Implement routes, controllers, services ➔ 3) Validate inputs with Pydantic ➔ 4) Graceful HTTP error handling & database connectivity.',
      samplePrompt: 'Read api_spec.md. Implement FastAPI routers, models, and services in backend/app/ strictly conforming to the API schema, ensuring full error handling and input validation.',
      systemPromptHintVi: 'Áp dụng Clean Architecture, cấu trúc mã nguồn theo module, tuyệt đối không chỉnh sửa code frontend.',
      systemPromptHintEn: 'Apply Clean Architecture, modular services, zero SQL injection; never touch frontend code.',
      allowedPathsHintVi: 'backend/app/**, backend/tests/**',
      allowedPathsHintEn: 'backend/app/**, backend/tests/**',
    };
  }
  if (pid === 'frontend' || rname.includes('frontend') || rname.includes('ui') || rname.includes('giao diện')) {
    return {
      roleNameHintVi: 'Nhập chức danh: Frontend Developer, React/TypeScript Specialist hoặc UI Engineer.',
      roleNameHintEn: 'Enter title: Frontend Developer, React/TypeScript Specialist or UI Engineer.',
      taskPromptHintVi: 'Mục tiêu thực thi: 1) Đọc api_spec.md để khớp Type interface ➔ 2) Tạo component React với TailwindCSS ➔ 3) Xử lý state, loading, error boundary ➔ 4) Đảm bảo tương thích Dark/Light theme.',
      taskPromptHintEn: 'Suggested structure: 1) Sync TypeScript types with api_spec.md ➔ 2) Build React components with TailwindCSS ➔ 3) Manage state, loading & error states ➔ 4) Verify theme responsiveness.',
      samplePrompt: 'Implement user interface in frontend/src/ matching api_spec.md endpoints, with responsive Tailwind styling, loading states, and dark/light mode compatibility.',
      systemPromptHintVi: 'Chuyên trách giao diện web, tuân thủ tiêu chuẩn WCAG accessibility, không sửa code backend hoặc database.',
      systemPromptHintEn: 'Focus on responsive web UI, WCAG accessibility, strict TS types; never edit backend/db code.',
      allowedPathsHintVi: 'frontend/src/**',
      allowedPathsHintEn: 'frontend/src/**',
    };
  }
  if (pid === 'qa' || rname.includes('qa') || rname.includes('test') || rname.includes('kiểm thử')) {
    return {
      roleNameHintVi: 'Nhập chức danh: QA Automation Engineer, Tester hoặc SDET.',
      roleNameHintEn: 'Enter title: QA Automation Engineer, Tester or SDET.',
      taskPromptHintVi: 'Mục tiêu thực thi: 1) Đọc tiêu chí nghiệm thu của PM ➔ 2) Viết test case tự động (pytest hoặc playwright) ➔ 3) Chạy test suite ➔ 4) Xuất kết quả kiểm thử vào docs/test_reports/.',
      taskPromptHintEn: 'Suggested structure: 1) Read PM acceptance criteria ➔ 2) Write automated tests (pytest/playwright) ➔ 3) Run test suite ➔ 4) Compile reports to docs/test_reports/.',
      samplePrompt: 'Write comprehensive automated integration test suite in tests/ validating endpoints against api_spec.md, and record detailed test execution report under docs/test_reports/.',
      systemPromptHintVi: 'Không được phép sửa mã nguồn ứng dụng để test vượt qua; ghi nhận lỗi trung thực vào báo cáo.',
      systemPromptHintEn: 'Never alter application source code to make tests pass; record all defects in test reports.',
      allowedPathsHintVi: 'tests/**, e2e/**, docs/test_reports/**',
      allowedPathsHintEn: 'tests/**, e2e/**, docs/test_reports/**',
    };
  }
  if (pid === 'security' || rname.includes('security') || rname.includes('bảo mật') || rname.includes('audit')) {
    return {
      roleNameHintVi: 'Nhập chức danh: Security Engineer, Code Auditor hoặc AppSec Reviewer.',
      roleNameHintEn: 'Enter title: Security Engineer, Code Auditor or AppSec Reviewer.',
      taskPromptHintVi: 'Mục tiêu thực thi: 1) Rà soát toàn bộ diff code backend & frontend ➔ 2) Quét lỗ hổng OWASP Top 10 (SQLi, XSS, Auth bypass) ➔ 3) Kiểm tra lộ API key / secrets ➔ 4) Xuất báo cáo an ninh vào docs/security_audit/.',
      taskPromptHintEn: 'Suggested structure: 1) Review full code diffs across backend/frontend ➔ 2) Scan OWASP Top 10 risks ➔ 3) Verify zero secret/credential leaks ➔ 4) Output audit report in docs/security_audit/.',
      samplePrompt: 'Perform comprehensive security code audit across backend and frontend for OWASP Top 10 risks and secret leaks, and write remediation plan in docs/security_audit/report.md.',
      systemPromptHintVi: 'Đóng vai trò kiểm toán viên độc lập, không trực tiếp sửa code ứng dụng, đưa ra khuyến nghị rõ ràng.',
      systemPromptHintEn: 'Act as an independent auditor; never modify application code directly; provide remediation steps.',
      allowedPathsHintVi: 'docs/security_audit/**, SECURITY.md',
      allowedPathsHintEn: 'docs/security_audit/**, SECURITY.md',
    };
  }

  return {
    roleNameHintVi: 'Nhập chức danh rõ ràng đại diện cho vai trò của Agent này trong chu trình phát triển phần mềm.',
    roleNameHintEn: 'Enter a clear professional persona representing this Agent in the development lifecycle.',
    taskPromptHintVi: 'Mục tiêu thực thi: 1) Đọc dữ liệu đầu vào ➔ 2) Hành động cần thực hiện ➔ 3) Đường dẫn file kết quả cụ thể ➔ 4) Tiêu chí hoàn thành.',
    taskPromptHintEn: 'Suggested structure: 1) Inputs to read ➔ 2) Actions to take ➔ 3) Specific target files ➔ 4) Acceptance criteria.',
    samplePrompt: 'Execute corporate objectives for this role, adhering to the project architectural standards and writing cleanly to designated paths.',
    systemPromptHintVi: 'Quy định ranh giới trách nhiệm, tiêu chuẩn code và nguyên tắc hoạt động của vai trò này.',
    systemPromptHintEn: 'Define boundaries, code hygiene standards, and operational guidelines for this role.',
    allowedPathsHintVi: 'Liệt kê các mẫu đường dẫn glob mà Agent được phép chỉnh sửa, ngăn chặn xung đột file.',
    allowedPathsHintEn: 'List glob path patterns the agent can modify to prevent accidental file conflicts.',
  };
};

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  selectedNode,
  onUpdateNodeData,
  onDeleteNode,
  onSimulateViolation,
}) => {
  const { language, t } = useThemeLanguage();
  const [newPathInput, setNewPathInput] = useState('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isHoverGuide, setIsHoverGuide] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [appliedPrompt, setAppliedPrompt] = useState(false);

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
  const guide = getRoleGuide(data.preset_id, data.role_name);

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

  const handleApplySamplePrompt = () => {
    onUpdateNodeData(selectedNode.id, { task_prompt: guide.samplePrompt });
    setAppliedPrompt(true);
    setTimeout(() => setAppliedPrompt(false), 2000);
  };

  const handleCopySamplePrompt = () => {
    navigator.clipboard.writeText(guide.samplePrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const showGuide = isGuideOpen || isHoverGuide;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0D131F] text-gray-800 dark:text-gray-200 select-none transition-colors duration-200">
      {/* Inspector Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111827] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="p-2 rounded-lg border flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `${data.color_theme || '#3b82f6'}1a`,
              borderColor: `${data.color_theme || '#3b82f6'}4d`,
              color: data.color_theme || '#3b82f6',
            }}
          >
            <IconMapper name={data.icon || 'Bot'} className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[130px]">
                {data.role_name || 'Agent Config'}
              </h3>

              {/* Question Mark Button */}
              <button
                type="button"
                onClick={() => setIsGuideOpen((prev) => !prev)}
                onMouseEnter={() => setIsHoverGuide(true)}
                onMouseLeave={() => setIsHoverGuide(false)}
                className={`p-1 rounded-full transition-all flex items-center justify-center ${
                  showGuide
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-400'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-600'
                }`}
                title="Xem hướng dẫn chi tiết & gợi ý cách điền các trường của Node này"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
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
        {/* Interactive Configuration Guide & Suggestions Box */}
        {showGuide && (
          <div className="p-3.5 rounded-xl bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-[#151F32] dark:to-[#101726] border-2 border-blue-400 dark:border-blue-500/60 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-150 relative">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200 dark:border-blue-900/60">
              <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold text-xs">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>{t('node_guide_title')}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsGuideOpen(false);
                  setIsHoverGuide(false);
                }}
                className="p-1 rounded-lg hover:bg-blue-200/60 dark:hover:bg-blue-900/40 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                title={t('node_guide_close')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Role Name Suggestion */}
            <div className="space-y-1 text-xs">
              <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>{t('agent_role_name')}:</span>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 pl-2.5 leading-relaxed">
                {language === 'vi' ? guide.roleNameHintVi : guide.roleNameHintEn}
              </p>
            </div>

            {/* Task Prompt Suggestion */}
            <div className="space-y-1.5 text-xs">
              <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>{t('task_prompt')}:</span>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 pl-2.5 leading-relaxed">
                {language === 'vi' ? guide.taskPromptHintVi : guide.taskPromptHintEn}
              </p>

              {/* Sample Prompt Box with Action Buttons */}
              <div className="ml-2.5 p-2 rounded-lg bg-white/80 dark:bg-black/40 border border-blue-200 dark:border-blue-900/60 font-mono text-[10px] text-gray-800 dark:text-gray-200 space-y-2">
                <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 font-semibold text-[10px]">
                  <span>{t('sample_prompt_for_role', { role: data.role_name || 'Agent' })}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCopySamplePrompt}
                      className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-1 text-[9px] transition"
                    >
                      {copiedPrompt ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPrompt ? t('applied_success') : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleApplySamplePrompt}
                      className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 text-[9px] font-bold shadow-sm transition"
                    >
                      {appliedPrompt ? <Check className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                      <span>{appliedPrompt ? t('applied_success') : t('apply_prompt_template')}</span>
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-300">
                  {guide.samplePrompt}
                </p>
              </div>
            </div>

            {/* System Prompt Suggestion */}
            <div className="space-y-1 text-xs">
              <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span>{t('system_prompt')}:</span>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 pl-2.5 leading-relaxed">
                {language === 'vi' ? guide.systemPromptHintVi : guide.systemPromptHintEn}
              </p>
            </div>

            {/* Allowed Paths Suggestion */}
            <div className="space-y-1 text-xs">
              <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{t('allowed_paths_box')}:</span>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 pl-2.5 leading-relaxed font-mono">
                {language === 'vi' ? guide.allowedPathsHintVi : guide.allowedPathsHintEn}
              </p>
            </div>
          </div>
        )}
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
