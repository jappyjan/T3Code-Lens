// ── T3Code WebSocket RPC Client ─────────────────────────────────────
// Implements the Effect RPC wire protocol used by T3Code's server.

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
    // HTTPS pages cannot open ws:// sockets — browsers block it.
    if (
      typeof location !== 'undefined' &&
      location.protocol === 'https:' &&
      this.wsUrl.startsWith('ws://')
    ) {
      const parsed = new URL(this.wsUrl.replace(/^ws/, 'http'));
      const port = parsed.port || '3773';
      return Promise.reject(
        new Error(
          `Mixed content blocked: this page is served over HTTPS but the ` +
          `T3Code server at ${parsed.host} is plain HTTP. ` +
          `Browsers do not allow insecure WebSocket (ws://) connections from ` +
          `secure pages.\n\n` +
          `Fix: serve T3Code over HTTPS. If you use Tailscale, run:\n` +
          `  tailscale serve --bg --https=${port} http://127.0.0.1:${port}\n` +
          `Then connect using your https://<machine>.ts.net:${port} URL.`,
        ),
      );
    }

    return new Promise((resolve, reject) => {
      const url = new URL(this.wsUrl);
      url.searchParams.set('token', this.wsToken);

      this.ws = new WebSocket(url.toString());

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.startPing();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data as string);
      };

      this.ws.onerror = () => {
        reject(new Error('WebSocket connection error'));
      };

      this.ws.onclose = () => {
        this.stopPing();
        this.onDisconnect?.();
        // Don't reconnect if the initial connect was rejected (e.g. mixed content)
        if (this.reconnectAttempts >= 0) {
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
      this.send({ _tag: 'Request', id, tag, payload });
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
        this.send({ _tag: 'Interrupt', requestId: id, interruptors: ['user'] });
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

      case 'ResponseChunk': {
        const req = this.pending.get(msg.requestId as string);
        if (req?.onChunk) {
          req.onChunk(msg.values as unknown[]);
          this.send({ _tag: 'Ack', requestId: msg.requestId });
        }
        break;
      }

      case 'ResponseExit': {
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

      case 'ResponseDefect': {
        const id = msg.requestId as string;
        const req = this.pending.get(id);
        if (req) {
          this.pending.delete(id);
          req.reject(new Error('Server defect'));
        }
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
