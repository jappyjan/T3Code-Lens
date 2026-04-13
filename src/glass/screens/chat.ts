// ── Glasses Screen: Chat View ───────────────────────────────────────
// Shows the conversation for the active thread.
// Newest messages at the bottom; scroll UP to see older history.
// Supports chat mode, plan mode, approval requests, and streaming.

import type { GlassNavState, GlassAction, GlassScreenDef, Snapshot, ScreenContext } from '../shared';
import { G2_CHARS, RULE, padLine, truncate, wrapText } from '../shared';

const CHAT_LINES = 7;
const USER_PREFIX = '> ';
const ASST_PREFIX = '< ';
const SYS_PREFIX  = '= ';

export function createChatScreen(ctx: ScreenContext): GlassScreenDef {
  return { display, action };

  function buildDisplayLines(snap: Snapshot): string[] {
    const allLines: string[] = [];

    // Render messages oldest → newest (display order bottom = newest)
    for (const msg of snap.messages) {
      const prefix =
        msg.role === 'user'      ? USER_PREFIX :
        msg.role === 'assistant' ? ASST_PREFIX : SYS_PREFIX;
      allLines.push(...wrapText(prefix + msg.text, G2_CHARS));
    }

    // Streaming text from agent
    if (snap.streamingText) {
      const streamLines = wrapText(ASST_PREFIX + snap.streamingText, G2_CHARS);
      if (snap.threadStatus === 'running') {
        const last = streamLines[streamLines.length - 1];
        if (last && last.length < G2_CHARS - 1) {
          streamLines[streamLines.length - 1] = last + '\u2588';
        }
      }
      allLines.push(...streamLines);
    }

    // Pending approval request
    if (snap.pendingApproval) {
      allLines.push('');
      allLines.push('! APPROVE? ' + truncate(snap.pendingApproval.description, G2_CHARS - 11));
      allLines.push('  SCROLL UP=allow  DOWN=deny');
    }

    return allLines;
  }

  function display(nav: GlassNavState, snap: Snapshot): string[] {
    const lines: string[] = [];
    const thread = snap.threads.find((t) => t.id === snap.selectedThreadId);
    const mode = snap.interactionMode === 'plan' ? 'PLAN' : 'CHAT';
    const status =
      snap.threadStatus === 'running' ? ' \u25CF' :
      snap.threadStatus === 'error'   ? ' !'    : '';

    // Header
    lines.push(padLine(truncate(thread?.title ?? 'Chat', 28), mode + status));
    lines.push(RULE);

    // Chat lines — scroll position 0 = show newest (bottom of allLines)
    const allLines = buildDisplayLines(snap);
    const total = allLines.length;
    const scrollPos = nav.highlightedIndex; // 0 = newest, increases = older

    // Window: show CHAT_LINES from the end, offset by scrollPos
    const endIdx = total - scrollPos;
    const startIdx = Math.max(0, endIdx - CHAT_LINES);
    const visible = allLines.slice(startIdx, endIdx);

    for (let i = 0; i < CHAT_LINES; i++) {
      lines.push(visible[i] ?? '');
    }

    // Footer
    lines.push(RULE);
    const canOlder = startIdx > 0;
    const canNewer = scrollPos > 0;
    const scroll = (canOlder ? '\u25B2' : ' ') + (canNewer ? '\u25BC' : ' ');
    const page = total > CHAT_LINES
      ? `${Math.floor(scrollPos / CHAT_LINES) + 1}/${Math.ceil(total / CHAT_LINES)}`
      : '';
    lines.push(padLine(`TAP:talk  \u25C0\u25C0:back  ${mode}`, `${page} ${scroll}`));

    return lines;
  }

  function action(nav: GlassNavState, snap: Snapshot, act: GlassAction): GlassNavState | void {
    const allLines = buildDisplayLines(snap);
    const maxScroll = Math.max(0, allLines.length - CHAT_LINES);

    switch (act.type) {
      case 'HIGHLIGHT_MOVE': {
        // If there's a pending approval at scroll position 0, handle it
        if (snap.pendingApproval && nav.highlightedIndex === 0) {
          ctx.respondApproval(act.direction === 'up' ? 'allow' : 'deny');
          return nav;
        }
        // UP = scroll to older messages (increase index)
        const dir = act.direction === 'up' ? 1 : -1;
        return { ...nav, highlightedIndex: clamp(nav.highlightedIndex + dir, 0, maxScroll) };
      }
      case 'SELECT_HIGHLIGHTED': {
        ctx.navigateTo('dictate', { type: 'chat' });
        ctx.startRecording();
        return nav;
      }
      case 'GO_BACK': {
        ctx.goBack();
        return { ...nav, highlightedIndex: 0 };
      }
    }
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max));
}
