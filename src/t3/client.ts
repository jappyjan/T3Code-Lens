// ── T3Code High-Level Client ────────────────────────────────────────
// Wraps the RPC layer with typed methods for orchestration, projects,
// threads, and message dispatch.

import { T3Rpc } from './rpc';
import type {
  T3Project,
  T3Thread,
  T3Message,
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
  public onThreadEvent?: (threadId: string, events: unknown[]) => void;
  public onConnectionChange?: (connected: boolean) => void;

  private shellSub?: { cancel: () => void };
  private threadSubs = new Map<string, { cancel: () => void }>();

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
    // If that fails (e.g. CORS when hosted on a different origin),
    // fall back to connecting with the bearer session token directly.
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
      this.resubscribe();
    };
    await this.rpc.connect();
    this.onConnectionChange?.(true);
  }

  private resubscribe() {
    if (this.shellSub) this.subscribeShell();
    for (const threadId of this.threadSubs.keys()) {
      this.subscribeThread(threadId);
    }
  }

  // ── Shell Subscription (projects + threads list) ─────────────────

  subscribeShell() {
    if (!this.rpc) return;
    this.shellSub?.cancel();
    this.shellSub = this.rpc.subscribe(
      'orchestration.subscribeShell',
      {},
      (values) => {
        for (const value of values) this.handleShellEvent(value);
      },
    );
  }

  private handleShellEvent(event: unknown) {
    const e = event as Record<string, unknown>;
    // Shell events can arrive as a full snapshot or incremental updates
    const data = (e.data ?? e) as Record<string, unknown>;
    if (data.projects || data.threads) {
      this.onShellUpdate?.({
        projects: (data.projects as T3Project[]) ?? [],
        threads: (data.threads as T3Thread[]) ?? [],
      });
    }
  }

  // ── Thread Subscription (messages + events) ──────────────────────

  subscribeThread(threadId: string) {
    if (!this.rpc) return;
    this.threadSubs.get(threadId)?.cancel();

    const sub = this.rpc.subscribe(
      'orchestration.subscribeThread',
      { threadId },
      (values) => this.onThreadEvent?.(threadId, values),
    );
    this.threadSubs.set(threadId, sub);
  }

  unsubscribeThread(threadId: string) {
    this.threadSubs.get(threadId)?.cancel();
    this.threadSubs.delete(threadId);
  }

  // ── Commands ─────────────────────────────────────────────────────

  private async dispatch(command: Record<string, unknown>): Promise<unknown> {
    if (!this.rpc) throw new Error('Not connected');
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

  // ── Lifecycle ────────────────────────────────────────────────────

  disconnect() {
    this.shellSub?.cancel();
    for (const sub of this.threadSubs.values()) sub.cancel();
    this.threadSubs.clear();
    this.rpc?.disconnect();
    this.rpc = null;
    this.onConnectionChange?.(false);
  }
}
