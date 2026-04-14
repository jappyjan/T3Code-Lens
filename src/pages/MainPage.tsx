import { useEffect, useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell, NavHeader, ScreenHeader, Card, Badge, Button, StatusDot, SectionHeader, ListItem, Input } from 'even-toolkit/web';
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
    setModel: useAppStore.getState().setModel,
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

  // ── New project form ─────────────────────────────────────────────

  const [newTitle, setNewTitle] = useState('');
  const [newWorkspace, setNewWorkspace] = useState('');

  const handleCreateProject = () => {
    const title = newTitle.trim();
    if (!title) return;
    const workspace = newWorkspace.trim() || `${settings.defaultWorkspaceRoot}/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    store.createProject(title);
    setNewTitle('');
    setNewWorkspace('');
  };

  // ── Derived values ───────────────────────────────────────────────

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const currentThread = threads.find((t) => t.id === selectedThreadId);

  const glassesDetail = [
    `Screen: ${currentScreen}`,
    currentProject && `Project: ${currentProject.title}`,
    currentThread && `Thread: ${currentThread.title}`,
    threadStatus !== 'idle' && `Agent: ${threadStatus}`,
  ].filter(Boolean).join(' \u00B7 ') || 'Idle';

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

        {/* Glasses status */}
        <Card>
          <ListItem
            title="Glasses"
            subtitle={glassesDetail}
            trailing={isRecording ? <Badge variant="accent">REC</Badge> : undefined}
          />
        </Card>

        {/* Projects list */}
        <SectionHeader title="Projects" />
        {projects.length === 0 && connected && (
          <Card>
            <ListItem title="No projects yet" subtitle="Create one below" />
          </Card>
        )}
        {projects.map((p) => {
          const threadCount = threads.filter((t) => t.projectId === p.id && !t.deletedAt).length;
          return (
            <Card key={p.id}>
              <ListItem
                title={p.title}
                subtitle={p.workspaceRoot}
                trailing={<Badge variant="accent">{threadCount} thread{threadCount !== 1 ? 's' : ''}</Badge>}
              />
            </Card>
          );
        })}

        {/* Create project form */}
        {connected && (
          <>
            <SectionHeader title="New Project" />
            <Card>
              <div className="px-4 py-3 space-y-2">
                <Input
                  type="text"
                  placeholder="Project title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <Input
                  type="text"
                  placeholder={`Workspace (default: ${settings.defaultWorkspaceRoot}/...)`}
                  value={newWorkspace}
                  onChange={(e) => setNewWorkspace(e.target.value)}
                />
                <Button
                  variant="highlight"
                  className="w-full"
                  onClick={handleCreateProject}
                  disabled={!newTitle.trim()}
                >
                  Create Project
                </Button>
              </div>
            </Card>
          </>
        )}
      </main>
    </AppShell>
  );
}
