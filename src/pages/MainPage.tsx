// ── Main Page (Phone Companion) ─────────────────────────────────────
// Runs the glasses controller hook and shows a minimal status view.
// All real interaction happens on the glasses display.

import { useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router';
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
        <div className="text-center py-4">
          <h1 className="text-xl font-bold tracking-tight">T3Code Lens</h1>
          <p className="text-xs text-gray-500 mt-1">Smart Glasses Coding Assistant</p>
        </div>

        {/* Connection */}
        <StatusCard
          label="Server"
          value={connecting ? 'Connecting...' : connected ? 'Connected' : 'Disconnected'}
          color={connected ? 'green' : 'red'}
          detail={connectionError ?? settings.serverUrl || 'Not configured'}
        />

        {/* Current state */}
        <StatusCard
          label="Screen"
          value={currentScreen}
          color="blue"
          detail={[
            currentProject && `Project: ${currentProject.title}`,
            currentThread && `Thread: ${currentThread.title}`,
            `Mode: ${interactionMode === 'plan' ? 'Plan' : 'Chat'}`,
            threadStatus !== 'idle' && `Agent: ${threadStatus}`,
          ].filter(Boolean).join(' \u00B7 ') || 'No active selection'}
        />

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-3 bg-red-950 border border-red-800 rounded-lg px-4 py-3">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            <div>
              <span className="text-sm font-medium text-red-300">Recording</span>
              {voice.error && (
                <p className="text-xs text-red-400 mt-0.5">{voice.error}</p>
              )}
            </div>
          </div>
        )}

        {/* Gesture guide */}
        <div className="bg-gray-900 rounded-lg p-4 text-xs text-gray-500 space-y-1.5">
          <p className="text-gray-400 font-medium mb-2">Glasses Controls</p>
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

        {/* Settings link */}
        <Link
          to="/settings"
          className="block w-full bg-gray-800 hover:bg-gray-700 text-center rounded-lg p-3 text-sm transition-colors"
        >
          Settings
        </Link>
      </div>
    </div>
  );
}

// ── Status Card ────────────────────────────────────────────────────

function StatusCard(props: {
  label: string;
  value: string;
  color: 'green' | 'red' | 'blue';
  detail?: string;
}) {
  const colors = {
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{props.label}</span>
        <span className={`text-sm font-medium ${colors[props.color]}`}>
          {props.value}
        </span>
      </div>
      {props.detail && (
        <p className="text-xs text-gray-600 mt-1.5 truncate">{props.detail}</p>
      )}
    </div>
  );
}
