// ── Unified Voice Input Hook ────────────────────────────────────────
// Provides a single React hook for voice dictation that works with:
//   - 'local'       → Web Speech API (free, no API key)
//   - 'deepgram'    → even-toolkit Deepgram streaming provider
//   - 'soniox'      → even-toolkit Soniox streaming provider
//   - 'whisper-api' → even-toolkit Whisper batch provider

import { useState, useCallback, useRef, useEffect } from 'react';
import { WebSpeechSTT } from './web-speech';

export type STTProvider = 'local' | 'deepgram' | 'soniox' | 'whisper-api';

interface UseVoiceInputOptions {
  provider: STTProvider;
  apiKey?: string;
  language?: string;
}

export interface UseVoiceInputReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputReturn {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const webSpeechRef = useRef(new WebSpeechSTT());
  const onlineEngineRef = useRef<{ stop: () => void } | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  const start = useCallback(() => {
    setError(null);
    setInterimTranscript('');

    const opts = optsRef.current;

    if (opts.provider === 'local') {
      if (!webSpeechRef.current.isSupported) {
        setError('Local speech recognition not supported');
        return;
      }
      webSpeechRef.current.start(opts.language ?? 'en-US', {
        onResult: (text, isFinal) => {
          if (isFinal) {
            setTranscript(prev => (prev ? prev + ' ' : '') + text);
            setInterimTranscript('');
          } else {
            setInterimTranscript(text);
          }
        },
        onError: setError,
        onEnd: () => setIsListening(false),
      });
      setIsListening(true);
    } else {
      // Online provider via even-toolkit/stt (dynamic import)
      startOnlineSTT(opts, {
        onTranscript: (text: string) =>
          setTranscript(prev => (prev ? prev + ' ' : '') + text),
        onInterim: setInterimTranscript,
        onError: setError,
        onEnd: () => setIsListening(false),
      })
        .then((engine) => {
          onlineEngineRef.current = engine;
          setIsListening(true);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'STT init failed');
          // Fall back to local
          if (webSpeechRef.current.isSupported) {
            webSpeechRef.current.start(opts.language ?? 'en-US', {
              onResult: (text, isFinal) => {
                if (isFinal) {
                  setTranscript(prev => (prev ? prev + ' ' : '') + text);
                  setInterimTranscript('');
                } else {
                  setInterimTranscript(text);
                }
              },
              onError: setError,
              onEnd: () => setIsListening(false),
            });
            setIsListening(true);
            setError('Online STT unavailable, using local fallback');
          }
        });
    }
  }, []);

  const stop = useCallback(() => {
    webSpeechRef.current.stop();
    onlineEngineRef.current?.stop();
    onlineEngineRef.current = null;
    // Merge any remaining interim text into transcript
    setInterimTranscript((prev) => {
      if (prev) setTranscript((t) => (t ? t + ' ' : '') + prev);
      return '';
    });
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      webSpeechRef.current.stop();
      onlineEngineRef.current?.stop();
    };
  }, []);

  return { transcript, interimTranscript, isListening, error, start, stop, reset };
}

// ── Online STT via even-toolkit ────────────────────────────────────

async function startOnlineSTT(
  opts: UseVoiceInputOptions,
  callbacks: {
    onTranscript: (text: string) => void;
    onInterim: (text: string) => void;
    onError: (err: string) => void;
    onEnd: () => void;
  },
): Promise<{ stop: () => void }> {
  // Dynamic import — only pulled when an online provider is selected
  const sttMod = await import('even-toolkit/stt');

  const provider = sttMod.createProvider(opts.provider, {
    apiKey: opts.apiKey,
    language: opts.language,
  });

  const engine = new sttMod.STTEngine({
    provider,
    onTranscript: (result: { text: string; isFinal: boolean }) => {
      if (result.isFinal) {
        callbacks.onTranscript(result.text);
      } else {
        callbacks.onInterim(result.text);
      }
    },
    onError: (err: { message?: string }) =>
      callbacks.onError(err.message ?? 'STT error'),
    onEnd: callbacks.onEnd,
  });

  await engine.start();
  return engine;
}
