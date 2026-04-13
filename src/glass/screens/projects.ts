// ── Glasses Screen: Projects List ───────────────────────────────────
// Scrollable list of all T3Code projects with "+ New Project" action.

import type { GlassNavState, GlassAction, GlassScreenDef, Snapshot, ScreenContext } from '../shared';
import { G2_CHARS, CONTENT_LINES, RULE, padLine, truncate } from '../shared';

export function createProjectsScreen(ctx: ScreenContext): GlassScreenDef {
  return { display, action };

  function display(nav: GlassNavState, snap: Snapshot): string[] {
    const lines: string[] = [];

    // Header
    const badge = snap.connected ? 'PROJECTS' : 'OFFLINE';
    lines.push(padLine('T3Code Lens', badge));
    lines.push(RULE);

    // Item list: projects + "New Project"
    const items = snap.projects.map((p) => {
      const n = snap.threads.filter((t) => t.projectId === p.id && !t.deletedAt).length;
      return { label: p.title, suffix: `${n}`, id: p.id };
    });
    items.push({ label: '+ New Project', suffix: '', id: '' });

    // Scrollable window
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
    lines.push(padLine('TAP:open  SCROLL:nav', scroll));

    return lines;
  }

  function action(nav: GlassNavState, snap: Snapshot, act: GlassAction): GlassNavState | void {
    const count = snap.projects.length + 1;

    switch (act.type) {
      case 'HIGHLIGHT_MOVE': {
        const dir = act.direction === 'up' ? -1 : 1;
        return { ...nav, highlightedIndex: clamp(nav.highlightedIndex + dir, 0, count - 1) };
      }
      case 'SELECT_HIGHLIGHTED': {
        if (nav.highlightedIndex < snap.projects.length) {
          const p = snap.projects[nav.highlightedIndex];
          if (p) { ctx.selectProject(p.id); ctx.navigateTo('sessions'); }
        } else {
          ctx.navigateTo('dictate', { type: 'new-project' });
          ctx.startRecording();
        }
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
