// ── Glasses Screen: Voice Dictation ─────────────────────────────────
// Shows the live transcript while recording. Used for:
//   - Sending chat messages
//   - Naming new projects
//   - Naming new sessions
// Scroll toggles chat/plan mode. Tap sends. Double-tap cancels.

import { line, separator } from 'even-toolkit';
import type { GlassNavState, GlassAction, GlassScreenDef, Snapshot, ScreenContext, DisplayData } from '../shared';
import { G2_CHARS, padLine, wrapText } from '../shared';

const TRANSCRIPT_LINES = 6;

export function createDictateScreen(ctx: ScreenContext): GlassScreenDef {
  return { display, action };

  function display(_nav: GlassNavState, snap: Snapshot): DisplayData {
    const lines = [];

    // Header — shows what the dictation is for
    const intentLabel =
      snap.dictateIntent.type === 'new-project' ? 'NEW PROJECT' :
      snap.dictateIntent.type === 'new-session' ? 'NEW SESSION' :
      'DICTATING';
    const rec = snap.isRecording ? '\u25CF REC' : '  ---';
    lines.push(line(padLine(intentLabel, rec), 'meta'));
    lines.push(separator());

    // Live transcript
    const full = snap.transcript
      + (snap.interimTranscript ? ' ' + snap.interimTranscript + '_' : '');
    const placeholder = snap.isRecording ? 'Listening...' : 'Tap to record';
    const wrapped = wrapText(full || placeholder, G2_CHARS);

    // Show the last TRANSCRIPT_LINES of wrapped text
    const visible = wrapped.slice(-TRANSCRIPT_LINES);
    for (let i = 0; i < TRANSCRIPT_LINES; i++) {
      lines.push(line(visible[i] ?? ''));
    }

    // Footer
    lines.push(separator());
    const mode = snap.interactionMode === 'plan' ? 'PLAN' : 'CHAT';
    lines.push(line(padLine(`TAP:send  \u25C0\u25C0:cancel  ${mode}`, ''), 'meta'));

    return { lines };
  }

  function action(_nav: GlassNavState, _snap: Snapshot, act: GlassAction): GlassNavState | void {
    switch (act.type) {
      case 'HIGHLIGHT_MOVE':
        // Scroll toggles chat <-> plan mode
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
