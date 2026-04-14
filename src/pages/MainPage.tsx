// ── Main Page (Phone Companion) ─────────────────────────────────────
// Runs the glasses controller hook and shows a minimal status view.
// All real interaction happens on the glasses display.

import { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { AppShell, Card, Badge, Button, ScreenHeader, StatusDot, SectionHeader } from 'even-toolkit/web';
import { useAppStore } from '../store';
import { useGlassesController } from '../glass/controller';
import { createScreenRouter } from '../glass/selectors';
import { useVoiceInput } from '../stt/use-voice-input';
import type { ScreenContext } from '../glass/shared';

export function MainPage() {
  const store = useAppStore();
  const navigate = useNavigate();
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
    <AppShell header={<ScreenHeader title="T3Code Lens" subtitle="Smart Glasses Coding Assistant" />}>
      <div className="px-3 pt-4 pb-8 space-y-3">
        {/* Connection */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot connected={connected} />
              <span className="text-normal-title">Server</span>
            </div>
            <Badge variant={connected ? 'positive' : 'negative'}>
              {connecting ? 'Connecting...' : connected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          {(connectionError || settings.serverUrl) && (
            <p className="text-detail truncate mt-1">
              {connectionError ?? settings.serverUrl}
            </p>
          )}
        </Card>

        {/* Current state */}
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-normal-title">Screen</span>
            <Badge variant="accent">{currentScreen}</Badge>
          </div>
          <p className="text-detail truncate mt-1">
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
          <Card>
            <div className="flex items-center gap-3">
              <span className="animate-pulse-dot" />
              <div>
                <span className="text-normal-title">Recording</span>
                {voice.error && (
                  <p className="text-detail mt-0.5">{voice.error}</p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Gesture guide */}
        <SectionHeader title="Glasses Controls" />
        <Card>
          <div className="text-detail space-y-1.5">
            <p>Scroll up/down &mdash; Navigate lists / scroll content</p>
            <p>Single tap &mdash; Select item / start dictation</p>
            <p>Double tap &mdash; Go back</p>
            {currentScreen === 'dictate' && (
              <>
                <p className="text-subtitle mt-2">Dictation</p>
                <p>Tap &mdash; Send message</p>
                <p>Scroll &mdash; Toggle Chat/Plan mode</p>
                <p>Double tap &mdash; Cancel</p>
              </>
            )}
          </div>
        </Card>

        {/* Settings link */}
        <Button variant="secondary" className="w-full" onClick={() => navigate('/settings')}>
          Settings
        </Button>
      </div>
    </AppShell>
  );
}
