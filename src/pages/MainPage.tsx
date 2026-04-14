import { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { AppShell, NavHeader, ScreenHeader, Card, Badge, Button, StatusDot, SectionHeader, ListItem } from 'even-toolkit/web';
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

  useEffect(() => {
    store.setTranscript(voice.transcript, voice.interimTranscript);
  }, [voice.transcript, voice.interimTranscript]); // eslint-disable-line

  useEffect(() => {
    if (isRecording && !voice.isListening) {
      voice.reset();
      voice.start();
    } else if (!isRecording && voice.isListening) {
      voice.stop();
    }
  }, [isRecording]); // eslint-disable-line

  // ── Screen context ───────────────────────────────────────────────

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

  useGlassesController({ screens, getSnapshot, getCurrentScreen });

  // ── Auto-connect on mount ────────────────────────────────────────

  useEffect(() => {
    if (settings.serverUrl && settings.sessionToken && !connected && !connecting) {
      store.connect();
    }
  }, []); // eslint-disable-line

  // ── Derived values ───────────────────────────────────────────────

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const currentThread = threads.find((t) => t.id === selectedThreadId);

  const stateDetail = [
    currentProject && `Project: ${currentProject.title}`,
    currentThread && `Thread: ${currentThread.title}`,
    `Mode: ${interactionMode === 'plan' ? 'Plan' : 'Chat'}`,
    threadStatus !== 'idle' && `Agent: ${threadStatus}`,
  ].filter(Boolean).join(' \u00B7 ') || 'No active selection';

  // ── Render ───────────────────────────────────────────────────────

  return (
    <AppShell
      header={<NavHeader title="T3Code Lens" right={
        <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>Settings</Button>
      } />}
    >
      <main className="px-3 pt-4 pb-8 space-y-3">
        <ScreenHeader title="T3Code Lens" subtitle="Smart Glasses Coding Assistant" />

        {/* Connection status */}
        <Card>
          <ListItem
            title="Server"
            subtitle={connectionError ?? (settings.serverUrl || 'Not configured')}
            leading={<StatusDot connected={connected} />}
            trailing={
              <Badge variant={connected ? 'positive' : 'negative'}>
                {connecting ? 'Connecting...' : connected ? 'Connected' : 'Disconnected'}
              </Badge>
            }
          />
        </Card>

        {/* Current screen */}
        <Card>
          <ListItem
            title="Screen"
            subtitle={stateDetail}
            trailing={<Badge variant="accent">{currentScreen}</Badge>}
          />
        </Card>

        {/* Recording indicator */}
        {isRecording && (
          <Card>
            <ListItem
              title="Recording"
              subtitle={voice.error ?? 'Listening for voice input...'}
              leading={<StatusDot connected={true} />}
            />
          </Card>
        )}

        {/* Glasses controls guide */}
        <SectionHeader title="Glasses Controls" />
        <Card>
          <ListItem title="Scroll up/down" subtitle="Navigate lists / scroll content" />
          <ListItem title="Single tap" subtitle="Select item / start dictation" />
          <ListItem title="Double tap" subtitle="Go back" />
          {currentScreen === 'dictate' && (
            <>
              <ListItem title="Tap" subtitle="Send message" />
              <ListItem title="Scroll" subtitle="Toggle Chat/Plan mode" />
              <ListItem title="Double tap" subtitle="Cancel recording" />
            </>
          )}
        </Card>
      </main>
    </AppShell>
  );
}
