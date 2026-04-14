// ── Glasses Shared Types ────────────────────────────────────────────
// Types shared across all glasses screens and the controller.

import type { DisplayData, DisplayLine } from 'even-toolkit';
import type { T3Project, T3Thread, T3Message, InteractionMode } from '../t3/types';

export type { DisplayData, DisplayLine };

// ── Screen names ───────────────────────────────────────────────────

export type ScreenName = 'projects' | 'sessions' | 'chat' | 'dictate';

// ── Dictation intent (what the voice input is for) ─────────────────

export type DictateIntent =
  | { type: 'chat' }
  | { type: 'new-project' }
  | { type: 'new-session' };

// ── App snapshot provided to every glasses screen ──────────────────

export interface Snapshot {
  connected: boolean;
  projects: T3Project[];
  threads: T3Thread[];
  messages: T3Message[];
  currentScreen: ScreenName;
  selectedProjectId: string | null;
  selectedThreadId: string | null;
  interactionMode: InteractionMode;
  threadStatus: 'idle' | 'running' | 'error';
  streamingText: string;
  isRecording: boolean;
  transcript: string;
  interimTranscript: string;
  dictateIntent: DictateIntent;
  pendingApproval: { requestId: string; description: string } | null;
}

// ── Screen context (callbacks from glasses actions → app store) ────

export interface ScreenContext {
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
  respondApproval: (decision: 'allow' | 'deny') => void;
}

// ── Glasses navigation and action types ────────────────────────────
// Compatible with even-toolkit/glasses GlassScreen interface.

export interface GlassNavState {
  highlightedIndex: number;
  screen: string;
}

export type GlassAction =
  | { type: 'HIGHLIGHT_MOVE'; direction: 'up' | 'down' }
  | { type: 'SELECT_HIGHLIGHTED' }
  | { type: 'GO_BACK' };

export interface GlassScreenDef {
  display(nav: GlassNavState, snapshot: Snapshot): DisplayData;
  action(nav: GlassNavState, snapshot: Snapshot, action: GlassAction): GlassNavState | void;
}

// ── G2 Display Constants ───────────────────────────────────────────

export const G2_LINES = 10;
export const G2_CHARS = 44;
export const CONTENT_LINES = 7; // header(1) + rule(1) + content(7) + rule(1) = 10
export const RULE = '\u2500'.repeat(G2_CHARS);

// ── Helpers ────────────────────────────────────────────────────────

export function padLine(left: string, right: string): string {
  const gap = G2_CHARS - left.length - right.length;
  return left + ' '.repeat(Math.max(1, gap)) + right;
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 2) + '..' : s;
}

export function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    if (para.length <= maxWidth) {
      lines.push(para);
      continue;
    }
    const words = para.split(' ');
    let current = '';
    for (const word of words) {
      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= maxWidth) {
        current += ' ' + word;
      } else {
        lines.push(current);
        current = '  ' + word; // indent continuation
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}
