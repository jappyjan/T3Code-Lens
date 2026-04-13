// ── Settings Page (Phone Only) ──────────────────────────────────────
// Configuration for the T3Code server connection, speech recognition
// provider, and agent defaults. This is the only screen the user
// needs the phone for — everything else happens on the glasses.

import { useState } from 'react';
import { Link } from 'react-router';
import { useAppStore } from '../store';
import type { STTProvider } from '../stt/use-voice-input';
import type { RuntimeMode } from '../t3/types';

const START_CMD = 'bash <(curl -fsSL https://raw.githubusercontent.com/jappyjan/T3Code-Lens/main/start.sh)';

export function SettingsPage() {
  const { settings, setSettings, connect, disconnect, connected, connecting } = useAppStore();

  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [sessionToken, setSessionToken] = useState('');
  const [status, setStatus] = useState('');

  const handleConnect = () => {
    if (!serverUrl || !sessionToken.trim()) return;
    const url = serverUrl.replace(/\/$/, '');
    setSettings({ serverUrl: url, sessionToken: sessionToken.trim() });
    setSessionToken('');
    setStatus('Connecting...');
    connect();
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-md mx-auto space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center gap-4 py-4">
          <Link to="/" className="text-blue-400 text-sm hover:text-blue-300">&larr; Back</Link>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>

        {/* ── T3Code Server ─────────────────────────────────────── */}
        <Section title="T3Code Server">
          {!settings.sessionToken ? (
            <>
              {/* Quick-start instructions */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-400">
                  Run this on your T3Code machine to start everything:
                </p>
                <code
                  className="block bg-gray-950 rounded px-2 py-2 text-xs text-green-400 font-mono select-all break-all leading-relaxed cursor-pointer"
                  onClick={() => {
                    navigator.clipboard?.writeText(START_CMD);
                    setStatus('Copied to clipboard!');
                    setTimeout(() => setStatus(''), 2000);
                  }}
                  title="Click to copy"
                >
                  {START_CMD}
                </code>
                <p className="text-xs text-gray-600">
                  Click to copy. It starts T3Code, the CORS proxy, and a
                  Tailscale Funnel, then shows the server URL and session token.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-600">
                <div className="flex-1 border-t border-gray-800" />
                <span>then enter the details shown</span>
                <div className="flex-1 border-t border-gray-800" />
              </div>

              {/* Connection fields */}
              <Field label="Server URL (https://)">
                <input
                  type="url"
                  placeholder="https://your-machine.tailnet.ts.net"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className={inputClass}
                />
              </Field>

              {/* Mixed-content warning */}
              {serverUrl.startsWith('http://') && location.protocol === 'https:' && (
                <p className="text-xs text-yellow-400 bg-yellow-950 border border-yellow-900 rounded-lg px-3 py-2">
                  <strong>HTTPS required.</strong> Use the start script above &mdash;
                  it sets up an HTTPS tunnel automatically.
                </p>
              )}

              <Field label="Session Token">
                <input
                  type="text"
                  placeholder="Paste the token from the start script output"
                  value={sessionToken}
                  onChange={(e) => setSessionToken(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <button
                onClick={handleConnect}
                disabled={!serverUrl || !sessionToken.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg py-2.5 text-sm font-medium transition-colors"
              >
                Connect
              </button>

              {status && (
                <p className="text-xs text-gray-400 text-center">{status}</p>
              )}
            </>
          ) : (
            <>
              <div className="bg-gray-900 rounded-lg px-3 py-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-400">Connected</span>
                  <button
                    onClick={() => { disconnect(); setSettings({ sessionToken: '' }); }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Disconnect
                  </button>
                </div>
                <p className="text-xs text-gray-600 truncate">{settings.serverUrl}</p>
              </div>
            </>
          )}
        </Section>

        {/* ── Speech Recognition ────────────────────────────────── */}
        <Section title="Speech Recognition">
          <Field label="Provider">
            <select
              value={settings.sttProvider}
              onChange={(e) => setSettings({ sttProvider: e.target.value as STTProvider })}
              className={inputClass}
            >
              <option value="local">Local (Web Speech API — Free)</option>
              <option value="deepgram">Deepgram (Cloud Streaming)</option>
              <option value="soniox">Soniox (Cloud Streaming)</option>
              <option value="whisper-api">Whisper API (Cloud Batch)</option>
            </select>
          </Field>

          {settings.sttProvider !== 'local' && (
            <Field label="API Key">
              <input
                type="password"
                placeholder="Enter API key"
                value={settings.sttApiKey}
                onChange={(e) => setSettings({ sttApiKey: e.target.value })}
                className={inputClass}
              />
            </Field>
          )}

          <Field label="Language">
            <select
              value={settings.sttLanguage}
              onChange={(e) => setSettings({ sttLanguage: e.target.value })}
              className={inputClass}
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="de-DE">German</option>
              <option value="fr-FR">French</option>
              <option value="es-ES">Spanish</option>
              <option value="it-IT">Italian</option>
              <option value="pt-BR">Portuguese (BR)</option>
              <option value="ja-JP">Japanese</option>
              <option value="zh-CN">Chinese (Simplified)</option>
            </select>
          </Field>
        </Section>

        {/* ── Agent Defaults ────────────────────────────────────── */}
        <Section title="Agent Defaults">
          <Field label="Runtime Mode">
            <select
              value={settings.defaultRuntimeMode}
              onChange={(e) => setSettings({ defaultRuntimeMode: e.target.value as RuntimeMode })}
              className={inputClass}
            >
              <option value="auto-accept-edits">Auto-accept Edits</option>
              <option value="approval-required">Approval Required</option>
              <option value="full-access">Full Access</option>
            </select>
          </Field>

          <Field label="Default Model">
            <select
              value={`${settings.defaultModel.provider}:${settings.defaultModel.model}`}
              onChange={(e) => {
                const [provider, model] = e.target.value.split(':');
                if (provider && model) {
                  setSettings({
                    defaultModel: {
                      provider: provider as 'claudeAgent' | 'codex',
                      model,
                    },
                  });
                }
              }}
              className={inputClass}
            >
              <option value="claudeAgent:claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claudeAgent:claude-opus-4-6">Claude Opus 4.6</option>
              <option value="claudeAgent:claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
              <option value="codex:gpt-5.4">Codex GPT-5.4</option>
            </select>
          </Field>

          <Field label="Default Workspace Root">
            <input
              type="text"
              placeholder="/home/user"
              value={settings.defaultWorkspaceRoot}
              onChange={(e) => setSettings({ defaultWorkspaceRoot: e.target.value })}
              className={inputClass}
            />
          </Field>
        </Section>
      </div>
    </div>
  );
}

// ── Shared Components ──────────────────────────────────────────────

const inputClass =
  'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:border-blue-500 transition-colors';

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{props.label}</label>
      {props.children}
    </div>
  );
}
