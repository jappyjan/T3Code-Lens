// ── T3Code WebSocket RPC Client ─────────────────────────────────────
// Implements the Effect RPC wire protocol used by T3Code's server.
//
// Client → Server:
//   { _tag: "Request", id: "1", tag: "method.name", payload: {...} }
//   { _tag: "Ping" }
//
// Server → Client:
//   { _tag: "Chunk", requestId: "1", values: [...] }
//   { _tag: "Exit", requestId: "1", exit: { _tag: "Success", value: ... } }
//   { _tag: "Defect", defect: ... }
//   { _tag: "Pong" }

type RequestId = string;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  onChunk?: (values: unknown[]) => void;
}

export class T3Rpc {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<RequestId, PendingRequest>();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 8;
  private baseReconnectDelay = 1000;

  private wsUrl: string;
  private wsToken: string;

  public onDisconnect?: () => void;
  public onReconnect?: () => void;

  constructor(wsUrl: string, wsToken: string) {
    this.wsUrl = wsUrl;
    this.wsToken = wsToken;
  }

  connect(): Promise<void> {
    // Detect mixed-content before attempting the connection.
    if (
      typeof location !== 'undefined' &&
      location.protocol === 'https:' &&
      this.wsUrl.startsWith('ws://')
    ) {
      return Promise.reject(
        new Error(
          `Mixed content blocked: HTTPS page cannot open ws:// WebSocket. ` +
          `Use Tailscale Funnel for HTTPS.`,
        ),
      );
    }

    return new Promise((resolve, reject) => {
      const url = new URL(this.wsUrl);
      url.searchParams.set('wsToken', this.wsToken);

      let connected = false;
      this.ws = new WebSocket(url.toString());

      this.ws.onopen = () => {
        connected = true;
        this.reconnectAttempts = 0;
        this.startPing();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data as string);
      };

      this.ws.onerror = () => {
        if (!connected) {
          reject(new Error('WebSocket connection failed — check the server URL'));
        }
      };

      this.ws.onclose = () => {
        this.stopPing();
        this.onDisconnect?.();
        if (connected) {
          this.attemptReconnect();
        }
      };
    });
  }

  disconnect() {
    this.maxReconnectAttempts = 0;
    this.stopPing();
    this.ws?.close();
    this.ws = null;
    for (const [, req] of this.pending) {
      req.reject(new Error('Disconnected'));
    }
    this.pending.clear();
  }

  async request<T = unknown>(tag: string, payload: Record<string, unknown> = {}): Promise<T> {
    const id = String(this.nextId++);
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.send({ _tag: 'Request', id, tag, payload, headers: [] });
    });
  }

  subscribe(
    tag: string,
    payload: Record<string, unknown>,
    onChunk: (values: unknown[]) => void,
  ): { id: RequestId; cancel: () => void } {
    const id = String(this.nextId++);
    this.pending.set(id, { resolve: () => {}, reject: () => {}, onChunk });
    this.send({ _tag: 'Request', id, tag, payload });

    return {
      id,
      cancel: () => {
        this.pending.delete(id);
      },
    };
  }

  updateToken(wsToken: string) {
    this.wsToken = wsToken;
  }

  // ── Private ──────────────────────────────────────────────────────

  private send(msg: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(data: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (msg._tag) {
      case 'Pong':
        break;

      case 'Chunk': {
        const req = this.pending.get(msg.requestId as string);
        if (req?.onChunk) {
          req.onChunk(msg.values as unknown[]);
        }
        break;
      }

      case 'Exit': {
        const id = msg.requestId as string;
        const req = this.pending.get(id);
        if (req) {
          this.pending.delete(id);
          const exit = msg.exit as Record<string, unknown>;
          if (exit._tag === 'Success') {
            req.resolve(exit.value);
          } else {
            req.reject(new Error(JSON.stringify(exit.cause)));
          }
        }
        break;
      }

      case 'Defect': {
        // Server-level defect — not tied to a specific request
        console.warn('T3Code server defect:', msg.defect);
        break;
      }
    }
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send({ _tag: 'Ping' });
    }, 30_000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      64_000,
    );
    this.reconnectAttempts++;

    setTimeout(() => {
      this.connect()
        .then(() => this.onReconnect?.())
        .catch(() => this.attemptReconnect());
    }, delay);
  }
}
