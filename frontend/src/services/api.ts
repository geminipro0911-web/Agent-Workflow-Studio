import {
  AgentPreset,
  WorkflowTemplate,
  Workflow,
  ExecutionSession,
  ViolationData,
  TerminalLog,
} from '../types';
import { ENTERPRISE_AGENT_PRESETS, WORKFLOW_TEMPLATES_DATA } from './presetsData';

const BASE_URL = '/api/v1';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errMsg = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errMsg = errJson.error.message;
      } else if (errJson?.detail) {
        errMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      } else if (errJson?.message) {
        errMsg = errJson.message;
      }
    } catch {
      // Ignore
    }
    throw new Error(errMsg);
  }

  const json = await response.json();
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Presets & Templates
  async getPresets(): Promise<AgentPreset[]> {
    try {
      const data = await request<AgentPreset[]>('/presets');
      return data && data.length > 0 ? data : ENTERPRISE_AGENT_PRESETS;
    } catch (e) {
      console.warn('API getPresets failed, using built-in presets:', e);
      return ENTERPRISE_AGENT_PRESETS;
    }
  },

  async getTemplates(): Promise<WorkflowTemplate[]> {
    try {
      const data = await request<WorkflowTemplate[]>('/templates');
      if (data && data.length > 0) {
        return data.map((t) => {
          if (!t.layout_data || !t.layout_data.nodes?.length) {
            const fallback = WORKFLOW_TEMPLATES_DATA.find((f) => f.id === t.id);
            return fallback ? { ...t, layout_data: fallback.layout_data } : t;
          }
          return t;
        });
      }
      return WORKFLOW_TEMPLATES_DATA;
    } catch (e) {
      console.warn('API getTemplates failed, using built-in templates:', e);
      return WORKFLOW_TEMPLATES_DATA;
    }
  },

  async createWorkflowFromTemplate(
    templateId: string,
    name: string,
    description?: string
  ): Promise<Workflow> {
    try {
      return await request<Workflow>(`/workflows/from-template/${templateId}`, {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
    } catch (e) {
      console.warn('Backend unavailable, constructing workflow locally:', e);
      const t = WORKFLOW_TEMPLATES_DATA.find((x) => x.id === templateId);
      if (!t || !t.layout_data) throw e;
      const wfId = `wf_local_${Date.now()}`;
      return {
        id: wfId,
        name: name || t.name,
        description: description || t.description,
        template_id: templateId,
        nodes: t.layout_data.nodes.map((n) => ({ ...n, id: `${wfId}_${n.id}` })),
        edges: t.layout_data.edges.map((edge) => ({
          ...edge,
          source_node_id: `${wfId}_${edge.source_node_id}`,
          target_node_id: `${wfId}_${edge.target_node_id}`,
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  },

  // Workflows CRUD
  async listWorkflows(): Promise<Workflow[]> {
    try {
      return await request<Workflow[]>('/workflows');
    } catch (e) {
      console.warn('API listWorkflows failed:', e);
      return [];
    }
  },

  async getWorkflow(workflowId: string): Promise<Workflow> {
    return request<Workflow>(`/workflows/${workflowId}`);
  },

  async createWorkflow(payload: Partial<Workflow>): Promise<Workflow> {
    return request<Workflow>('/workflows', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateWorkflow(workflowId: string, payload: Partial<Workflow>): Promise<Workflow> {
    return request<Workflow>(`/workflows/${workflowId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteWorkflow(workflowId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/workflows/${workflowId}`, {
      method: 'DELETE',
    });
  },

  // Execution Control
  async executeWorkflow(
    workflowId: string,
    params: { mock_mode?: boolean; environment_vars?: Record<string, string> } = {}
  ): Promise<{ execution_id: string; workflow_id: string; status: string; mock_mode: boolean }> {
    return request(`/workflows/${workflowId}/execute`, {
      method: 'POST',
      body: JSON.stringify({
        mock_mode: params.mock_mode ?? true,
        environment_vars: params.environment_vars ?? {},
      }),
    });
  },

  async getExecutionStatus(executionId: string): Promise<ExecutionSession> {
    return request<ExecutionSession>(`/executions/${executionId}`);
  },

  async stopExecution(executionId: string): Promise<{ success: boolean; message: string }> {
    return request(`/executions/${executionId}/stop`, {
      method: 'POST',
    });
  },

  // Git Diff Auditor Violations
  async revertViolations(
    executionId: string,
    nodeId: string,
    payload: { reverted_by: string; comment?: string }
  ): Promise<{ node_id: string; status: string; reverted_files: string[]; action: string }> {
    return request(`/executions/${executionId}/nodes/${nodeId}/revert-violations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async approveViolations(
    executionId: string,
    nodeId: string,
    payload: { approved_by: string; reason: string }
  ): Promise<{ node_id: string; status: string; accepted_files: string[]; action: string }> {
    return request(`/executions/${executionId}/nodes/${nodeId}/approve-violations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getNodeViolations(executionId: string, nodeId: string): Promise<ViolationData> {
    return request<ViolationData>(`/executions/${executionId}/nodes/${nodeId}/violations`);
  },

  // Human Pre-execution Approval Gate
  async approveNode(
    executionId: string,
    nodeId: string,
    payload: { approved_by: string; comment?: string }
  ): Promise<{ success: boolean; message: string }> {
    return request(`/executions/${executionId}/nodes/${nodeId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async rejectNode(
    executionId: string,
    nodeId: string,
    payload: { rejected_by: string; reason: string }
  ): Promise<{ success: boolean; message: string }> {
    return request(`/executions/${executionId}/nodes/${nodeId}/reject`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Logs
  async getExecutionLogs(executionId: string, nodeId?: string): Promise<TerminalLog[]> {
    const query = nodeId ? `?node_id=${encodeURIComponent(nodeId)}` : '';
    return request<TerminalLog[]>(`/executions/${executionId}/logs${query}`);
  },

  // Workspace
  async validateWorkspace(workspaceDir: string): Promise<{ workspace_dir: string; is_valid: boolean; error_message?: string | null }> {
    return request(`/workspace/validate`, {
      method: 'POST',
      body: JSON.stringify({ workspace_dir: workspaceDir }),
    });
  },
};
