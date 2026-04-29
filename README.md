# T3Code Lens

Smart glasses coding assistant for [Even Realities G2](https://evenrealities.com) glasses.
Connects to a headless [T3Code](https://github.com/pingdotgg/t3code) instance and lets you manage projects, sessions, and chat with your coding agent — entirely from the glasses display.

**App:** [jappyjan.github.io/T3Code-Lens](https://jappyjan.github.io/T3Code-Lens/)

### Requirements

- [Node.js](https://nodejs.org) >= 18 (T3Code is run via `npx t3`)
- [Tailscale](https://tailscale.com/download) with [Funnel enabled](https://tailscale.com/kb/1223/funnel#setup)

## Glasses Controls

| Gesture | Action |
|---------|--------|
| Scroll up/down | Navigate lists, scroll chat history |
| Single tap | Select item, start voice dictation |
| Double tap | Go back |

### Screens

- **Projects** — list all T3Code projects, create new ones via voice
- **Sessions** — list threads for a project, create new ones via voice
- **Chat** — view conversation (newest first, scroll back), streaming responses
- **Dictate** — voice input for messages; scroll toggles Chat/Plan mode

## Architecture

```
src/
  t3/          WebSocket RPC client + T3Code API
  glass/       G2 screen definitions + bridge controller
  stt/         Voice input (Web Speech API + even-toolkit STT)
  store/       Zustand state management
  pages/       Phone companion (settings + status)
  components/  QR scanner
```

## Development

```bash
npm install
npm run dev
```

Use arrow keys (up/down), Enter (select), and Escape (back) to simulate glasses gestures in the browser.
