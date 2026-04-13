// ── T3Code Entity Types ─────────────────────────────────────────────
// Mirrors the contracts from @t3/contracts for the T3Code orchestration API.

export interface T3Project {
  id: string;
  title: string;
  workspaceRoot: string;
  defaultModelSelection?: ModelSelection;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface T3Thread {
  id: string;
  projectId: string;
  title: string;
  modelSelection?: ModelSelection;
  runtimeMode: RuntimeMode;
  interactionMode: InteractionMode;
  branch?: string | null;
  worktreePath?: string | null;
  latestTurn?: T3Turn;
  messages: T3Message[];
  activities: T3Activity[];
  session?: T3Session;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  deletedAt?: string;
}

export interface T3Message {
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  attachments?: T3Attachment[];
  createdAt?: string;
}

export interface T3Attachment {
  id: string;
  name: string;
  type: string;
}

export interface T3Turn {
  id: string;
  status: 'running' | 'completed' | 'interrupted' | 'failed';
}

export interface T3Activity {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface T3Session {
  status: 'idle' | 'running' | 'error';
}

export interface ModelSelection {
  provider: 'claudeAgent' | 'codex';
  model: string;
}

export type RuntimeMode = 'approval-required' | 'auto-accept-edits' | 'full-access';
export type InteractionMode = 'default' | 'plan';

export interface T3ShellSnapshot {
  projects: T3Project[];
  threads: T3Thread[];
}
