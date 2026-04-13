// ── Glasses Screen: Sessions List ───────────────────────────────────
// Lists all threads for the selected project, newest first.

import type { GlassNavState, GlassAction, GlassScreenDef, Snapshot, ScreenContext } from '../shared';
import { G2_CHARS, CONTENT_LINES, RULE, padLine, truncate } from '../shared';

export function createSessionsScreen(ctx: ScreenContext): GlassScreenDef {
  return { display, action };

  function getThreads(snap: Snapshot) {
    return snap.threads
      .filter((t) => t.projectId === snap.selectedProjectId && !t.deletedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  function display(nav: GlassNavState, snap: Snapshot): string[] {
    const lines: string[] = [];
    const project = snap.projects.find((p) => p.id === snap.selectedProjectId);

    // Header
    lines.push(padLine(truncate(project?.title ?? '???', 30), 'SESSIONS'));
    lines.push(RULE);

    // Items
    const threads = getThreads(snap);
    const items = threads.map((t) => {
      const status =
        t.session?.status === 'running' ? '\u25CF run' :
        t.session?.status === 'error'   ? '! err' : '  idle';
      return { label: t.title, suffix: status, id: t.id };
    });
    items.push({ label: '+ New Session', suffix: '', id: '' });

    const maxVis = CONTENT_LINES;
    const offset = Math.max(0, Math.min(nav.highlightedIndex - maxVis + 1, items.length - maxVis));
    const visible = items.slice(offset, offset + maxVis);

    for (let i = 0; i < maxVis; i++) {
      const item = visible[i];
      if (!item) { lines.push(''); continue; }
      const idx = offset + i;
      const marker = idx === nav.highlightedIndex ? '\u25B8 ' : '  ';
      const avail = G2_CHARS - marker.length - item.suffix.length - 1;
      const label = truncate(item.label, avail);
      lines.push(padLine(marker + label, item.suffix));
    }

    // Footer
    lines.push(RULE);
    const canUp = offset > 0;
    const canDown = offset + maxVis < items.length;
    const scroll = (canUp ? '\u25B2' : ' ') + (canDown ? '\u25BC' : ' ');
    lines.push(padLine('TAP:open  \u25C0\u25C0:back', scroll));

    return lines;
  }

  function action(nav: GlassNavState, snap: Snapshot, act: GlassAction): GlassNavState | void {
    const threads = getThreads(snap);
    const count = threads.length + 1;

    switch (act.type) {
      case 'HIGHLIGHT_MOVE': {
        const dir = act.direction === 'up' ? -1 : 1;
        return { ...nav, highlightedIndex: clamp(nav.highlightedIndex + dir, 0, count - 1) };
      }
      case 'SELECT_HIGHLIGHTED': {
        if (nav.highlightedIndex < threads.length) {
          const t = threads[nav.highlightedIndex];
          if (t) { ctx.selectThread(t.id); ctx.navigateTo('chat'); }
        } else {
          ctx.navigateTo('dictate', { type: 'new-session' });
          ctx.startRecording();
        }
        return { ...nav, highlightedIndex: 0 };
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
