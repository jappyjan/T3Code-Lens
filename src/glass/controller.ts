// ── Glasses Controller Hook ─────────────────────────────────────────
// Bridges the React app to the Even Realities G2 glasses via the
// even-toolkit useGlasses hook. Manages per-screen navigation state
// and delegates bridge lifecycle, polling, gestures, and keyboard
// fallback to the toolkit.

import { useRef } from 'react';
import { useGlasses } from 'even-toolkit/useGlasses';
import type { GlassAction, GlassNavState } from 'even-toolkit';
import type { ScreenName, GlassScreenDef, Snapshot } from './shared';

interface ControllerConfig {
  screens: Record<ScreenName, GlassScreenDef>;
  getSnapshot: () => Snapshot;
  getCurrentScreen: () => ScreenName;
}

export function useGlassesController(config: ControllerConfig) {
  // Use refs so the hook closures always see fresh values
  const cfgRef = useRef(config);
  cfgRef.current = config;

  const navRef = useRef<Record<string, GlassNavState>>({});

  function getNav(screen: string): GlassNavState {
    if (!navRef.current[screen]) {
      navRef.current[screen] = { highlightedIndex: 0, screen };
    }
    return navRef.current[screen]!;
  }

  useGlasses<Snapshot>({
    appName: 'T3Code Lens',

    getSnapshot: () => cfgRef.current.getSnapshot(),

    deriveScreen: () => cfgRef.current.getCurrentScreen(),

    toDisplayData: (_snapshot, nav) => {
      const cfg = cfgRef.current;
      const screenName = cfg.getCurrentScreen();
      const screen = cfg.screens[screenName];
      if (!screen) return { lines: [] };
      return screen.display(nav, cfg.getSnapshot());
    },

    onGlassAction: (action: GlassAction, nav: GlassNavState) => {
      const cfg = cfgRef.current;
      const screenName = cfg.getCurrentScreen();
      const screen = cfg.screens[screenName];
      if (!screen) return nav;
      const result = screen.action(nav, cfg.getSnapshot(), action);
      if (result) {
        navRef.current[screenName] = result;
        return result;
      }
      return nav;
    },
  });
}
