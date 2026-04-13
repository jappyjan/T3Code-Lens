# T3Code Lens

Smart glasses coding assistant for [Even Realities G2](https://evenrealities.com) glasses.
Connects to a headless [T3Code](https://github.com/pingdotgg/t3code) instance and lets you manage projects, sessions, and chat with your coding agent — entirely from the glasses display.

**App:** [jappyjan.github.io/T3Code-Lens](https://jappyjan.github.io/T3Code-Lens/)

## Quick Start

On your T3Code machine, run:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/jappyjan/T3Code-Lens/main/start.sh)
```

This single command:
1. Starts T3Code (`t3 serve --host 0.0.0.0`)
2. Starts a CORS proxy (needed for cross-origin browser connections)
3. Starts a Tailscale Funnel (HTTPS tunnel)
4. Generates a session token
5. Prints the server URL, token, and a QR code

Then open the [app](https://jappyjan.github.io/T3Code-Lens/), go to **Settings**, and paste the server URL and session token.

### Requirements

- [T3Code](https://github.com/pingdotgg/t3code) (`t3` CLI)
- [Node.js](https://nodejs.org) >= 18
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
