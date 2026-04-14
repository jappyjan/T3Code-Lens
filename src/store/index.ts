// ── Application State (Zustand) ─────────────────────────────────────
// Single store that manages connection, T3Code data, navigation,
// voice input, and settings. Settings are persisted to localStorage.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { T3Client } from '../t3/client';
import type {
  T3Project, T3Thread, T3Message,
  InteractionMode, RuntimeMode, ModelSelection,
} from '../t3/types';
export type { ModelSelection };
import type { ScreenName, DictateIntent, Snapshot } from '../glass/shared';
import type { STTProvider } from '../stt/use-voice-input';

// ── Settings (persisted) ───────────────────────────────────────────

export interface Settings {
  serverUrl: string;
  sessionToken: string;
  sttProvider: STTProvider;
  sttApiKey: string;
  sttLanguage: string;
  defaultRuntimeMode: RuntimeMode;
  defaultModel: ModelSelection;
  defaultWorkspaceRoot: string;
}

// ── Store shape ────────────────────────────────────────────────────

interface AppState {
  // Connection
  connected: boolean;
  connecting: boolean;
  connectionError: string | null;

  // Data
  projects: T3Project[];
  threads: T3Thread[];
  messages: T3Message[];

  // Navigation
  currentScreen: ScreenName;
  screenStack: ScreenName[];
  selectedProjectId: string | null;
  selectedThreadId: string | null;

  // Chat
  interactionMode: InteractionMode;
  threadStatus: 'idle' | 'running' | 'error';
  streamingText: string;
  pendingApproval: { requestId: string; description: string } | null;

  // Voice
  isRecording: boolean;
  transcript: string;
  interimTranscript: string;
  dictateIntent: DictateIntent;

  // Settings
  settings: Settings;

  // ── Actions ────────────────────────────────────────────────────
  setSettings: (partial: Partial<Settings>) => void;
  connect: () => Promise<void>;
  disconnect: () => void;

  selectProject: (id: string) => void;
  selectThread: (id: string) => void;
  createProject: (title: string) => void;
  createThread: (title: string) => void;
  sendMessage: (text: string) => void;
  toggleMode: () => void;
  navigateTo: (screen: ScreenName, intent?: DictateIntent) => void;
  goBack: () => void;

  startRecording: () => void;
  stopAndSend: () => void;
  cancelRecording: () => void;
  setTranscript: (transcript: string, interim: string) => void;

  respondApproval: (decision: 'allow' | 'deny') => void;
  setModel: (model: ModelSelection) => void;

  getSnapshot: () => Snapshot;
}

// ── Singleton T3 client (lives outside React tree) ─────────────────

let t3: T3Client | null = null;

// ── Store ──────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Initial values ─────────────────────────────────────────
      connected: false,
      connecting: false,
      connectionError: null,

      projects: [],
      threads: [],
      messages: [],

      currentScreen: 'projects' as ScreenName,
      screenStack: [] as ScreenName[],
      selectedProjectId: null,
      selectedThreadId: null,

      interactionMode: 'default' as InteractionMode,
      threadStatus: 'idle' as const,
      streamingText: '',
      pendingApproval: null,

      isRecording: false,
      transcript: '',
      interimTranscript: '',
      dictateIntent: { type: 'chat' } as DictateIntent,

      settings: {
        serverUrl: '',
        sessionToken: '',
        sttProvider: 'local' as STTProvider,
        sttApiKey: '',
        sttLanguage: 'en-US',
        defaultRuntimeMode: 'auto-accept-edits' as RuntimeMode,
        defaultModel: { provider: 'claudeAgent', model: 'claude-sonnet-4-6' } as ModelSelection,
        defaultWorkspaceRoot: '/home/user',
      },

      // ── Settings ───────────────────────────────────────────────

      setSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),

      // ── Connection ─────────────────────────────────────────────

      connect: async () => {
        const { settings } = get();
        if (!settings.serverUrl) {
          set({ connectionError: 'Server URL is required' });
          return;
        }
        if (!settings.sessionToken) {
          set({ connectionError: 'Session token is required — pair first' });
          return;
        }

        set({ connecting: true, connectionError: null });

        try {
          t3?.disconnect();
          t3 = new T3Client();

          t3.onConnectionChange = (connected) => set({ connected });

          t3.onShellUpdate = (snapshot) => {
            set({
              projects: snapshot.projects.filter((p) => !p.deletedAt),
              threads: snapshot.threads.filter((t) => !t.deletedAt),
            });
          };

          t3.onThreadEvent = (threadId, events) => {
            if (threadId !== get().selectedThreadId) return;
            for (const event of events) {
              processThreadEvent(event, set, get);
            }
          };

          await t3.connectWithToken(settings.serverUrl, settings.sessionToken);
          t3.subscribeShell();
          set({ connected: true, connecting: false });
        } catch (err) {
          set({
            connected: false,
            connecting: false,
            connectionError: err instanceof Error ? err.message : 'Connection failed',
          });
        }
      },

      disconnect: () => {
        t3?.disconnect();
        t3 = null;
        set({ connected: false });
      },

      // ── Navigation ─────────────────────────────────────────────

      selectProject: (id) => {
        set({ selectedProjectId: id, selectedThreadId: null, messages: [] });
      },

      selectThread: (id) => {
        set({
          selectedThreadId: id,
          messages: [],
          streamingText: '',
          pendingApproval: null,
        });

        if (t3) {
          t3.subscribeThread(id);
          const thread = get().threads.find((t) => t.id === id);
          if (thread) {
            set({
              messages: thread.messages ?? [],
              interactionMode: thread.interactionMode ?? 'default',
              threadStatus: thread.session?.status === 'running' ? 'running' : 'idle',
            });
          }
        }
      },

      navigateTo: (screen, intent) => {
        set((s) => ({
          currentScreen: screen,
          screenStack: [...s.screenStack, s.currentScreen],
          ...(intent ? { dictateIntent: intent } : {}),
        }));
      },

      goBack: () => {
        set((s) => {
          const stack = [...s.screenStack];
          const prev = stack.pop() ?? ('projects' as ScreenName);
          return { currentScreen: prev, screenStack: stack };
        });
      },

      // ── Project / Thread creation ──────────────────────────────

      createProject: (title) => {
        if (!t3) return;
        const { settings } = get();
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        t3.createProject(title, `${settings.defaultWorkspaceRoot}/${slug}`);
      },

      createThread: (title) => {
        if (!t3) return;
        const { selectedProjectId, interactionMode, settings } = get();
        if (!selectedProjectId) return;

        t3.createThread(selectedProjectId, title, {
          model: settings.defaultModel,
          runtimeMode: settings.defaultRuntimeMode,
          interactionMode,
        }).then((threadId) => {
          get().selectThread(threadId);
          get().navigateTo('chat');
        });
      },

      // ── Chat ───────────────────────────────────────────────────

      sendMessage: (text) => {
        if (!t3 || !text.trim()) return;
        const { selectedThreadId, interactionMode, settings } = get();
        if (!selectedThreadId) return;

        const userMsg: T3Message = {
          messageId: crypto.randomUUID(),
          role: 'user',
          text: text.trim(),
        };
        set((s) => ({
          messages: [...s.messages, userMsg],
          threadStatus: 'running' as const,
          streamingText: '',
        }));

        t3.sendMessage(selectedThreadId, text.trim(), {
          runtimeMode: settings.defaultRuntimeMode,
          interactionMode,
          modelSelection: settings.defaultModel,
        });
      },

      toggleMode: () => {
        set((s) => {
          const mode: InteractionMode = s.interactionMode === 'default' ? 'plan' : 'default';
          if (t3 && s.selectedThreadId) {
            t3.setInteractionMode(s.selectedThreadId, mode);
          }
          return { interactionMode: mode };
        });
      },

      respondApproval: (decision) => {
        const { selectedThreadId, pendingApproval } = get();
        if (!t3 || !selectedThreadId || !pendingApproval) return;
        t3.respondToApproval(selectedThreadId, pendingApproval.requestId, decision);
        set({ pendingApproval: null });
      },

      setModel: (model) => {
        set((s) => ({ settings: { ...s.settings, defaultModel: model } }));
      },

      // ── Voice ──────────────────────────────────────────────────

      startRecording: () => {
        set({ isRecording: true, transcript: '', interimTranscript: '' });
      },

      stopAndSend: () => {
        const { transcript, interimTranscript, dictateIntent } = get();
        const full = (transcript + ' ' + interimTranscript).trim();
        set({ isRecording: false, transcript: '', interimTranscript: '' });

        if (!full) {
          get().goBack();
          return;
        }

        switch (dictateIntent.type) {
          case 'chat':
            get().sendMessage(full);
            get().goBack();
            break;
          case 'new-project':
            get().createProject(full);
            get().goBack();
            break;
          case 'new-session':
            get().createThread(full);
            // createThread auto-navigates to chat
            break;
        }
      },

      cancelRecording: () => {
        set({ isRecording: false, transcript: '', interimTranscript: '' });
        get().goBack();
      },

      setTranscript: (transcript, interim) => {
        set({ transcript, interimTranscript: interim });
      },

      // ── Snapshot ───────────────────────────────────────────────

      getSnapshot: () => {
        const s = get();
        return {
          connected: s.connected,
          projects: s.projects,
          threads: s.threads,
          messages: s.messages,
          currentScreen: s.currentScreen,
          selectedProjectId: s.selectedProjectId,
          selectedThreadId: s.selectedThreadId,
          interactionMode: s.interactionMode,
          threadStatus: s.threadStatus,
          streamingText: s.streamingText,
          isRecording: s.isRecording,
          transcript: s.transcript,
          interimTranscript: s.interimTranscript,
          dictateIntent: s.dictateIntent,
          pendingApproval: s.pendingApproval,
          defaultModel: s.settings.defaultModel,
        };
      },
    }),
    {
      name: 't3code-lens-settings',
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
);

// ── Thread Event Processing ────────────────────────────────────────
// Called for each event received from T3Code's thread subscription.

type Setter = (fn: (s: AppState) => Partial<AppState>) => void;
type Getter = () => AppState;

function processThreadEvent(event: unknown, set: Setter, get: Getter) {
  const e = event as Record<string, unknown>;
  const tag = (e._tag ?? e.type ?? '') as string;

  switch (tag) {
    // ── Messages ───────────────────────────────────────────────
    case 'thread.message-sent':
    case 'message-sent': {
      const msg = e.message as T3Message | undefined;
      if (msg && msg.role !== 'user') {
        set((s) => ({ messages: [...s.messages, msg], streamingText: '' }));
      }
      break;
    }

    // ── Turn lifecycle ─────────────────────────────────────────
    case 'thread.turn-started':
    case 'turn-started':
      set(() => ({ threadStatus: 'running' as const, streamingText: '' }));
      break;

    case 'thread.turn-completed':
    case 'turn-completed':
      set((s) => {
        const msgs = s.streamingText
          ? [...s.messages, { messageId: crypto.randomUUID(), role: 'assistant' as const, text: s.streamingText }]
          : s.messages;
        return { threadStatus: 'idle' as const, streamingText: '', messages: msgs };
      });
      break;

    case 'thread.turn-failed':
    case 'turn-failed':
      set(() => ({ threadStatus: 'error' as const, streamingText: '' }));
      break;

    case 'thread.turn-interrupted':
    case 'turn-interrupted':
      set((s) => {
        const msgs = s.streamingText
          ? [...s.messages, {
              messageId: crypto.randomUUID(),
              role: 'assistant' as const,
              text: s.streamingText + ' [interrupted]',
            }]
          : s.messages;
        return { threadStatus: 'idle' as const, streamingText: '', messages: msgs };
      });
      break;

    // ── Streaming content ──────────────────────────────────────
    case 'thread.content-delta':
    case 'content-delta': {
      const delta = (e.delta ?? e.text ?? '') as string;
      set((s) => ({ streamingText: s.streamingText + delta }));
      break;
    }

    // ── Approval requests ──────────────────────────────────────
    case 'thread.activity-appended':
    case 'activity-appended': {
      const activity = e.activity as Record<string, unknown> | undefined;
      if (activity?.type === 'approval-request') {
        set(() => ({
          pendingApproval: {
            requestId: activity.requestId as string,
            description: (activity.description ?? activity.command ?? 'Action needs approval') as string,
          },
        }));
      }
      break;
    }

    // ── Session status ─────────────────────────────────────────
    case 'thread.session-set':
    case 'session-set': {
      const session = e.session as Record<string, unknown> | undefined;
      const status = session?.status as string | undefined;
      set(() => ({
        threadStatus: status === 'running' ? 'running'
                    : status === 'error'   ? 'error'
                    : 'idle',
      }));
      break;
    }

    // ── Plan mode ──────────────────────────────────────────────
    case 'thread.proposed-plan-upserted':
    case 'proposed-plan-upserted': {
      const plan = e.plan as Record<string, unknown> | undefined;
      if (plan?.content) {
        set((s) => ({
          messages: [...s.messages, {
            messageId: crypto.randomUUID(),
            role: 'assistant' as const,
            text: '[PLAN] ' + (plan.content as string),
          }],
        }));
      }
      break;
    }

    // ── Initial snapshot ───────────────────────────────────────
    case 'snapshot': {
      const data = (e.data ?? e) as Record<string, unknown>;
      if (data.messages) {
        set(() => ({ messages: data.messages as T3Message[] }));
      }
      break;
    }
  }
}
