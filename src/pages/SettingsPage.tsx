// ── Settings Page (Phone Only) ──────────────────────────────────────
// Configuration for the T3Code server connection, speech recognition
// provider, and agent defaults. This is the only screen the user
// needs the phone for — everything else happens on the glasses.

import { useState } from 'react';
import { Link } from 'react-router';
import { useAppStore } from '../store';
import { QrScanner } from '../components/QrScanner';
import { parsePairingUrl } from '../utils/parse-pairing-url';
import type { STTProvider } from '../stt/use-voice-input';
import type { RuntimeMode } from '../t3/types';

export function SettingsPage() {
  const { settings, setSettings, connect, disconnect, connected, connecting } = useAppStore();

  const [pairingToken, setPairingToken] = useState('');
  const [pairingStatus, setPairingStatus] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [directToken, setDirectToken] = useState('');
  const [manualServerUrl, setManualServerUrl] = useState(settings.serverUrl);

  // ── Pairing via HTTP (works same-origin, blocked by CORS cross-origin) ──

  const pairWithToken = async (serverUrl: string, token: string) => {
    setPairingStatus('Pairing...');
    try {
      const url = serverUrl.replace(/\/$/, '');
      const res = await fetch(`${url}/api/auth/bootstrap/bearer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: token }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setSettings({ serverUrl: url, sessionToken: data.sessionToken });
      setPairingStatus('Paired successfully!');
      setPairingToken('');
      connect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
        setPairingStatus(
          'CORS error — the T3Code server blocked the cross-origin request. ' +
          'Use "Session Token" mode below instead.',
        );
        setShowTokenInput(true);
      } else {
        setPairingStatus(msg);
      }
    }
  };

  const handlePair = () => {
    if (!manualServerUrl || !pairingToken) return;
    pairWithToken(manualServerUrl, pairingToken);
  };

  const handleQrScan = (value: string) => {
    setShowScanner(false);
    const parsed = parsePairingUrl(value);
    if (parsed) {
      setManualServerUrl(parsed.serverUrl);
      setSettings({ serverUrl: parsed.serverUrl });
      pairWithToken(parsed.serverUrl, parsed.token);
    } else {
      setPairingStatus('Invalid QR code — expected a t3 pairing URL');
    }
  };

  // ── Direct session token (bypasses CORS — only needs WebSocket) ──

  const handleDirectToken = () => {
    if (!manualServerUrl || !directToken.trim()) return;
    const url = manualServerUrl.replace(/\/$/, '');
    setSettings({ serverUrl: url, sessionToken: directToken.trim() });
    setDirectToken('');
    setPairingStatus('Token saved — connecting...');
    connect();
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      {showScanner && (
        <QrScanner onScan={handleQrScan} onClose={() => setShowScanner(false)} />
      )}

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
              {/* QR scan button — primary action */}
              <button
                onClick={() => setShowScanner(true)}
                className="w-full bg-blue-600 hover:bg-blue-500 rounded-lg py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="3" height="3" />
                  <line x1="21" y1="14" x2="21" y2="17" />
                  <line x1="14" y1="21" x2="17" y2="21" />
                  <line x1="21" y1="21" x2="21" y2="21" />
                </svg>
                Scan QR Code from t3 serve
              </button>

              <div className="flex items-center gap-3 text-xs text-gray-600">
                <div className="flex-1 border-t border-gray-800" />
                <span>or enter manually</span>
                <div className="flex-1 border-t border-gray-800" />
              </div>

              {/* Server URL — shared by both manual methods */}
              <Field label="Server URL">
                <input
                  type="url"
                  placeholder="https://my-machine.tail1234.ts.net:3773"
                  value={manualServerUrl}
                  onChange={(e) => setManualServerUrl(e.target.value)}
                  className={inputClass}
                />
              </Field>

              {/* Mixed-content warning */}
              {manualServerUrl.startsWith('http://') && location.protocol === 'https:' && (() => {
                let port = '3773';
                try { port = new URL(manualServerUrl).port || '3773'; } catch {}
                return (
                  <div className="text-xs bg-yellow-950 border border-yellow-900 text-yellow-400 rounded-lg px-3 py-2 space-y-1.5">
                    <p>
                      <strong>HTTPS required:</strong> This app is served over HTTPS,
                      so the T3Code server must be reachable over HTTPS too.
                    </p>
                    <p>
                      Easiest fix &mdash; run <strong>cloudflared</strong> on the
                      T3Code machine (free, no account needed):
                    </p>
                    <code className="block bg-gray-950 rounded px-2 py-1.5 text-green-400 font-mono select-all">
                      cloudflared tunnel --url http://localhost:{port}
                    </code>
                    <p>
                      It prints an <strong>https://...trycloudflare.com</strong> URL
                      &mdash; paste that here as the server URL.
                    </p>
                    <p className="text-gray-600 pt-1">
                      Install: <code className="text-gray-500">brew install cloudflared</code> (macOS)
                      or <code className="text-gray-500">apt install cloudflared</code> (Linux)
                    </p>
                  </div>
                );
              })()}

              {/* Pairing token method */}
              <Field label="Pairing Token">
                <input
                  type="text"
                  placeholder="Paste token from t3 serve output"
                  value={pairingToken}
                  onChange={(e) => setPairingToken(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <button
                onClick={handlePair}
                disabled={!manualServerUrl || !pairingToken}
                className="w-full bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg py-2.5 text-sm font-medium transition-colors"
              >
                Pair Manually
              </button>

              {pairingStatus && (
                <p className="text-xs text-yellow-400 bg-yellow-950 border border-yellow-900 rounded-lg px-3 py-2">{pairingStatus}</p>
              )}

              {/* Session token fallback — works cross-origin */}
              <div className="flex items-center gap-3 text-xs text-gray-600 pt-2">
                <div className="flex-1 border-t border-gray-800" />
                <button
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  className="text-blue-400 hover:text-blue-300 whitespace-nowrap"
                >
                  {showTokenInput ? 'hide' : 'CORS issues? use session token'}
                </button>
                <div className="flex-1 border-t border-gray-800" />
              </div>

              {showTokenInput && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-3">
                  <p className="text-xs text-gray-500">
                    While <span className="text-gray-400">t3 serve</span> is running,
                    open a <span className="text-gray-400">second terminal</span> on the
                    same machine and run:
                  </p>
                  <code className="block bg-gray-950 rounded px-2 py-1.5 text-xs text-green-400 font-mono select-all">
                    t3 auth session issue --token-only
                  </code>
                  <Field label="Session Token">
                    <input
                      type="text"
                      placeholder="Paste the session token here"
                      value={directToken}
                      onChange={(e) => setDirectToken(e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <button
                    onClick={handleDirectToken}
                    disabled={!manualServerUrl || !directToken.trim()}
                    className="w-full bg-green-900 hover:bg-green-800 disabled:bg-gray-800 disabled:text-gray-600 text-green-200 rounded-lg py-2.5 text-sm font-medium transition-colors"
                  >
                    Connect with Session Token
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2.5">
                <span className="text-xs text-green-400">Device Paired</span>
                <button
                  onClick={() => { disconnect(); setSettings({ sessionToken: '' }); }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Unpair
                </button>
              </div>
              <button
                onClick={connected ? disconnect : () => connect()}
                disabled={connecting}
                className={`w-full rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  connected
                    ? 'bg-red-900 hover:bg-red-800 text-red-200'
                    : 'bg-green-900 hover:bg-green-800 text-green-200'
                }`}
              >
                {connecting ? 'Connecting...' : connected ? 'Disconnect' : 'Connect'}
              </button>
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
