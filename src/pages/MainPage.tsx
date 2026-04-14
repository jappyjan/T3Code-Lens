// ── Main Page (Phone Companion) ─────────────────────────────────────
// Runs the glasses controller hook and shows a minimal status view.
// All real interaction happens on the glasses display.

import { useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router';
import { Card, Badge, Button, ScreenHeader } from 'even-toolkit/web';
import { useAppStore } from '../store';
import { useGlassesController } from '../glass/controller';
import { createScreenRouter } from '../glass/selectors';
import { useVoiceInput } from '../stt/use-voice-input';
import type { ScreenContext } from '../glass/shared';

export function MainPage() {
  const store = useAppStore();
  const {
    connected, connecting, connectionError,
    currentScreen, isRecording, settings,
    selectedProjectId, selectedThreadId,
    projects, threads, interactionMode, threadStatus,
  } = store;

  // ── Voice input ──────────────────────────────────────────────────

  const voice = useVoiceInput({
    provider: settings.sttProvider,
    apiKey: settings.sttApiKey,
    language: settings.sttLanguage,
  });

  // Sync voice transcript → store
  useEffect(() => {
    store.setTranscript(voice.transcript, voice.interimTranscript);
  }, [voice.transcript, voice.interimTranscript]); // eslint-disable-line

  // Start/stop recording when store flag changes
  useEffect(() => {
    if (isRecording && !voice.isListening) {
      voice.reset();
      voice.start();
    } else if (!isRecording && voice.isListening) {
      voice.stop();
    }
  }, [isRecording]); // eslint-disable-line

  // ── Screen context (callbacks from glasses → store) ──────────────

  const ctx: ScreenContext = useMemo(() => ({
    selectProject: useAppStore.getState().selectProject,
    selectThread: useAppStore.getState().selectThread,
    createProject: useAppStore.getState().createProject,
    createThread: useAppStore.getState().createThread,
    sendMessage: useAppStore.getState().sendMessage,
    toggleMode: useAppStore.getState().toggleMode,
    navigateTo: useAppStore.getState().navigateTo,
    goBack: useAppStore.getState().goBack,
    startRecording: useAppStore.getState().startRecording,
    stopAndSend: useAppStore.getState().stopAndSend,
    cancelRecording: useAppStore.getState().cancelRecording,
    respondApproval: useAppStore.getState().respondApproval,
  }), []);

  const screens = useMemo(() => createScreenRouter(ctx), [ctx]);
  const getSnapshot = useCallback(() => useAppStore.getState().getSnapshot(), []);
  const getCurrentScreen = useCallback(() => useAppStore.getState().currentScreen, []);

  // ── Glasses bridge ───────────────────────────────────────────────

  useGlassesController({ screens, getSnapshot, getCurrentScreen });

  // ── Auto-connect on mount ────────────────────────────────────────

  useEffect(() => {
    if (settings.serverUrl && settings.sessionToken && !connected && !connecting) {
      store.connect();
    }
  }, []); // eslint-disable-line

  // ── Derived display values ───────────────────────────────────────

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const currentThread = threads.find((t) => t.id === selectedThreadId);

  // ── Render (phone status view) ───────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <ScreenHeader title="T3Code Lens" subtitle="Smart Glasses Coding Assistant" />

        {/* Connection */}
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Server</span>
            <Badge variant={connected ? 'positive' : 'negative'}>
              {connecting ? 'Connecting...' : connected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          {(connectionError || settings.serverUrl) && (
            <p className="text-xs text-gray-600 mt-1.5 truncate">
              {connectionError ?? settings.serverUrl}
            </p>
          )}
        </Card>

        {/* Current state */}
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Screen</span>
            <Badge variant="accent">{currentScreen}</Badge>
          </div>
          <p className="text-xs text-gray-600 mt-1.5 truncate">
            {[
              currentProject && `Project: ${currentProject.title}`,
              currentThread && `Thread: ${currentThread.title}`,
              `Mode: ${interactionMode === 'plan' ? 'Plan' : 'Chat'}`,
              threadStatus !== 'idle' && `Agent: ${threadStatus}`,
            ].filter(Boolean).join(' \u00B7 ') || 'No active selection'}
          </p>
        </Card>

        {/* Recording indicator */}
        {isRecording && (
          <Card className="border border-red-800 bg-red-950">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <div>
                <span className="text-sm font-medium text-red-300">Recording</span>
                {voice.error && (
                  <p className="text-xs text-red-400 mt-0.5">{voice.error}</p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Gesture guide */}
        <Card>
          <p className="text-sm font-medium text-gray-400 mb-2">Glasses Controls</p>
          <div className="text-xs text-gray-500 space-y-1.5">
            <p>Scroll up/down &mdash; Navigate lists / scroll content</p>
            <p>Single tap &mdash; Select item / start dictation</p>
            <p>Double tap &mdash; Go back</p>
            {currentScreen === 'dictate' && (
              <>
                <p className="mt-2 text-gray-400 font-medium">Dictation</p>
                <p>Tap &mdash; Send message</p>
                <p>Scroll &mdash; Toggle Chat/Plan mode</p>
                <p>Double tap &mdash; Cancel</p>
              </>
            )}
          </div>
        </Card>

        {/* Settings link */}
        <Link to="/settings">
          <Button variant="secondary" className="w-full">
            Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}
