// ── Settings Page (Phone Only) ──────────────────────────────────────
// Configuration for the T3Code server connection, speech recognition
// provider, and agent defaults. This is the only screen the user
// needs the phone for — everything else happens on the glasses.

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, Button, Input, Select, SettingsGroup, SectionHeader, NavHeader } from 'even-toolkit/web';
import { useAppStore } from '../store';
import type { STTProvider } from '../stt/use-voice-input';
import type { RuntimeMode } from '../t3/types';

const START_CMD = 'bash <(curl -fsSL https://raw.githubusercontent.com/jappyjan/T3Code-Lens/main/start.sh)';

export function SettingsPage() {
  const { settings, setSettings, connect, disconnect, connected, connecting } = useAppStore();
  const navigate = useNavigate();

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
        <NavHeader
          title="Settings"
          left={
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              &larr; Back
            </Button>
          }
        />

        {/* ── T3Code Server ─────────────────────────────────────── */}
        <SectionHeader title="T3Code Server" />

        {!settings.sessionToken ? (
          <div className="space-y-3">
            {/* Quick-start instructions */}
            <Card>
              <p className="text-xs text-gray-400 mb-2">
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
              <p className="text-xs text-gray-600 mt-2">
                Click to copy. It starts T3Code, the CORS proxy, and a
                Tailscale Funnel, then shows the server URL and session token.
              </p>
            </Card>

            <div className="flex items-center gap-3 text-xs text-gray-600">
              <div className="flex-1 border-t border-gray-800" />
              <span>then enter the details shown</span>
              <div className="flex-1 border-t border-gray-800" />
            </div>

            {/* Connection fields */}
            <SettingsGroup label="Server URL (https://)">
              <Input
                type="url"
                placeholder="https://your-machine.tailnet.ts.net"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
              />
            </SettingsGroup>

            {/* Mixed-content warning */}
            {serverUrl.startsWith('http://') && location.protocol === 'https:' && (
              <Card className="border border-yellow-900 bg-yellow-950">
                <p className="text-xs text-yellow-400">
                  <strong>HTTPS required.</strong> Use the start script above &mdash;
                  it sets up an HTTPS tunnel automatically.
                </p>
              </Card>
            )}

            <SettingsGroup label="Session Token">
              <Input
                type="text"
                placeholder="Paste the token from the start script output"
                value={sessionToken}
                onChange={(e) => setSessionToken(e.target.value)}
              />
            </SettingsGroup>

            <Button
              variant="highlight"
              className="w-full"
              onClick={handleConnect}
              disabled={!serverUrl || !sessionToken.trim()}
            >
              Connect
            </Button>

            {status && (
              <p className="text-xs text-gray-400 text-center">{status}</p>
            )}
          </div>
        ) : (
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-400">Connected</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { disconnect(); setSettings({ sessionToken: '' }); }}
              >
                Disconnect
              </Button>
            </div>
            <p className="text-xs text-gray-600 truncate mt-1">{settings.serverUrl}</p>
          </Card>
        )}

        {/* ── Speech Recognition ────────────────────────────────── */}
        <SectionHeader title="Speech Recognition" />

        <SettingsGroup label="Provider">
          <Select
            value={settings.sttProvider}
            options={[
              { value: 'local', label: 'Local (Web Speech API \u2014 Free)' },
              { value: 'deepgram', label: 'Deepgram (Cloud Streaming)' },
              { value: 'soniox', label: 'Soniox (Cloud Streaming)' },
              { value: 'whisper-api', label: 'Whisper API (Cloud Batch)' },
            ]}
            onValueChange={(v) => setSettings({ sttProvider: v as STTProvider })}
          />
        </SettingsGroup>

        {settings.sttProvider !== 'local' && (
          <SettingsGroup label="API Key">
            <Input
              type="password"
              placeholder="Enter API key"
              value={settings.sttApiKey}
              onChange={(e) => setSettings({ sttApiKey: e.target.value })}
            />
          </SettingsGroup>
        )}

        <SettingsGroup label="Language">
          <Select
            value={settings.sttLanguage}
            options={[
              { value: 'en-US', label: 'English (US)' },
              { value: 'en-GB', label: 'English (UK)' },
              { value: 'de-DE', label: 'German' },
              { value: 'fr-FR', label: 'French' },
              { value: 'es-ES', label: 'Spanish' },
              { value: 'it-IT', label: 'Italian' },
              { value: 'pt-BR', label: 'Portuguese (BR)' },
              { value: 'ja-JP', label: 'Japanese' },
              { value: 'zh-CN', label: 'Chinese (Simplified)' },
            ]}
            onValueChange={(v) => setSettings({ sttLanguage: v })}
          />
        </SettingsGroup>

        {/* ── Agent Defaults ────────────────────────────────────── */}
        <SectionHeader title="Agent Defaults" />

        <SettingsGroup label="Runtime Mode">
          <Select
            value={settings.defaultRuntimeMode}
            options={[
              { value: 'auto-accept-edits', label: 'Auto-accept Edits' },
              { value: 'approval-required', label: 'Approval Required' },
              { value: 'full-access', label: 'Full Access' },
            ]}
            onValueChange={(v) => setSettings({ defaultRuntimeMode: v as RuntimeMode })}
          />
        </SettingsGroup>

        <SettingsGroup label="Default Model">
          <Select
            value={`${settings.defaultModel.provider}:${settings.defaultModel.model}`}
            options={[
              { value: 'claudeAgent:claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
              { value: 'claudeAgent:claude-opus-4-6', label: 'Claude Opus 4.6' },
              { value: 'claudeAgent:claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
              { value: 'codex:gpt-5.4', label: 'Codex GPT-5.4' },
            ]}
            onValueChange={(v) => {
              const [provider, model] = v.split(':');
              if (provider && model) {
                setSettings({
                  defaultModel: {
                    provider: provider as 'claudeAgent' | 'codex',
                    model,
                  },
                });
              }
            }}
          />
        </SettingsGroup>

        <SettingsGroup label="Default Workspace Root">
          <Input
            type="text"
            placeholder="/home/user"
            value={settings.defaultWorkspaceRoot}
            onChange={(e) => setSettings({ defaultWorkspaceRoot: e.target.value })}
          />
        </SettingsGroup>
      </div>
    </div>
  );
}
