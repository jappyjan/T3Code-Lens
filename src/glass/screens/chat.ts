// ── Glasses Screen: Chat View ───────────────────────────────────────
// Shows the conversation for the active thread.
// Newest messages at the bottom; scroll UP to see older history.
// Supports chat mode, plan mode, approval requests, and streaming.
//
// Menu bar: scroll up past top of messages to enter menu mode.
// Menu lets you cycle through Model and Mode settings.

import { line, separator } from 'even-toolkit';
import type { GlassNavState, GlassAction, GlassScreenDef, Snapshot, ScreenContext, DisplayData, DisplayLine } from '../shared';
import { G2_CHARS, padLine, truncate, wrapText } from '../shared';
import type { ModelSelection } from '../../t3/types';

const CHAT_LINES = 7;
const MENU_CHAT_LINES = 5; // fewer chat lines when menu is visible
const USER_PREFIX = '> ';
const ASST_PREFIX = '< ';
const SYS_PREFIX  = '= ';

const MODEL_OPTIONS: { label: string; value: ModelSelection }[] = [
  { label: 'Sonnet 4.6', value: { provider: 'claudeAgent', model: 'claude-sonnet-4-6' } },
  { label: 'Opus 4.6', value: { provider: 'claudeAgent', model: 'claude-opus-4-6' } },
  { label: 'Haiku 4.5', value: { provider: 'claudeAgent', model: 'claude-haiku-4-5-20251001' } },
  { label: 'Codex GPT-5.4', value: { provider: 'codex', model: 'gpt-5.4' } },
];

const MODE_OPTIONS = ['Chat', 'Plan'] as const;

type ChatMode = 'scroll' | 'menu-nav' | 'menu-edit';
const MENU_FIELDS = ['model', 'mode'] as const;

export function createChatScreen(ctx: ScreenContext): GlassScreenDef {
  // Closure state for menu
  let chatMode: ChatMode = 'scroll';
  let menuIndex = 0;     // which menu field is highlighted (0=model, 1=mode)
  let editIndex = 0;     // which option is highlighted within a field

  return { display, action };

  function getModelIndex(snap: Snapshot): number {
    const idx = MODEL_OPTIONS.findIndex(
      (o) => o.value.provider === snap.defaultModel.provider && o.value.model === snap.defaultModel.model,
    );
    return idx >= 0 ? idx : 0;
  }

  function getModelLabel(snap: Snapshot): string {
    const idx = getModelIndex(snap);
    return MODEL_OPTIONS[idx]?.label ?? 'Unknown';
  }

  function getModeLabel(snap: Snapshot): string {
    return snap.interactionMode === 'plan' ? 'Plan' : 'Chat';
  }

  function buildDisplayLines(snap: Snapshot): DisplayLine[] {
    const allLines: DisplayLine[] = [];

    for (const msg of snap.messages) {
      const prefix =
        msg.role === 'user'      ? USER_PREFIX :
        msg.role === 'assistant' ? ASST_PREFIX : SYS_PREFIX;
      const style = msg.role === 'user' ? 'normal' : 'meta';
      for (const text of wrapText(prefix + msg.text, G2_CHARS)) {
        allLines.push(line(text, style));
      }
    }

    if (snap.streamingText) {
      const streamLines = wrapText(ASST_PREFIX + snap.streamingText, G2_CHARS);
      if (snap.threadStatus === 'running') {
        const last = streamLines[streamLines.length - 1];
        if (last && last.length < G2_CHARS - 1) {
          streamLines[streamLines.length - 1] = last + '\u2588';
        }
      }
      for (const text of streamLines) {
        allLines.push(line(text, 'meta'));
      }
    }

    if (snap.pendingApproval) {
      allLines.push(line(''));
      allLines.push(line('! APPROVE? ' + truncate(snap.pendingApproval.description, G2_CHARS - 11), 'inverted'));
      allLines.push(line('  SCROLL UP=allow  DOWN=deny', 'inverted'));
    }

    return allLines;
  }

  function displayScroll(nav: GlassNavState, snap: Snapshot): DisplayData {
    const lines: DisplayLine[] = [];
    const thread = snap.threads.find((t) => t.id === snap.selectedThreadId);
    const mode = snap.interactionMode === 'plan' ? 'PLAN' : 'CHAT';
    const status =
      snap.threadStatus === 'running' ? ' \u25CF' :
      snap.threadStatus === 'error'   ? ' !'    : '';

    // Header
    lines.push(line(padLine(truncate(thread?.title ?? 'Chat', 28), mode + status)));
    lines.push(separator());

    // Chat lines
    const allLines = buildDisplayLines(snap);
    const total = allLines.length;
    const scrollPos = nav.highlightedIndex;
    const endIdx = total - scrollPos;
    const startIdx = Math.max(0, endIdx - CHAT_LINES);
    const visible = allLines.slice(startIdx, endIdx);

    for (let i = 0; i < CHAT_LINES; i++) {
      lines.push(visible[i] ?? line(''));
    }

    // Footer
    lines.push(separator());
    const canOlder = startIdx > 0;
    const canNewer = scrollPos > 0;
    const scroll = (canOlder ? '\u25B2' : ' ') + (canNewer ? '\u25BC' : ' ');
    const page = total > CHAT_LINES
      ? `${Math.floor(scrollPos / CHAT_LINES) + 1}/${Math.ceil(total / CHAT_LINES)}`
      : '';
    lines.push(line(padLine(`TAP:talk  \u25C0\u25C0:back  ${mode}`, `${page} ${scroll}`), 'meta'));

    return { lines };
  }

  function displayMenuNav(nav: GlassNavState, snap: Snapshot): DisplayData {
    const lines: DisplayLine[] = [];

    // Menu items (2 lines replacing header)
    const modelLabel = `Model: ${getModelLabel(snap)}`;
    const modeLabel = `Mode:  ${getModeLabel(snap)}`;
    const items = [modelLabel, modeLabel];
    for (let i = 0; i < items.length; i++) {
      const prefix = i === menuIndex ? '\u25B8 ' : '  ';
      const style = i === menuIndex ? 'inverted' : 'normal';
      lines.push(line(prefix + items[i], style));
    }
    lines.push(separator());

    // Fewer chat lines
    const allLines = buildDisplayLines(snap);
    const total = allLines.length;
    const visible = allLines.slice(Math.max(0, total - MENU_CHAT_LINES), total);
    for (let i = 0; i < MENU_CHAT_LINES; i++) {
      lines.push(visible[i] ?? line(''));
    }

    // Footer
    lines.push(separator());
    lines.push(line('TAP:edit  \u25B2\u25BC:nav  \u25C0\u25C0:chat', 'meta'));

    return { lines };
  }

  function displayMenuEdit(_nav: GlassNavState, snap: Snapshot): DisplayData {
    const lines: DisplayLine[] = [];
    const field = MENU_FIELDS[menuIndex];

    if (field === 'model') {
      lines.push(line('  Model:', 'meta'));
      for (let i = 0; i < MODEL_OPTIONS.length; i++) {
        const prefix = i === editIndex ? '\u25B8 ' : '  ';
        const style = i === editIndex ? 'inverted' : 'normal';
        lines.push(line(prefix + MODEL_OPTIONS[i].label, style));
      }
      // Fill remaining lines
      const remaining = MENU_CHAT_LINES - MODEL_OPTIONS.length;
      lines.push(separator());
      const allLines = buildDisplayLines(snap);
      const chatVisible = allLines.slice(Math.max(0, allLines.length - Math.max(0, remaining)));
      for (let i = 0; i < Math.max(0, remaining); i++) {
        lines.push(chatVisible[i] ?? line(''));
      }
    } else {
      lines.push(line('  Mode:', 'meta'));
      for (let i = 0; i < MODE_OPTIONS.length; i++) {
        const prefix = i === editIndex ? '\u25B8 ' : '  ';
        const style = i === editIndex ? 'inverted' : 'normal';
        lines.push(line(prefix + MODE_OPTIONS[i], style));
      }
      lines.push(separator());
      // More room for chat since only 2 mode options
      const allLines = buildDisplayLines(snap);
      const remaining = MENU_CHAT_LINES + 2 - MODE_OPTIONS.length;
      const chatVisible = allLines.slice(Math.max(0, allLines.length - remaining));
      for (let i = 0; i < remaining; i++) {
        lines.push(chatVisible[i] ?? line(''));
      }
    }

    // Footer
    lines.push(separator());
    lines.push(line('TAP:ok  \u25B2\u25BC:cycle  \u25C0\u25C0:cancel', 'meta'));

    return { lines };
  }

  function display(nav: GlassNavState, snap: Snapshot): DisplayData {
    switch (chatMode) {
      case 'scroll': return displayScroll(nav, snap);
      case 'menu-nav': return displayMenuNav(nav, snap);
      case 'menu-edit': return displayMenuEdit(nav, snap);
    }
  }

  function action(nav: GlassNavState, snap: Snapshot, act: GlassAction): GlassNavState | void {
    switch (chatMode) {
      case 'scroll': return actionScroll(nav, snap, act);
      case 'menu-nav': return actionMenuNav(snap, act);
      case 'menu-edit': return actionMenuEdit(snap, act);
    }
  }

  function actionScroll(nav: GlassNavState, snap: Snapshot, act: GlassAction): GlassNavState | void {
    const allLines = buildDisplayLines(snap);
    const maxScroll = Math.max(0, allLines.length - CHAT_LINES);

    switch (act.type) {
      case 'HIGHLIGHT_MOVE': {
        // If there's a pending approval at scroll position 0, handle it
        if (snap.pendingApproval && nav.highlightedIndex === 0) {
          ctx.respondApproval(act.direction === 'up' ? 'allow' : 'deny');
          return nav;
        }
        if (act.direction === 'up') {
          // If already at max scroll, enter menu mode
          if (nav.highlightedIndex >= maxScroll) {
            chatMode = 'menu-nav';
            menuIndex = 0;
            return nav;
          }
          return { ...nav, highlightedIndex: Math.min(nav.highlightedIndex + 1, maxScroll) };
        } else {
          return { ...nav, highlightedIndex: Math.max(nav.highlightedIndex - 1, 0) };
        }
      }
      case 'SELECT_HIGHLIGHTED': {
        ctx.navigateTo('dictate', { type: 'chat' });
        ctx.startRecording();
        return nav;
      }
      case 'GO_BACK': {
        ctx.goBack();
        chatMode = 'scroll';
        return { ...nav, highlightedIndex: 0 };
      }
    }
  }

  function actionMenuNav(snap: Snapshot, act: GlassAction): GlassNavState | void {
    switch (act.type) {
      case 'HIGHLIGHT_MOVE': {
        const dir = act.direction === 'up' ? -1 : 1;
        menuIndex = clamp(menuIndex + dir, 0, MENU_FIELDS.length - 1);
        return;
      }
      case 'SELECT_HIGHLIGHTED': {
        chatMode = 'menu-edit';
        const field = MENU_FIELDS[menuIndex];
        if (field === 'model') {
          editIndex = getModelIndex(snap);
        } else {
          editIndex = snap.interactionMode === 'plan' ? 1 : 0;
        }
        return;
      }
      case 'GO_BACK': {
        chatMode = 'scroll';
        return;
      }
    }
  }

  function actionMenuEdit(snap: Snapshot, act: GlassAction): GlassNavState | void {
    const field = MENU_FIELDS[menuIndex];
    const optionCount = field === 'model' ? MODEL_OPTIONS.length : MODE_OPTIONS.length;

    switch (act.type) {
      case 'HIGHLIGHT_MOVE': {
        const dir = act.direction === 'up' ? -1 : 1;
        editIndex = clamp(editIndex + dir, 0, optionCount - 1);
        return;
      }
      case 'SELECT_HIGHLIGHTED': {
        // Apply the selection
        if (field === 'model') {
          const selected = MODEL_OPTIONS[editIndex];
          if (selected) ctx.setModel(selected.value);
        } else {
          const mode = editIndex === 1 ? 'plan' : 'default';
          if ((mode === 'plan') !== (snap.interactionMode === 'plan')) {
            ctx.toggleMode();
          }
        }
        chatMode = 'menu-nav';
        return;
      }
      case 'GO_BACK': {
        chatMode = 'menu-nav';
        return;
      }
    }
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max));
}
