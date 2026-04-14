// ── T3Code High-Level Client ────────────────────────────────────────
// Wraps the RPC layer with typed methods for orchestration, projects,
// threads, and message dispatch.
//
// Uses Effect RPC protocol:
//   - Request/response for getSnapshot, dispatchCommand
//   - Streaming subscription for domain events

import { T3Rpc } from './rpc';
import type {
  T3ShellSnapshot,
  ModelSelection,
  RuntimeMode,
  InteractionMode,
} from './types';

function uuid(): string {
  return crypto.randomUUID();
}
function now(): string {
  return new Date().toISOString();
}

export class T3Client {
  private rpc: T3Rpc | null = null;
  private serverUrl = '';
  private sessionToken = '';

  public onShellUpdate?: (snapshot: T3ShellSnapshot) => void;
  public onDomainEvent?: (event: unknown) => void;
  public onConnectionChange?: (connected: boolean) => void;

  private domainEventSub?: { cancel: () => void };

  // ── Authentication ───────────────────────────────────────────────

  async authenticate(serverUrl: string, pairingToken: string): Promise<string> {
    this.serverUrl = serverUrl.replace(/\/$/, '');

    const res = await fetch(`${this.serverUrl}/api/auth/bootstrap/bearer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: pairingToken }),
    });

    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
    const data = await res.json();
    this.sessionToken = data.sessionToken;
    return this.sessionToken;
  }

  async connectWithToken(serverUrl: string, sessionToken: string): Promise<void> {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.sessionToken = sessionToken;
    await this.connectWebSocket();
  }

  // ── WebSocket ────────────────────────────────────────────────────

  private async getWsToken(): Promise<string> {
    const res = await fetch(`${this.serverUrl}/api/auth/ws-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.sessionToken}` },
    });
    if (!res.ok) throw new Error(`WS token request failed: ${res.status}`);
    const data = await res.json();
    return data.token;
  }

  private async connectWebSocket(): Promise<void> {
    const wsUrl = this.serverUrl.replace(/^http/, 'ws') + '/ws';

    // Try to get a short-lived WS token via HTTP first.
    let token = this.sessionToken;
    try {
      token = await this.getWsToken();
    } catch {
      // CORS or network error — fall back to session token
    }

    this.rpc = new T3Rpc(wsUrl, token);
    this.rpc.onDisconnect = () => this.onConnectionChange?.(false);
    this.rpc.onReconnect = () => {
      this.onConnectionChange?.(true);
      this.subscribeAndLoad();
    };
    await this.rpc.connect();
    this.onConnectionChange?.(true);

    this.subscribeAndLoad();
  }

  private subscribeAndLoad() {
    // Subscribe to domain events (streaming RPC)
    this.domainEventSub?.cancel();
    if (this.rpc) {
      this.domainEventSub = this.rpc.subscribe(
        'subscribeOrchestrationDomainEvents',
        {},
        (values) => {
          for (const value of values) {
            this.onDomainEvent?.(value);
          }
        },
      );
    }

    // Load initial snapshot
    this.loadSnapshot();
  }

  private async loadSnapshot() {
    if (!this.rpc) return;
    try {
      const snapshot = await this.rpc.request<T3ShellSnapshot>(
        'orchestration.getSnapshot',
      );
      if (snapshot) {
        this.onShellUpdate?.(snapshot);
      }
    } catch (err) {
      console.warn('Failed to load snapshot:', err);
    }
  }

  // ── Commands ─────────────────────────────────────────────────────

  private async dispatch(command: Record<string, unknown>): Promise<unknown> {
    if (!this.rpc) throw new Error('Not connected');
    // The dispatchCommand RPC payload IS the command (not wrapped in { command })
    return this.rpc.request('orchestration.dispatchCommand', command);
  }

  async createProject(title: string, workspaceRoot: string): Promise<string> {
    const projectId = uuid();
    await this.dispatch({
      type: 'project.create',
      commandId: uuid(),
      projectId,
      title,
      workspaceRoot,
      createdAt: now(),
    });
    return projectId;
  }

  async createThread(
    projectId: string,
    title: string,
    options?: {
      model?: ModelSelection;
      runtimeMode?: RuntimeMode;
      interactionMode?: InteractionMode;
    },
  ): Promise<string> {
    const threadId = uuid();
    await this.dispatch({
      type: 'thread.create',
      commandId: uuid(),
      threadId,
      projectId,
      title,
      modelSelection: options?.model ?? { provider: 'claudeAgent', model: 'claude-sonnet-4-6' },
      runtimeMode: options?.runtimeMode ?? 'auto-accept-edits',
      interactionMode: options?.interactionMode ?? 'default',
      branch: null,
      worktreePath: null,
      createdAt: now(),
    });
    return threadId;
  }

  async sendMessage(
    threadId: string,
    text: string,
    options?: {
      runtimeMode?: RuntimeMode;
      interactionMode?: InteractionMode;
      modelSelection?: ModelSelection;
    },
  ): Promise<void> {
    await this.dispatch({
      type: 'thread.turn.start',
      commandId: uuid(),
      threadId,
      message: {
        messageId: uuid(),
        role: 'user',
        text,
        attachments: [],
      },
      runtimeMode: options?.runtimeMode ?? 'auto-accept-edits',
      interactionMode: options?.interactionMode ?? 'default',
      ...(options?.modelSelection ? { modelSelection: options.modelSelection } : {}),
      createdAt: now(),
    });
  }

  async interruptTurn(threadId: string): Promise<void> {
    await this.dispatch({
      type: 'thread.turn.interrupt',
      commandId: uuid(),
      threadId,
      createdAt: now(),
    });
  }

  async setInteractionMode(threadId: string, mode: InteractionMode): Promise<void> {
    await this.dispatch({
      type: 'thread.interaction-mode.set',
      commandId: uuid(),
      threadId,
      interactionMode: mode,
      createdAt: now(),
    });
  }

  async respondToApproval(
    threadId: string,
    requestId: string,
    decision: 'allow' | 'deny',
  ): Promise<void> {
    await this.dispatch({
      type: 'thread.approval.respond',
      commandId: uuid(),
      threadId,
      requestId,
      decision,
      createdAt: now(),
    });
  }

  // ── Queries ──────────────────────────────────────────────────────

  async getSnapshot(): Promise<T3ShellSnapshot | null> {
    if (!this.rpc) return null;
    return this.rpc.request<T3ShellSnapshot>('orchestration.getSnapshot');
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  disconnect() {
    this.domainEventSub?.cancel();
    this.rpc?.disconnect();
    this.rpc = null;
    this.onConnectionChange?.(false);
  }
}
