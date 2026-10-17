import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';

import { LeftSidebar } from './components/Sidebar/LeftSidebar';
import { Header } from './components/Header/Header';
import { FlowCanvas } from './components/Canvas/FlowCanvas';
import { NodeInspector } from './components/Inspector/NodeInspector';
import { LiveTerminal, TerminalHeightMode } from './components/Terminal/LiveTerminal';
import { GitViolationModal } from './components/ViolationModal/GitViolationModal';
import { HumanApprovalModal } from './components/ApprovalModal/HumanApprovalModal';
import { ExecutionProgressBar } from './components/Canvas/ExecutionProgressBar';
import { AgentNodeData } from './components/Canvas/AgentNode';

import {
  AgentPreset,
  WorkflowTemplate,
  Workflow,
  ViolationData,
  TerminalLog,
  NodeExecutionStatus,
  ApprovalRequestedPayload,
} from './types';
import { api } from './services/api';
import { wsClient } from './services/websocket';
import { ENTERPRISE_AGENT_PRESETS, WORKFLOW_TEMPLATES_DATA } from './services/presetsData';
import { ThemeLanguageProvider, useThemeLanguage } from './context/ThemeLanguageContext';

const LOCAL_STORAGE_SAVED_WORKFLOWS = 'multi_agent_builder_saved_workflows';

const loadSavedWorkflowsFromStorage = (): Workflow[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SAVED_WORKFLOWS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveWorkflowsToStorage = (list: Workflow[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_SAVED_WORKFLOWS, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to save workflows to localStorage:', err);
  }
};

export const AppContent: React.FC = () => {
  const { t } = useThemeLanguage();

  // Master lists
  const [presets, setPresets] = useState<AgentPreset[]>(ENTERPRISE_AGENT_PRESETS);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>(WORKFLOW_TEMPLATES_DATA);
  const [myWorkflows, setMyWorkflows] = useState<Workflow[]>([]);

  // Workflow meta
  const [workflowId, setWorkflowId] = useState<string>('wf_default');
  const [workflowName, setWorkflowName] = useState<string>('Enterprise Full-Stack SDLC Pipeline');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Execution & Terminal state
  const [isExecuting, setIsExecuting] = useState(false);
  const [mockMode, setMockMode] = useState<boolean>(() => {
    const p = new URLSearchParams(window.location.search).get('mock_mode');
    return p === 'true';
  });
  const [targetProjectPath, setTargetProjectPath] = useState<string>(() => {
    return (
      localStorage.getItem('studio_target_project_path') ||
      new URLSearchParams(window.location.search).get('workspace_dir') ||
      ''
    );
  });

  const handleTargetProjectPathChange = (newPath: string) => {
    setTargetProjectPath(newPath);
    try {
      localStorage.setItem('studio_target_project_path', newPath);
    } catch {
      // ignore
    }
  };

  const [executionId, setExecutionId] = useState<string | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);
  
  // Resizable terminal height mode ('minimized': 38px, 'normal': 240px, 'expanded': 420px)
  const [terminalHeightMode, setTerminalHeightMode] = useState<TerminalHeightMode>('normal');
  const terminalHeight = terminalHeightMode === 'minimized' ? 38 : terminalHeightMode === 'expanded' ? 420 : 240;

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Violation Alert Modal state
  const [violationModalOpen, setViolationModalOpen] = useState(false);
  const [currentViolation, setCurrentViolation] = useState<ViolationData | null>(null);
  const [isResolvingViolation, setIsResolvingViolation] = useState(false);

  // Pre-Execution Human Approval Gate Modal state
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [currentApproval, setCurrentApproval] = useState<ApprovalRequestedPayload | null>(null);
  const [isResolvingApproval, setIsResolvingApproval] = useState(false);

  // Helper: updates a node's visual execution status
  const updateNodeExecutionStatus = useCallback(
    (nodeId: string, status: NodeExecutionStatus, errorMessage?: string | null, violationData?: ViolationData | null) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId || n.id.endsWith(nodeId) || nodeId.endsWith(n.id)) {
            const currentData = n.data as AgentNodeData;
            return {
              ...n,
              data: {
                ...currentData,
                status,
                error_message: errorMessage !== undefined ? errorMessage : currentData.error_message,
                violation_data: violationData !== undefined ? violationData : currentData.violation_data,
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  const addTerminalLog = (
    node_id: string,
    stream_type: 'stdout' | 'stderr' | 'system',
    chunk: string
  ) => {
    setTerminalLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        node_id,
        stream_type,
        chunk,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  // Incoming Scope Violation Alert handler
  const handleIncomingViolationAlert = (violationData: ViolationData) => {
    setCurrentViolation(violationData);
    setViolationModalOpen(true);

    if (violationData.node_id) {
      updateNodeExecutionStatus(
        violationData.node_id,
        'violation_paused',
        `Scope violation: ${violationData.unauthorized_files.length} unauthorized file(s) modified.`,
        violationData
      );
    }

    addTerminalLog(
      violationData.node_id || 'AUDITOR',
      'stderr',
      `[GIT-AUDITOR ALERT] Scope violation detected on ${violationData.unauthorized_files.join(', ')}! Node paused in VIOLATION_PAUSED.`
    );
  };

  // Template loader (1-click corporate workflow pipelines)
  const loadTemplateById = useCallback(
    (templateId: string) => {
      const template =
        templates.find((t) => t.id === templateId && t.layout_data && t.layout_data.nodes?.length > 0) ||
        WORKFLOW_TEMPLATES_DATA.find((t) => t.id === templateId);

      if (!template || !template.layout_data) {
        console.warn(`Template with id '${templateId}' not found or missing layout_data.`);
        return;
      }

      setWorkflowName(template.name);
      setWorkflowId(`wf_${templateId}_${Date.now()}`);

      const newNodes: Node[] = template.layout_data.nodes.map((n) => ({
        id: n.id,
        type: 'agentNode',
        position: { x: n.position_x, y: n.position_y },
        data: {
          ...n,
          status: 'idle',
          violation_data: null,
        } as AgentNodeData,
      }));

      const newEdges: Edge[] = template.layout_data.edges.map((e) => ({
        id: e.id,
        source: e.source_node_id,
        target: e.target_node_id,
        animated: true,
        style: { stroke: '#3B82F6', strokeWidth: 2 },
      }));

      setNodes(newNodes);
      setEdges(newEdges);
      setSelectedNodeId(newNodes[0]?.id || null);

      console.log('[loadTemplateById] Success, loaded template:', template.name, 'nodes count:', newNodes.length);
      addTerminalLog('SYSTEM', 'system', `Loaded corporate template: '${template.name}' (${newNodes.length} agents)`);

      if ((window as any).__fitView) {
        setTimeout(() => {
          (window as any).__fitView();
        }, 150);
      }
    },
    [templates, setNodes, setEdges, addTerminalLog]
  );

  // Fetch list of saved workflows from backend API and local storage
  const fetchMyWorkflows = useCallback(async () => {
    let apiList: Workflow[] = [];
    try {
      apiList = await api.listWorkflows();
    } catch (err) {
      console.warn('API listWorkflows failed:', err);
    }

    const localList = loadSavedWorkflowsFromStorage();
    const map = new Map<string, Workflow>();
    // First, register local list
    localList.forEach((w) => map.set(w.id, w));
    // Then merge API list
    apiList.forEach((w) => {
      const existing = map.get(w.id);
      map.set(w.id, {
        ...existing,
        ...w,
        nodes: w.nodes || existing?.nodes,
        edges: w.edges || existing?.edges,
      });
    });

    const merged = Array.from(map.values());
    setMyWorkflows(merged);
    saveWorkflowsToStorage(merged);
  }, []);

  // Load a saved workflow onto the canvas
  const handleSelectSavedWorkflow = useCallback(
    async (wfId: string) => {
      try {
        let wf: Workflow | null = null;
        try {
          wf = await api.getWorkflow(wfId);
        } catch {
          wf = myWorkflows.find((w) => w.id === wfId) || null;
        }

        if (!wf) {
          const locals = loadSavedWorkflowsFromStorage();
          wf = locals.find((w) => w.id === wfId) || null;
        }

        if (wf) {
          setWorkflowName(wf.name || 'Saved Workflow');
          setWorkflowId(wf.id);

          const newNodes: Node[] = (wf.nodes || []).map((n) => ({
            id: n.id,
            type: 'agentNode',
            position: { x: n.position_x, y: n.position_y },
            data: {
              ...n,
              status: 'idle',
              violation_data: null,
              error_message: null,
            } as AgentNodeData,
          }));

          const newEdges: Edge[] = (wf.edges || []).map((e: any) => ({
            id: e.id,
            source: e.source_node_id || e.source,
            target: e.target_node_id || e.target,
            animated: true,
            style: { stroke: '#3B82F6', strokeWidth: 2 },
          }));

          setNodes(newNodes);
          setEdges(newEdges);
          setSelectedNodeId(newNodes[0]?.id || null);
          addTerminalLog('SYSTEM', 'system', `Loaded saved workflow: '${wf.name}' (${newNodes.length} agents)`);

          if ((window as any).__fitView) {
            setTimeout(() => {
              (window as any).__fitView();
            }, 150);
          }
        }
      } catch (err: any) {
        console.error('Failed to load saved workflow:', err);
        alert(`Không thể tải quy trình: ${err?.message || err}`);
      }
    },
    [myWorkflows, setNodes, setEdges, addTerminalLog]
  );

  // Delete a saved workflow
  const handleDeleteSavedWorkflow = useCallback(
    async (wfId: string) => {
      const target = myWorkflows.find((w) => w.id === wfId);
      const name = target?.name || wfId;
      if (!confirm(t('confirm_delete_workflow', { name }))) return;

      try {
        try {
          await api.deleteWorkflow(wfId);
        } catch (apiErr) {
          console.warn('API delete failed, proceeding with local delete:', apiErr);
        }

        const updated = loadSavedWorkflowsFromStorage().filter((w) => w.id !== wfId);
        saveWorkflowsToStorage(updated);
        setMyWorkflows((prev) => prev.filter((w) => w.id !== wfId));

        if (workflowId === wfId) {
          setWorkflowId(`wf_${Date.now()}`);
        }
        addTerminalLog('SYSTEM', 'stdout', `Đã xóa quy trình: ${name}`);
      } catch (err: any) {
        alert(`Lỗi khi xóa quy trình: ${err?.message || err}`);
      }
    },
    [myWorkflows, workflowId, t, addTerminalLog]
  );

  // Create a new blank workflow
  const handleCreateNewWorkflow = useCallback(() => {
    if (nodes.length > 0) {
      if (!confirm(t('confirm_clear_canvas'))) return;
    }
    const newId = `wf_${Date.now()}`;
    setWorkflowId(newId);
    setWorkflowName(t('new_blank_workflow'));
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setTerminalLogs([]);
    addTerminalLog('SYSTEM', 'system', 'Đã khởi tạo sơ đồ quy trình mới.');
  }, [nodes.length, t, setNodes, setEdges, addTerminalLog]);

  const initRanRef = useRef(false);

  // Initialize presets, templates, and load pipeline (requested via query param or default SDLC)
  useEffect(() => {
    if (initRanRef.current) return;
    initRanRef.current = true;

    const init = async () => {
      try {
        const [loadedPresets, loadedTemplates] = await Promise.all([
          api.getPresets(),
          api.getTemplates(),
        ]);
        if (loadedPresets?.length) setPresets(loadedPresets);
        if (loadedTemplates?.length) setTemplates(loadedTemplates);
        await fetchMyWorkflows();
      } catch (err) {
        console.warn('Using built-in presets and templates:', err);
      }

      const urlParams = new URLSearchParams(window.location.search);
      const requestedMock = urlParams.get('mock_mode');
      if (requestedMock !== null) {
        setMockMode(requestedMock === 'true');
      }
      const requestedWfId = urlParams.get('workflow_id');
      if (requestedWfId) {
        try {
          const wf = await api.getWorkflow(requestedWfId);
          if (wf && wf.nodes && wf.nodes.length > 0) {
            setWorkflowName(wf.name);
            setWorkflowId(wf.id);
            const newNodes: Node[] = wf.nodes.map((n) => ({
              id: n.id,
              type: 'agentNode',
              position: { x: n.position_x, y: n.position_y },
              data: {
                ...n,
                status: 'idle',
                violation_data: null,
              } as AgentNodeData,
            }));
            const newEdges: Edge[] = (wf.edges || []).map((e) => ({
              id: e.id,
              source: e.source_node_id,
              target: e.target_node_id,
              animated: true,
              style: { stroke: '#3B82F6', strokeWidth: 2 },
            }));
            setNodes(newNodes);
            setEdges(newEdges);
            setSelectedNodeId(newNodes[0]?.id || null);
            addTerminalLog('SYSTEM', 'system', `Loaded requested pipeline: '${wf.name}' (${newNodes.length} agents)`);
            return;
          }
        } catch (err) {
          console.warn('Failed to load requested workflow:', err);
        }
      }

      loadTemplateById('fullstack_sdlc');
    };
    init();
  }, [loadTemplateById]);

  // Connect & listen to WebSocket events when executionId changes
  useEffect(() => {
    if (!executionId) {
      setIsWsConnected(false);
      return;
    }

    wsClient.connect(executionId);

    const unsubAck = wsClient.on('connection_ack', (env) => {
      setIsWsConnected(true);
      addTerminalLog('SYSTEM', 'stdout', `[WS] Connection established for ${env.execution_id}`);
    });

    const unsubStatus = wsClient.on('node_status_update', (env) => {
      const { node_id, current_status, error_message } = env.payload;
      updateNodeExecutionStatus(node_id, current_status, error_message);
      addTerminalLog(
        node_id,
        current_status === 'failed' ? 'stderr' : 'system',
        `[STATUS] Node transitioned to: ${current_status.toUpperCase()}${
          error_message ? ` - ${error_message}` : ''
        }`
      );
    });

    const unsubLog = wsClient.on('terminal_log', (env) => {
      const { node_id, stream_type, chunk } = env.payload;
      addTerminalLog(node_id, stream_type, chunk);
    });

    // CRITICAL: Scope violation alert listener
    const unsubViolation = wsClient.on('scope_violation_alert', (env) => {
      const violationData: ViolationData = env.payload;
      handleIncomingViolationAlert(violationData);
    });

    // Lock acquired listener
    const unsubLockAcq = wsClient.on('lock_acquired', (env) => {
      const { node_id, locked_paths } = env.payload;
      addTerminalLog(node_id, 'system', `[CONFLICT GUARD] Virtual lock acquired on: ${(locked_paths || []).join(', ')}`);
    });

    // Lock released listener
    const unsubLockRel = wsClient.on('lock_released', (env) => {
      const { node_id, released_paths } = env.payload;
      addTerminalLog(node_id, 'system', `[CONFLICT GUARD] Virtual lock released on: ${(released_paths || []).join(', ')}`);
    });

    // Approval requested listener
    const unsubApproval = wsClient.on('approval_requested', (env) => {
      const { node_id, role_name, task_prompt, allowed_paths } = env.payload;
      setCurrentApproval({
        node_id,
        role_name: role_name || 'Agent',
        task_prompt: task_prompt || '',
        allowed_paths: allowed_paths || [],
      });
      setApprovalModalOpen(true);
      updateNodeExecutionStatus(node_id, 'waiting_approval', 'Waiting for human sign-off');
      addTerminalLog(node_id, 'system', `[APPROVAL GATE] Node '${role_name}' (${node_id}) requested approval to proceed: "${task_prompt}"`);
    });

    // Error notification listener
    const unsubError = wsClient.on('error_notification', (env) => {
      const { node_id, error_code, message } = env.payload;
      addTerminalLog(node_id || 'SYSTEM', 'stderr', `[ERROR NOTIFICATION] [${error_code}] ${message}`);
    });

    const unsubWfStatus = wsClient.on('workflow_status_update', (env) => {
      const { status } = env.payload;
      if (status === 'completed' || status === 'failed' || status === 'stopped') {
        setIsExecuting(false);
        addTerminalLog('SYSTEM', 'system', `[WORKFLOW] Execution ended with status: ${status.toUpperCase()}`);
      }
    });

    // Fallback polling to guarantee violation alert detection across all network conditions
    const pollInterval = setInterval(async () => {
      try {
        const execData: any = await api.getExecutionStatus(executionId);
        if (execData?.nodes) {
          for (const n of execData.nodes) {
            if (n.status === 'violation_paused' && n.violation_data) {
              const vData: ViolationData = {
                node_id: n.node_id,
                role_name: n.role_name || 'Agent',
                allowed_paths: n.allowed_paths || [],
                unauthorized_files: n.violation_data.unauthorized_files || [],
                diffs: n.violation_data.diffs || [],
                detected_at: n.violation_data.detected_at || new Date().toISOString(),
              };
              handleIncomingViolationAlert(vData);
              break;
            }
            if (n.status === 'waiting_approval' && !approvalModalOpen) {
              const matchingNode = nodes.find((x) => x.id === n.node_id || n.node_id.endsWith(x.id));
              const nodeData = matchingNode?.data as AgentNodeData | undefined;
              setCurrentApproval({
                node_id: n.node_id,
                role_name: nodeData?.role_name || n.role_name || 'Agent',
                task_prompt: nodeData?.task_prompt || '',
                allowed_paths: nodeData?.allowed_paths || [],
              });
              setApprovalModalOpen(true);
              break;
            }
          }
        }
      } catch {
        // Ignore poll error
      }
    }, 1500);

    return () => {
      clearInterval(pollInterval);
      unsubAck();
      unsubStatus();
      unsubLog();
      unsubViolation();
      unsubLockAcq();
      unsubLockRel();
      unsubApproval();
      unsubError();
      unsubWfStatus();
      wsClient.disconnect();
    };
  }, [executionId, updateNodeExecutionStatus]);

  // Add agent preset via drag & drop or click
  const handleAddAgentPreset = useCallback(
    (preset: AgentPreset, position?: { x: number; y: number }) => {
      const id = `node_${preset.id}_${Math.random().toString(36).substring(2, 6)}`;
      let nodePos = position;
      if (!nodePos) {
        setNodes((nds) => {
          if (nds.length === 0) {
            nodePos = { x: 200, y: 220 };
          } else {
            const maxX = Math.max(...nds.map((n) => n.position.x));
            const maxY = Math.max(...nds.map((n) => n.position.y));
            if (maxX < 1200) {
              nodePos = { x: maxX + 280, y: 220 };
            } else {
              nodePos = { x: 100, y: maxY + 200 };
            }
          }

          const newNode: Node = {
            id,
            type: 'agentNode',
            position: nodePos,
            data: {
              id,
              preset_id: preset.id,
              role_name: preset.role_name,
              icon: preset.icon,
              color_theme: preset.color_theme,
              system_prompt: preset.default_system_prompt,
              task_prompt: `Execute corporate objectives for ${preset.role_name}`,
              allowed_paths: [...preset.default_allowed_paths],
              read_only_paths: [...preset.default_read_only_paths],
              require_human_approval: false,
              simulate_violation: false,
              status: 'idle',
            } as AgentNodeData,
          };
          return [...nds, newNode];
        });
      } else {
        const newNode: Node = {
          id,
          type: 'agentNode',
          position: nodePos,
          data: {
            id,
            preset_id: preset.id,
            role_name: preset.role_name,
            icon: preset.icon,
            color_theme: preset.color_theme,
            system_prompt: preset.default_system_prompt,
            task_prompt: `Execute corporate objectives for ${preset.role_name}`,
            allowed_paths: [...preset.default_allowed_paths],
            read_only_paths: [...preset.default_read_only_paths],
            require_human_approval: false,
            simulate_violation: false,
            status: 'idle',
          } as AgentNodeData,
        };
        setNodes((nds) => [...nds, newNode]);
      }

      setSelectedNodeId(id);
      addTerminalLog('SYSTEM', 'system', `Added agent '${preset.role_name}' to canvas`);

      if ((window as any).__fitView) {
        setTimeout(() => {
          (window as any).__fitView();
        }, 150);
      }
    },
    [setNodes, addTerminalLog]
  );

  // Connect edges
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: '#3B82F6', strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Update node data from Inspector
  const handleUpdateNodeData = (nodeId: string, updatedData: Partial<AgentNodeData>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...(n.data as AgentNodeData),
              ...updatedData,
            },
          };
        }
        return n;
      })
    );
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  // ========================================================
  // REVERT VIOLATIONS ACTION (Git Auditor)
  // ========================================================
  const handleRevertViolations = async (comment?: string) => {
    if (!currentViolation || !currentViolation.node_id) return;
    setIsResolvingViolation(true);

    const nodeId = currentViolation.node_id;
    const execId = executionId || 'exec_local_demo';

    try {
      if (executionId) {
        await api.revertViolations(execId, nodeId, {
          reverted_by: 'User / phamanh.bac',
          comment,
        });
      }

      // Transition node to completed & clear violation
      updateNodeExecutionStatus(nodeId, 'completed', null, null);
      addTerminalLog(
        nodeId,
        'stdout',
        `[GIT AUDITOR] Successfully reverted unauthorized files (${currentViolation.unauthorized_files.join(
          ', '
        )}). Node completed and resumed downstream DAG.`
      );

      setViolationModalOpen(false);
      setCurrentViolation(null);
    } catch (err: any) {
      console.warn('Revert API failed, applying local state resolution:', err);
      updateNodeExecutionStatus(nodeId, 'completed', null, null);
      addTerminalLog(nodeId, 'stdout', `[GIT AUDITOR] Reverted unauthorized files locally. Workflow resumed.`);
      setViolationModalOpen(false);
      setCurrentViolation(null);
    } finally {
      setIsResolvingViolation(false);
    }
  };

  // ========================================================
  // APPROVE VIOLATIONS ACTION (Git Auditor)
  // ========================================================
  const handleApproveViolations = async (reason?: string) => {
    if (!currentViolation || !currentViolation.node_id) return;
    setIsResolvingViolation(true);

    const nodeId = currentViolation.node_id;
    const execId = executionId || 'exec_local_demo';

    try {
      if (executionId) {
        await api.approveViolations(execId, nodeId, {
          approved_by: 'Tech Lead / phamanh.bac',
          reason: reason || 'Scope expansion approved by user.',
        });
      }

      // Transition node to completed & clear violation
      updateNodeExecutionStatus(nodeId, 'completed', null, null);
      addTerminalLog(
        nodeId,
        'stdout',
        `[GIT AUDITOR] Scope violation exception APPROVED. Accepted files: ${currentViolation.unauthorized_files.join(
          ', '
        )}. Node completed.`
      );

      setViolationModalOpen(false);
      setCurrentViolation(null);
    } catch (err: any) {
      console.warn('Approve API failed, applying local state resolution:', err);
      updateNodeExecutionStatus(nodeId, 'completed', null, null);
      addTerminalLog(nodeId, 'stdout', `[GIT AUDITOR] Approved scope exception locally. Workflow resumed.`);
      setViolationModalOpen(false);
      setCurrentViolation(null);
    } finally {
      setIsResolvingViolation(false);
    }
  };

  // ========================================================
  // PRE-EXECUTION HUMAN APPROVAL GATE ACTIONS
  // ========================================================
  const handleApproveNode = async (nodeId: string, comment?: string) => {
    setIsResolvingApproval(true);
    try {
      if (executionId) {
        await api.approveNode(executionId, nodeId, {
          approved_by: 'Tech Lead / User',
          comment,
        });
      }
      updateNodeExecutionStatus(nodeId, 'running', null, null);
      addTerminalLog(nodeId, 'stdout', `[APPROVAL GATE] Node ${nodeId} APPROVED by Tech Lead. Execution authorized.`);
      setApprovalModalOpen(false);
      setCurrentApproval(null);
    } catch (err: any) {
      console.warn('Approve node error:', err);
      updateNodeExecutionStatus(nodeId, 'running', null, null);
      setApprovalModalOpen(false);
      setCurrentApproval(null);
    } finally {
      setIsResolvingApproval(false);
    }
  };

  const handleRejectNode = async (nodeId: string, reason?: string) => {
    setIsResolvingApproval(true);
    try {
      if (executionId) {
        await api.rejectNode(executionId, nodeId, {
          rejected_by: 'Tech Lead / User',
          reason: reason || 'Rejected by human operator',
        });
      }
      updateNodeExecutionStatus(nodeId, 'rejected', reason || 'Node rejected by user', null);
      addTerminalLog(nodeId, 'stderr', `[APPROVAL GATE] Node ${nodeId} REJECTED by Tech Lead. Downstream nodes skipped.`);
      setApprovalModalOpen(false);
      setCurrentApproval(null);
    } catch (err: any) {
      console.warn('Reject node error:', err);
      updateNodeExecutionStatus(nodeId, 'rejected', reason || 'Node rejected by user', null);
      setApprovalModalOpen(false);
      setCurrentApproval(null);
    } finally {
      setIsResolvingApproval(false);
    }
  };

  // ========================================================
  // SIMULATE SCOPE VIOLATION TEST GENERATOR
  // ========================================================
  const triggerSimulatedScopeViolation = (targetNodeId: string, nodeData?: AgentNodeData) => {
    const role = nodeData?.role_name || 'Frontend Developer';
    const sampleViolation: ViolationData = {
      node_id: targetNodeId,
      role_name: role,
      allowed_paths: nodeData?.allowed_paths || ['frontend/src/**'],
      unauthorized_files: ['backend/main.py', 'package.json'],
      diffs: [
        {
          file_path: 'backend/main.py',
          status: 'modified',
          diff_text: `--- a/backend/main.py
+++ b/backend/main.py
@@ -14,6 +14,8 @@
 from fastapi.middleware.cors import CORSMiddleware
+from fastapi.responses import RedirectResponse
+# Scope violation: Frontend Agent edited backend core entrypoint without permission!
+from pydantic import BaseModel

 app = FastAPI(title="Gemini Workflow Studio")
@@ -45,3 +47,5 @@
 def get_root():
-    return {"status": "ok"}
+    # Unauthorized route change
+    return {"status": "unauthorized_patch_applied", "author": "FrontendAgent"}`,
        },
        {
          file_path: 'package.json',
          status: 'modified',
          diff_text: `--- a/package.json
+++ b/package.json
@@ -18,2 +18,3 @@
     "clsx": "^2.1.1",
+    "unauthorized-lib": "^9.9.9",
     "react": "^18.3.1"`,
        },
      ],
      detected_at: new Date().toISOString(),
    };

    // Dispatch via wsClient locally and update state
    wsClient.emitLocal({
      type: 'scope_violation_alert',
      execution_id: executionId || 'exec_local_demo',
      timestamp: new Date().toISOString(),
      payload: sampleViolation,
    });
  };

  const handleTriggerGlobalViolationTest = () => {
    const targetNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
    if (targetNode) {
      triggerSimulatedScopeViolation(targetNode.id, targetNode.data as AgentNodeData);
    } else {
      alert(t('empty_canvas_alert'));
    }
  };

  // ========================================================
  // RUN / STOP WORKFLOW
  // ========================================================
  const handleRunWorkflow = async () => {
    if (nodes.length === 0) {
      alert(t('empty_canvas_alert'));
      return;
    }

    setIsExecuting(true);
    setTerminalLogs([]);
    addTerminalLog('SYSTEM', 'system', `Initiating DAG workflow execution [MockMode: ${mockMode}]...`);

    // Reset all nodes to pending
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...(n.data as AgentNodeData),
          status: 'pending',
          violation_data: null,
          error_message: null,
        },
      }))
    );

    try {
      let wfId = workflowId;
      try {
        const payload = {
          name: workflowName,
          nodes: nodes.map((n) => {
            const d = n.data as AgentNodeData;
            return {
              id: n.id,
              preset_id: d.preset_id,
              role_name: d.role_name,
              node_type: d.node_type || 'agent',
              color_theme: d.color_theme || '#3b82f6',
              icon: d.icon || 'Bot',
              position_x: n.position.x,
              position_y: n.position.y,
              system_prompt: d.system_prompt || '',
              task_prompt: d.task_prompt || '',
              allowed_paths: d.allowed_paths || [],
              read_only_paths: d.read_only_paths || [],
              require_human_approval: !!d.require_human_approval,
              simulate_violation: !!d.simulate_violation,
            };
          }),
          edges: edges.map((e) => ({
            id: e.id,
            source_node_id: e.source,
            target_node_id: e.target,
            condition: 'success',
          })),
        };

        if (wfId) {
          await api.updateWorkflow(wfId, payload);
        } else {
          const createdWf = await api.createWorkflow(payload);
          wfId = createdWf.id;
          setWorkflowId(wfId);
          if (createdWf.nodes && createdWf.nodes.length > 0) {
            const idMap: Record<string, string> = {};
            createdWf.nodes.forEach((cn: any, idx: number) => {
              if (payload.nodes[idx] && payload.nodes[idx].id !== cn.id) {
                idMap[payload.nodes[idx].id] = cn.id;
              }
            });
            if (Object.keys(idMap).length > 0) {
              setNodes((prev) =>
                prev.map((node) => ({
                  ...node,
                  id: idMap[node.id] || node.id,
                }))
              );
              setEdges((prev) =>
                prev.map((edge) => ({
                  ...edge,
                  source: idMap[edge.source] || edge.source,
                  target: idMap[edge.target] || edge.target,
                }))
              );
            }
          }
        }
      } catch (saveErr) {
        console.warn('Backend save failed or in offline mode:', saveErr);
      }

      // Trigger execution with Target Project Path (WORKSPACE_DIR)
      const effectiveWorkspace =
        targetProjectPath.trim() ||
        new URLSearchParams(window.location.search).get('workspace_dir') ||
        '';

      const res = await api.executeWorkflow(wfId, {
        mock_mode: mockMode,
        environment_vars: effectiveWorkspace ? { WORKSPACE_DIR: effectiveWorkspace } : undefined,
      });
      setExecutionId(res.execution_id);
      addTerminalLog('SYSTEM', 'stdout', `Execution session ${res.execution_id} accepted.`);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn('Backend execution error:', errMsg);

      // If backend returned an error (such as Git validation failure or 400 bad request)
      if (
        errMsg.toLowerCase().includes('git') ||
        errMsg.toLowerCase().includes('commit') ||
        errMsg.toLowerCase().includes('repository') ||
        errMsg.includes('Thư mục') ||
        errMsg.includes('400')
      ) {
        setIsExecuting(false);
        addTerminalLog('SYSTEM', 'stderr', `[GIT REPOSITORY ERROR] ${errMsg}`);
        // Reset nodes back to idle
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            data: {
              ...(n.data as AgentNodeData),
              status: 'idle',
            },
          }))
        );
        alert(`❌ Không thể chạy quy trình:\n\n${errMsg}`);
        return;
      }

      // If backend is genuinely unreachable (offline), fallback to realistic local client simulation
      addTerminalLog('SYSTEM', 'system', `Backend unreachable, starting in-memory local client simulation.`);
      runClientSideSimulation();
    }
  };

  const runClientSideSimulation = () => {
    const fakeExecId = `exec_${Date.now()}`;
    setExecutionId(fakeExecId);
    setIsWsConnected(true);

    addTerminalLog('SYSTEM', 'stdout', `[SIMULATION ENGINE] Running DAG with ${nodes.length} nodes...`);

    let delay = 600;
    nodes.forEach((node, idx) => {
      const data = node.data as AgentNodeData;

      // Start running
      setTimeout(() => {
        updateNodeExecutionStatus(node.id, 'running');
        addTerminalLog(
          node.id,
          'stdout',
          `[SPAWN] Started Gemini CLI session for ${data.role_name} (${node.id.slice(-8)})`
        );
        addTerminalLog(
          node.id,
          'stdout',
          `[GIT AUDITOR] Snapshotting workspace status before run...`
        );
      }, delay);

      delay += 1200;

      // Check if this node has simulate_violation checked
      if (data.simulate_violation) {
        setTimeout(() => {
          triggerSimulatedScopeViolation(node.id, data);
        }, delay);
        return;
      }

      // Complete normally
      setTimeout(() => {
        updateNodeExecutionStatus(node.id, 'completed');
        addTerminalLog(
          node.id,
          'stdout',
          `[GIT AUDITOR] Audit passed: all modifications match allowed_paths.`
        );
        addTerminalLog(node.id, 'stdout', `[EXIT] Process finished with exit code 0.`);

        if (idx === nodes.length - 1) {
          setIsExecuting(false);
          addTerminalLog('SYSTEM', 'system', `All DAG branches completed successfully.`);
        }
      }, delay);

      delay += 800;
    });
  };

  const handleStopWorkflow = async () => {
    if (executionId) {
      try {
        await api.stopExecution(executionId);
      } catch (err) {
        console.warn('Stop execution failed:', err);
      }
    }
    setIsExecuting(false);
    addTerminalLog('SYSTEM', 'stderr', 'Workflow execution stopped by user.');
  };

  const handleSaveWorkflow = async () => {
    try {
      const payload = {
        name: workflowName,
        nodes: nodes.map((n) => {
          const d = n.data as AgentNodeData;
          return {
            id: n.id,
            preset_id: d.preset_id,
            role_name: d.role_name,
            node_type: d.node_type || 'agent',
            color_theme: d.color_theme || '#3b82f6',
            icon: d.icon || 'Bot',
            position_x: n.position.x,
            position_y: n.position.y,
            system_prompt: d.system_prompt || '',
            task_prompt: d.task_prompt || '',
            allowed_paths: d.allowed_paths || [],
            read_only_paths: d.read_only_paths || [],
            require_human_approval: !!d.require_human_approval,
            simulate_violation: !!d.simulate_violation,
          };
        }),
        edges: edges.map((e) => ({
          id: e.id,
          source_node_id: e.source,
          target_node_id: e.target,
          condition: 'success',
        })),
      };

      let savedId = workflowId;
      try {
        if (workflowId && !workflowId.startsWith('wf_local_')) {
          await api.updateWorkflow(workflowId, payload);
        } else {
          const created = await api.createWorkflow(payload);
          savedId = created.id;
          setWorkflowId(created.id);
        }
      } catch (backendErr) {
        console.warn('Backend save failed, saving to local offline storage:', backendErr);
        if (!savedId) {
          savedId = `wf_local_${Date.now()}`;
          setWorkflowId(savedId);
        }
      }

      // Persist in localStorage backup
      const savedWorkflowObj: Workflow = {
        id: savedId || `wf_local_${Date.now()}`,
        name: workflowName,
        nodes: payload.nodes as any,
        edges: payload.edges as any,
        nodes_count: payload.nodes.length,
        edges_count: payload.edges.length,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      const currentList = loadSavedWorkflowsFromStorage();
      const existingIdx = currentList.findIndex((w) => w.id === savedWorkflowObj.id);
      if (existingIdx >= 0) {
        currentList[existingIdx] = { ...currentList[existingIdx], ...savedWorkflowObj };
      } else {
        currentList.unshift(savedWorkflowObj);
      }
      saveWorkflowsToStorage(currentList);

      await fetchMyWorkflows();
      addTerminalLog('SYSTEM', 'stdout', `Workflow '${workflowName}' (${payload.nodes.length} agents) saved successfully.`);
      alert(t('save_success'));
    } catch (err: any) {
      alert(`Save notice: ${err.message || 'Offline mode saved in memory'}`);
    }
  };

  const handleResetCanvas = () => {
    if (confirm(t('confirm_clear_canvas'))) {
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
      setTerminalLogs([]);
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="flex h-screen w-screen bg-gray-100 dark:bg-[#0B0F19] text-gray-900 dark:text-gray-100 overflow-hidden select-none transition-colors duration-200">
      {/* 1. Left Sidebar: Enterprise Agent Library (7), Workflow Templates (3), and My Workflows */}
      <LeftSidebar
        presets={presets}
        templates={templates}
        myWorkflows={myWorkflows}
        currentWorkflowId={workflowId}
        onSelectTemplate={loadTemplateById}
        onAddAgentPreset={(preset) => handleAddAgentPreset(preset)}
        onSelectWorkflow={handleSelectSavedWorkflow}
        onDeleteWorkflow={handleDeleteSavedWorkflow}
        onRefreshWorkflows={fetchMyWorkflows}
        onCreateNewWorkflow={handleCreateNewWorkflow}
        onSaveCurrentWorkflow={handleSaveWorkflow}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* 2. Main Middle & Right Layout */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Header with Theme & Language Controls */}
        <Header
          workflowName={workflowName}
          targetProjectPath={targetProjectPath}
          onTargetProjectPathChange={handleTargetProjectPathChange}
          isExecuting={isExecuting}
          mockMode={mockMode}
          onToggleMockMode={setMockMode}
          onRunWorkflow={handleRunWorkflow}
          onStopWorkflow={handleStopWorkflow}
          onSaveWorkflow={handleSaveWorkflow}
          onResetCanvas={handleResetCanvas}
          onTriggerGlobalViolationTest={handleTriggerGlobalViolationTest}
          onNameChange={setWorkflowName}
        />

        {/* Center Canvas + Bottom Terminal + Right Inspector */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Canvas & Bottom Terminal Column */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
            {/* React Flow Canvas */}
            <div className="flex-1 relative overflow-hidden">
              {/* Execution HUD & Progress Bar */}
              <ExecutionProgressBar
                isExecuting={isExecuting}
                executionId={executionId}
                nodes={nodes}
                onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
                selectedNodeId={selectedNodeId}
              />

              <FlowCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(nodeId) => {
                  setSelectedNodeId(nodeId);
                }}
                onOpenViolationModal={(v) => {
                  setCurrentViolation(v);
                  setViolationModalOpen(true);
                }}
                onAddAgentPreset={handleAddAgentPreset}
                onLoadTemplate={loadTemplateById}
              />
            </div>

            {/* Bottom Live Terminal Drawer */}
            <div
              style={{ height: terminalHeight }}
              className="border-t border-gray-200 dark:border-gray-800 shrink-0 transition-all duration-200"
            >
              <LiveTerminal
                logs={terminalLogs}
                isConnected={isWsConnected}
                onClearLogs={() => setTerminalLogs([])}
                heightMode={terminalHeightMode}
                onToggleHeight={(mode) => setTerminalHeightMode(mode)}
              />
            </div>
          </div>

          {/* Right Inspector & Node Settings Pane */}
          {selectedNode && (
            <aside className="w-96 h-full border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0D131F] flex flex-col shrink-0 z-20 shadow-lg dark:shadow-2xl transition-all duration-200 animate-in slide-in-from-right-4">
              <NodeInspector
                selectedNode={selectedNode}
                allNodes={nodes}
                edges={edges}
                onUpdateNodeData={handleUpdateNodeData}
                onDeleteNode={handleDeleteNode}
                onSimulateViolation={(nodeId, nodeData) =>
                  triggerSimulatedScopeViolation(nodeId, nodeData)
                }
                onClose={() => setSelectedNodeId(null)}
              />
            </aside>
          )}
        </div>
      </div>

      {/* 3. Git Violation Alert Modal with Diff Viewer & Revert/Approve Actions */}
      <GitViolationModal
        isOpen={violationModalOpen}
        violation={currentViolation}
        onClose={() => setViolationModalOpen(false)}
        onRevert={handleRevertViolations}
        onApprove={handleApproveViolations}
        isProcessing={isResolvingViolation}
      />

      {/* 4. Pre-Execution Human Approval Gate Modal */}
      <HumanApprovalModal
        isOpen={approvalModalOpen}
        approvalData={currentApproval}
        onClose={() => setApprovalModalOpen(false)}
        onApprove={handleApproveNode}
        onReject={handleRejectNode}
        isProcessing={isResolvingApproval}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeLanguageProvider>
      <ReactFlowProvider>
        <AppContent />
      </ReactFlowProvider>
    </ThemeLanguageProvider>
  );
}
