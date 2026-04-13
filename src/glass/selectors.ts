// ── Glass Screen Router ─────────────────────────────────────────────
// Maps screen names to their implementations. Created once with the
// ScreenContext and used by the glasses controller.

import { createProjectsScreen } from './screens/projects';
import { createSessionsScreen } from './screens/sessions';
import { createChatScreen } from './screens/chat';
import { createDictateScreen } from './screens/dictate';
import type { ScreenContext, ScreenName, GlassScreenDef } from './shared';

export type ScreenRouter = Record<ScreenName, GlassScreenDef>;

export function createScreenRouter(ctx: ScreenContext): ScreenRouter {
  return {
    projects: createProjectsScreen(ctx),
    sessions: createSessionsScreen(ctx),
    chat: createChatScreen(ctx),
    dictate: createDictateScreen(ctx),
  };
}
