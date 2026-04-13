// ── Glasses Controller Hook ─────────────────────────────────────────
// Bridges the React app to the Even Realities G2 glasses.
//
// 1. Initialises the EvenHubBridge (dynamic import — graceful fallback)
// 2. Polls the app snapshot every 100 ms and pushes text to the display
// 3. Maps gesture events (tap / double-tap / scroll) to GlassActions
// 4. In development mode (no bridge) adds keyboard shortcuts:
//      Arrow Up/Down  → HIGHLIGHT_MOVE
//      Enter / Space  → SELECT_HIGHLIGHTED
//      Escape / Back  → GO_BACK

import { useEffect, useRef } from 'react';
import type { Snapshot, ScreenName, GlassNavState, GlassAction, GlassScreenDef } from './shared';

interface ControllerConfig {
  screens: Record<ScreenName, GlassScreenDef>;
  getSnapshot: () => Snapshot;
  getCurrentScreen: () => ScreenName;
}

export function useGlassesController(config: ControllerConfig) {
  // Use refs so the effect closure always sees fresh values
  const cfgRef = useRef(config);
  cfgRef.current = config;

  const navRef = useRef<Record<string, GlassNavState>>({});
  const bridgeRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    let pollTimer: ReturnType<typeof setInterval>;
    let keyCleanup: (() => void) | undefined;

    // ── Helpers ────────────────────────────────────────────────────

    function getNav(screen: ScreenName): GlassNavState {
      if (!navRef.current[screen]) {
        navRef.current[screen] = { highlightedIndex: 0, screen };
      }
      return navRef.current[screen]!;
    }

    function dispatchAction(action: GlassAction) {
      const cfg = cfgRef.current;
      const screenName = cfg.getCurrentScreen();
      const screen = cfg.screens[screenName];
      if (!screen) return;

      const nav = getNav(screenName);
      const snapshot = cfg.getSnapshot();
      const result = screen.action(nav, snapshot, action);
      if (result) navRef.current[screenName] = result;
      pushDisplay(); // immediate refresh
    }

    function pushDisplay() {
      const cfg = cfgRef.current;
      const screenName = cfg.getCurrentScreen();
      const screen = cfg.screens[screenName];
      if (!screen) return;

      const nav = getNav(screenName);
      const snapshot = cfg.getSnapshot();
      const lines = screen.display(nav, snapshot);
      const bridge = bridgeRef.current;

      if (bridge) {
        try {
          // Even-toolkit bridge text mode — try known methods
          if (typeof bridge.sendTextPage === 'function') {
            bridge.sendTextPage(lines);
          } else if (typeof bridge.showText === 'function') {
            bridge.showText(lines.join('\n'));
          } else if (typeof bridge.sendPage === 'function') {
            bridge.sendPage('text', { content: lines.join('\n') });
          }
        } catch {
          // bridge send error — non-fatal
        }
      }
    }

    // ── Initialise bridge ──────────────────────────────────────────

    async function initBridge() {
      try {
        const mod = await import('even-toolkit/glasses');
        const bridge = new mod.EvenHubBridge();
        await bridge.init();
        if (!mounted) return;
        bridgeRef.current = bridge;

        // Register gesture callbacks via mapGlassEvent or direct events
        if (typeof mod.mapGlassEvent === 'function' && typeof bridge.onEvent === 'function') {
          bridge.onEvent((event: unknown) => {
            const action = mod.mapGlassEvent(event) as GlassAction | null;
            if (action) dispatchAction(action);
          });
        }

        // Also try direct event registration (adapter pattern)
        if (typeof bridge.addEventListener === 'function') {
          bridge.addEventListener('tap', () => dispatchAction({ type: 'SELECT_HIGHLIGHTED' }));
          bridge.addEventListener('doubleTap', () => dispatchAction({ type: 'GO_BACK' }));
          bridge.addEventListener('scrollUp', () => dispatchAction({ type: 'HIGHLIGHT_MOVE', direction: 'up' }));
          bridge.addEventListener('scrollDown', () => dispatchAction({ type: 'HIGHLIGHT_MOVE', direction: 'down' }));
        }
      } catch {
        console.info('[T3Code Lens] Even Hub Bridge unavailable — keyboard mode active');
        keyCleanup = setupKeyboard(dispatchAction);
      }
    }

    initBridge();

    // Start display polling at 100 ms
    pollTimer = setInterval(pushDisplay, 100);

    return () => {
      mounted = false;
      clearInterval(pollTimer);
      keyCleanup?.();
      bridgeRef.current?.shutdown?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

// ── Keyboard fallback for development ──────────────────────────────

function setupKeyboard(dispatch: (a: GlassAction) => void): () => void {
  const handler = (e: KeyboardEvent) => {
    // Ignore when typing in an input field
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        dispatch({ type: 'HIGHLIGHT_MOVE', direction: 'up' });
        break;
      case 'ArrowDown':
        e.preventDefault();
        dispatch({ type: 'HIGHLIGHT_MOVE', direction: 'down' });
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        dispatch({ type: 'SELECT_HIGHLIGHTED' });
        break;
      case 'Escape':
      case 'Backspace':
        e.preventDefault();
        dispatch({ type: 'GO_BACK' });
        break;
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
