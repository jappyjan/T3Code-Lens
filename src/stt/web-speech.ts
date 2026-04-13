// ── Web Speech API Wrapper ──────────────────────────────────────────
// Local, free, no-API-key speech recognition using the browser's
// built-in SpeechRecognition API (Chrome / Android WebView).

export interface WebSpeechCallbacks {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

// Minimal type declarations for the Web Speech API
interface SpeechRecognitionEvent {
  results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript: string } } };
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export class WebSpeechSTT {
  private recognition: SpeechRecognitionInstance | null = null;
  private _isListening = false;

  get isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  get isListening(): boolean {
    return this._isListening;
  }

  start(language: string, callbacks: WebSpeechCallbacks) {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      callbacks.onError('Speech recognition not supported in this browser');
      return;
    }

    this.stop();

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language;

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? '';
        callbacks.onResult(text, !!result?.isFinal);
      }
    };

    rec.onerror = (event) => {
      this._isListening = false;
      callbacks.onError(event.error);
    };

    rec.onend = () => {
      this._isListening = false;
      callbacks.onEnd();
    };

    this.recognition = rec;
    rec.start();
    this._isListening = true;
  }

  stop() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
      this._isListening = false;
    }
  }

  abort() {
    if (this.recognition) {
      this.recognition.abort();
      this.recognition = null;
      this._isListening = false;
    }
  }
}
