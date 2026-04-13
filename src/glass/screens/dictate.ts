// ── Glasses Screen: Voice Dictation ─────────────────────────────────
// Shows the live transcript while recording. Used for:
//   - Sending chat messages
//   - Naming new projects
//   - Naming new sessions
// Scroll toggles chat/plan mode. Tap sends. Double-tap cancels.

import type { GlassNavState, GlassAction, GlassScreenDef, Snapshot, ScreenContext } from '../shared';
import { G2_CHARS, RULE, padLine, wrapText } from '../shared';

const TRANSCRIPT_LINES = 6;

export function createDictateScreen(ctx: ScreenContext): GlassScreenDef {
  return { display, action };

  function display(nav: GlassNavState, snap: Snapshot): string[] {
    const lines: string[] = [];

    // Header — shows what the dictation is for
    const intentLabel =
      snap.dictateIntent.type === 'new-project' ? 'NEW PROJECT' :
      snap.dictateIntent.type === 'new-session' ? 'NEW SESSION' :
      'DICTATING';
    const rec = snap.isRecording ? '\u25CF REC' : '  ---';
    lines.push(padLine(intentLabel, rec));
    lines.push(RULE);

    // Live transcript
    const full = snap.transcript
      + (snap.interimTranscript ? ' ' + snap.interimTranscript + '_' : '');
    const placeholder = snap.isRecording ? 'Listening...' : 'Tap to record';
    const wrapped = wrapText(full || placeholder, G2_CHARS);

    // Show the last TRANSCRIPT_LINES of wrapped text
    const visible = wrapped.slice(-TRANSCRIPT_LINES);
    for (let i = 0; i < TRANSCRIPT_LINES; i++) {
      lines.push(visible[i] ?? '');
    }

    // Footer
    lines.push(RULE);
    const mode = snap.interactionMode === 'plan' ? 'PLAN' : 'CHAT';
    lines.push(padLine(`TAP:send  \u25C0\u25C0:cancel  ${mode}`, ''));

    return lines;
  }

  function action(_nav: GlassNavState, _snap: Snapshot, act: GlassAction): GlassNavState | void {
    switch (act.type) {
      case 'HIGHLIGHT_MOVE':
        // Scroll toggles chat ↔ plan mode
        ctx.toggleMode();
        return;
      case 'SELECT_HIGHLIGHTED':
        // Send the transcript
        ctx.stopAndSend();
        return;
      case 'GO_BACK':
        ctx.cancelRecording();
        return;
    }
  }
}
