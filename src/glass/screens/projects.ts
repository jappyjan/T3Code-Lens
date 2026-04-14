// ── Glasses Screen: Projects List ───────────────────────────────────
// Scrollable list of all T3Code projects. Selection only — creation is on the phone.

import { line, separator, glassHeader, buildScrollableList, DEFAULT_CONTENT_SLOTS } from 'even-toolkit';
import type { GlassNavState, GlassAction, GlassScreenDef, Snapshot, ScreenContext, DisplayData } from '../shared';
import { padLine, truncate } from '../shared';

export function createProjectsScreen(ctx: ScreenContext): GlassScreenDef {
  return { display, action };

  function display(nav: GlassNavState, snap: Snapshot): DisplayData {
    // Item list: projects + "New Project"
    const items = snap.projects.map((p) => {
      const n = snap.threads.filter((t) => t.projectId === p.id && !t.deletedAt).length;
      return { label: p.title, suffix: `${n}`, id: p.id };
    });

    // Header
    const badge = snap.connected ? 'PROJECTS' : 'OFFLINE';
    const headerLines = glassHeader('T3Code Lens', badge);

    // Scrollable list with highlight
    const listLines = buildScrollableList({
      items,
      highlightedIndex: nav.highlightedIndex,
      maxVisible: DEFAULT_CONTENT_SLOTS,
      formatter: (item) => padLine(truncate(item.label, 36), item.suffix),
    });

    // Footer
    const footerLines = [
      separator(),
      line('TAP:open  SCROLL:nav', 'meta'),
    ];

    return { lines: [...headerLines, ...listLines, ...footerLines] };
  }

  function action(nav: GlassNavState, snap: Snapshot, act: GlassAction): GlassNavState | void {
    const count = snap.projects.length;
    if (count === 0) return nav;

    switch (act.type) {
      case 'HIGHLIGHT_MOVE': {
        const dir = act.direction === 'up' ? -1 : 1;
        return { ...nav, highlightedIndex: clamp(nav.highlightedIndex + dir, 0, count - 1) };
      }
      case 'SELECT_HIGHLIGHTED': {
        const p = snap.projects[nav.highlightedIndex];
        if (p) { ctx.selectProject(p.id); ctx.navigateTo('sessions'); }
        return { ...nav, highlightedIndex: 0 };
      }
      case 'GO_BACK':
        return nav;
    }
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max));
}
