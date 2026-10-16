import { WSEnvelope } from '../types';

type MessageHandler = (envelope: WSEnvelope) => void;

export class ExecutionWebSocketClient {
  private socket: WebSocket | null = null;
  private executionId: string | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private pingInterval: any = null;
  private reconnectTimeout: any = null;
  private shouldReconnect = true;

  constructor() {
    this.handleOpen = this.handleOpen.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  public connect(executionId: string) {
    if (this.socket && this.executionId === executionId && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    this.disconnect();
    this.executionId = executionId;
    this.shouldReconnect = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use window.location.host so Vite proxy (/ws) handles it seamlessly
    const wsUrl = `${protocol}//${window.location.host}/ws/executions/${executionId}`;

    try {
      this.socket = new WebSocket(wsUrl);
      this.socket.onopen = this.handleOpen;
      this.socket.onmessage = this.handleMessage;
      this.socket.onclose = this.handleClose;
      this.socket.onerror = this.handleError;
    } catch (err) {
      console.warn('WebSocket connection error:', err);
    }
  }

  public disconnect() {
    this.shouldReconnect = false;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.executionId = null;
  }

  public on(eventType: string, handler: MessageHandler): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);

    return () => {
      this.listeners.get(eventType)?.delete(handler);
    };
  }

  public emitLocal(envelope: WSEnvelope) {
    // Allows local simulation of WS events (e.g., Simulate Scope Violation button)
    this.dispatchEnvelope(envelope);
  }

  private handleOpen() {
    console.log(`[WebSocket] Connected to execution ${this.executionId}`);
    // Start heartbeat
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 15000);
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data: WSEnvelope = JSON.parse(event.data);
      this.dispatchEnvelope(data);
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e, event.data);
    }
  }

  private dispatchEnvelope(data: WSEnvelope) {
    // Notify specific event listeners
    const handlers = this.listeners.get(data.type);
    if (handlers) {
      handlers.forEach((h) => h(data));
    }
    // Also notify wildcard '*' listeners
    const allHandlers = this.listeners.get('*');
    if (allHandlers) {
      allHandlers.forEach((h) => h(data));
    }
  }

  private handleClose(e: CloseEvent) {
    console.log('[WebSocket] Connection closed:', e.code, e.reason);
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.shouldReconnect && this.executionId) {
      const execId = this.executionId;
      this.reconnectTimeout = setTimeout(() => {
        if (this.shouldReconnect && this.executionId === execId) {
          console.log('[WebSocket] Attempting reconnection...');
          this.connect(execId);
        }
      }, 3000);
    }
  }

  private handleError(e: Event) {
    console.warn('[WebSocket] Error occurred:', e);
  }
}

export const wsClient = new ExecutionWebSocketClient();
