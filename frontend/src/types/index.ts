export type NodeExecutionStatus =
  | 'idle'
  | 'pending'
  | 'queued_lock'
  | 'waiting_approval'
  | 'running'
  | 'violation_paused'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'rejected';

export interface AgentPreset {
  id: string;
  role_name: string;
  icon: string;
  color_theme: string;
  default_system_prompt: string;
  default_allowed_paths: string[];
  default_read_only_paths: string[];
  core_function_vi?: string;
  core_function_en?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  nodes_count: number;
  edges_count: number;
  layout_data?: {
    nodes: AgentNodeConfig[];
    edges: WorkflowEdgeConfig[];
  };
}

export interface GitDiffItem {
  file_path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked';
  diff_text: string;
}

export interface ViolationData {
  node_id?: string;
  role_name?: string;
  allowed_paths?: string[];
  unauthorized_files: string[];
  diffs: GitDiffItem[];
  detected_at?: string;
}

export interface AgentNodeConfig {
  id: string;
  preset_id?: string;
  role_name: string;
  node_type?: string;
  icon?: string;
  color_theme?: string;
  position_x: number;
  position_y: number;
  system_prompt: string;
  task_prompt: string;
  allowed_paths: string[];
  read_only_paths: string[];
  require_human_approval: boolean;
  simulate_violation?: boolean;
}

export interface WorkflowEdgeConfig {
  id: string;
  source_node_id: string;
  target_node_id: string;
  condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  template_id?: string;
  created_at?: string;
  updated_at?: string;
  nodes: AgentNodeConfig[];
  edges: WorkflowEdgeConfig[];
}

export interface ExecutionNodeState {
  node_id: string;
  status: NodeExecutionStatus;
  error_message?: string | null;
  violation_data?: ViolationData | null;
  violation_action_at?: string | null;
  violation_action_by?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
}

export interface ExecutionSession {
  id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'stopped';
  mock_mode: boolean;
  start_time: string;
  end_time?: string | null;
  nodes_status?: ExecutionNodeState[];
  active_locks?: Array<{
    id?: string;
    node_id: string;
    path_pattern: string;
    locked_at?: string;
  }>;
}

export interface TerminalLog {
  id?: number | string;
  execution_id?: string;
  node_id: string;
  stream_type: 'stdout' | 'stderr' | 'system';
  chunk: string;
  seq_order?: number;
  timestamp: string;
}

// WebSocket message payloads
export interface WSEnvelope<T = any> {
  type:
    | 'connection_ack'
    | 'scope_violation_alert'
    | 'node_status_update'
    | 'terminal_log'
    | 'lock_acquired'
    | 'lock_released'
    | 'approval_requested'
    | 'workflow_status_update'
    | 'error_notification'
    | 'ping'
    | 'pong';
  execution_id: string;
  timestamp: string;
  payload: T;
}

export interface ScopeViolationAlertPayload {
  node_id: string;
  role_name: string;
  allowed_paths: string[];
  unauthorized_files: string[];
  diffs: GitDiffItem[];
  detected_at: string;
}

export interface NodeStatusUpdatePayload {
  node_id: string;
  previous_status?: NodeExecutionStatus;
  current_status: NodeExecutionStatus;
  error_message?: string;
}

export interface ApprovalRequestedPayload {
  node_id: string;
  role_name: string;
  task_prompt: string;
  allowed_paths: string[];
}

export interface ErrorNotificationPayload {
  node_id?: string;
  error_code: string;
  message: string;
}

export interface LockAcquiredPayload {
  node_id: string;
  locked_paths: string[];
}

export interface LockReleasedPayload {
  node_id: string;
  released_paths: string[];
}
