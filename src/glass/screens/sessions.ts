// ── Glasses Screen: Sessions List ───────────────────────────────────
// Lists all threads for the selected project, newest first.

import { line, separator, glassHeader, buildScrollableList, DEFAULT_CONTENT_SLOTS } from 'even-toolkit';
import type { GlassNavState, GlassAction, GlassScreenDef, Snapshot, ScreenContext, DisplayData } from '../shared';
import { padLine, truncate } from '../shared';

export function createSessionsScreen(ctx: ScreenContext): GlassScreenDef {
  return { display, action };

  function getThreads(snap: Snapshot) {
    return snap.threads
      .filter((t) => t.projectId === snap.selectedProjectId && !t.deletedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  function display(nav: GlassNavState, snap: Snapshot): DisplayData {
    const project = snap.projects.find((p) => p.id === snap.selectedProjectId);

    // Items
    const threads = getThreads(snap);
    const items = threads.map((t) => {
      const status =
        t.session?.status === 'running' ? '\u25CF run' :
        t.session?.status === 'error'   ? '! err' : '  idle';
      return { label: t.title, suffix: status, id: t.id };
    });
    items.push({ label: '+ New Session', suffix: '', id: '' });

    // Header
    const headerLines = glassHeader(truncate(project?.title ?? '???', 30), 'SESSIONS');

    // Scrollable list
    const listLines = buildScrollableList({
      items,
      highlightedIndex: nav.highlightedIndex,
      maxVisible: DEFAULT_CONTENT_SLOTS,
      formatter: (item) => padLine(truncate(item.label, 30), item.suffix),
    });

    // Footer
    const footerLines = [
      separator(),
      line('TAP:open  \u25C0\u25C0:back', 'meta'),
    ];

    return { lines: [...headerLines, ...listLines, ...footerLines] };
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
