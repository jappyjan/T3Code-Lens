// ── Type stubs for even-toolkit ─────────────────────────────────────
// The even-toolkit package is available at runtime inside the Even Hub
// WebView but may not be installed during CI builds. These declarations
// let TypeScript compile without the package present.

declare module 'even-toolkit/glasses' {
  export class EvenHubBridge {
    init(): Promise<void>;
    sendTextPage?(lines: string[]): void;
    showText?(text: string): void;
    sendPage?(mode: string, content: Record<string, unknown>): void;
    onEvent?(handler: (event: unknown) => void): void;
    addEventListener?(event: string, handler: () => void): void;
    shutdown?(): void;
  }

  export function mapGlassEvent(event: unknown): {
    type: string;
    direction?: string;
  } | null;
}

declare module 'even-toolkit/stt' {
  export class STTEngine {
    constructor(config: {
      provider: unknown;
      onTranscript: (result: { text: string; isFinal: boolean }) => void;
      onError: (err: { message?: string }) => void;
      onEnd: () => void;
    });
    start(): Promise<void>;
    stop(): void;
  }

  export function createProvider(
    name: string,
    config: { apiKey?: string; language?: string },
  ): unknown;
}
