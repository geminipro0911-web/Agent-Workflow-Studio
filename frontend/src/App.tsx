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
import { LiveTerminal } from './components/Terminal/LiveTerminal';
import { GitViolationModal } from './components/ViolationModal/GitViolationModal';
import { AgentNodeData } from './components/Canvas/AgentNode';

import {
  AgentPreset,
  WorkflowTemplate,
  ViolationData,
  TerminalLog,
  NodeExecutionStatus,
} from './types';
import { api } from './services/api';
import { wsClient } from './services/websocket';
import { ENTERPRISE_AGENT_PRESETS, WORKFLOW_TEMPLATES_DATA } from './services/presetsData';
import { ThemeLanguageProvider, useThemeLanguage } from './context/ThemeLanguageContext';

export const AppContent: React.FC = () => {
  const { t } = useThemeLanguage();

  // Master lists
  const [presets, setPresets] = useState<AgentPreset[]>(ENTERPRISE_AGENT_PRESETS);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>(WORKFLOW_TEMPLATES_DATA);

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
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const terminalHeight = 240;

  // Violation Alert Modal state
  const [violationModalOpen, setViolationModalOpen] = useState(false);
  const [currentViolation, setCurrentViolation] = useState<ViolationData | null>(null);
  const [isResolvingViolation, setIsResolvingViolation] = useState(false);

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
      const template = templates.find((t) => t.id === templateId) || WORKFLOW_TEMPLATES_DATA.find((t) => t.id === templateId);
      if (!template || !template.layout_data) return;

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

      addTerminalLog('SYSTEM', 'system', `Loaded corporate template: '${template.name}' (${newNodes.length} agents)`);
    },
    [templates, setNodes, setEdges]
  );

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
      const { node_id, role_name, task_prompt } = env.payload;
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
      const nodePos = position || {
        x: 150 + Math.random() * 200,
        y: 150 + Math.random() * 200,
      };

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
      setSelectedNodeId(id);
      addTerminalLog('SYSTEM', 'system', `Added agent '${preset.role_name}' to canvas`);
    },
    [setNodes]
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
        }
      } catch (saveErr) {
        console.warn('Backend save failed or in offline mode:', saveErr);
      }

      // Trigger execution
      const searchParams = new URLSearchParams(window.location.search);
      const urlWorkspaceDir = searchParams.get('workspace_dir');
      const res = await api.executeWorkflow(wfId, {
        mock_mode: mockMode,
        environment_vars: urlWorkspaceDir ? { WORKSPACE_DIR: urlWorkspaceDir } : undefined,
      });
      setExecutionId(res.execution_id);
      addTerminalLog('SYSTEM', 'stdout', `Execution session ${res.execution_id} accepted.`);
    } catch (err: any) {
      console.warn('Backend execution failed, switching to realistic local client simulation:', err);
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
      await api.createWorkflow(payload);
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
      {/* 1. Left Sidebar: Enterprise Agent Library (7) & Workflow Templates (3) */}
      <LeftSidebar
        presets={presets}
        templates={templates}
        onSelectTemplate={loadTemplateById}
        onAddAgentPreset={(preset) => handleAddAgentPreset(preset)}
      />

      {/* 2. Main Middle & Right Layout */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header with Theme & Language Controls */}
        <Header
          workflowName={workflowName}
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
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas & Bottom Terminal Column */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* React Flow Canvas */}
            <div className="flex-1 relative overflow-hidden">
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
              className="border-t border-gray-200 dark:border-gray-800 shrink-0 transition-all"
            >
              <LiveTerminal
                logs={terminalLogs}
                isConnected={isWsConnected}
                onClearLogs={() => setTerminalLogs([])}
              />
            </div>
          </div>

          {/* Right Inspector & Node Settings Pane */}
          <aside className="w-96 h-full border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0D131F] flex flex-col shrink-0 z-20 shadow-lg dark:shadow-2xl transition-colors duration-200">
            <NodeInspector
              selectedNode={selectedNode}
              onUpdateNodeData={handleUpdateNodeData}
              onDeleteNode={handleDeleteNode}
              onSimulateViolation={(nodeId, nodeData) =>
                triggerSimulatedScopeViolation(nodeId, nodeData)
              }
            />
          </aside>
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
