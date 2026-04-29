import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell, NavHeader, Card, Button, Input, Select, SettingsGroup, ListItem, SectionHeader, Divider, Toast } from 'even-toolkit/web';
import { useAppStore } from '../store';
import type { STTProvider } from '../stt/use-voice-input';
import type { RuntimeMode } from '../t3/types';

const STT_PROVIDERS = [
  { value: 'local', label: 'Local (Web Speech API)' },
  { value: 'deepgram', label: 'Deepgram (Cloud)' },
  { value: 'soniox', label: 'Soniox (Cloud)' },
  { value: 'whisper-api', label: 'Whisper API (Batch)' },
];

const LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'de-DE', label: 'German' },
  { value: 'fr-FR', label: 'French' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'pt-BR', label: 'Portuguese (BR)' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
];

const RUNTIME_MODES = [
  { value: 'auto-accept-edits', label: 'Auto-accept Edits' },
  { value: 'approval-required', label: 'Approval Required' },
  { value: 'full-access', label: 'Full Access' },
];

const MODELS = [
  { value: 'claudeAgent:claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claudeAgent:claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claudeAgent:claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'codex:gpt-5.4', label: 'Codex GPT-5.4' },
];

export function SettingsPage() {
  const { settings, setSettings, connect, disconnect, connected } = useAppStore();
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

  return (
    <AppShell
      header={
        <NavHeader
          title="Settings"
          left={<Button variant="ghost" size="sm" onClick={() => navigate('/')}>&larr; Back</Button>}
        />
      }
    >
      <main className="px-3 pt-4 pb-8 space-y-6">
        {/* ── T3Code Server ─────────────────────────────────── */}
        <SettingsGroup label="T3Code Server">
          {!settings.sessionToken ? (
            <>
              {/* Server URL */}
              <div className="px-4 py-3 space-y-1.5">
                <span className="text-[13px] tracking-[-0.13px] text-text-dim">Server URL</span>
                <Input
                  type="url"
                  placeholder="https://your-machine.tailnet.ts.net"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                />
              </div>

              {/* Mixed-content warning */}
              {serverUrl.startsWith('http://') && location.protocol === 'https:' && (
                <div className="px-4">
                  <Toast variant="warning" message="HTTPS required. Use the start script above." />
                </div>
              )}

              {/* Session Token */}
              <div className="px-4 py-3 space-y-1.5">
                <span className="text-[13px] tracking-[-0.13px] text-text-dim">Session Token</span>
                <Input
                  type="text"
                  placeholder="Paste the token from start script output"
                  value={sessionToken}
                  onChange={(e) => setSessionToken(e.target.value)}
                />
              </div>

              <div className="px-4 pb-3">
                <Button
                  variant="highlight"
                  className="w-full"
                  onClick={handleConnect}
                  disabled={!serverUrl || !sessionToken.trim()}
                >
                  Connect
                </Button>
              </div>

              {status && (
                <p className="text-[11px] tracking-[-0.11px] text-text-dim text-center pb-2">
                  {status}
                </p>
              )}
            </>
          ) : (
            <ListItem
              title="Connected"
              subtitle={settings.serverUrl}
              trailing={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { disconnect(); setSettings({ sessionToken: '' }); }}
                >
                  Disconnect
                </Button>
              }
            />
          )}
        </SettingsGroup>

        {/* ── Speech Recognition ─────────────────────────────── */}
        <SettingsGroup label="Speech Recognition">
          <ListItem
            title="Provider"
            trailing={
              <Select
                options={STT_PROVIDERS}
                value={settings.sttProvider}
                onValueChange={(v) => setSettings({ sttProvider: v as STTProvider })}
              />
            }
          />
          {settings.sttProvider !== 'local' && (
            <div className="px-4 py-3 space-y-1.5">
              <span className="text-[13px] tracking-[-0.13px] text-text-dim">API Key</span>
              <Input
                type="password"
                placeholder="Enter API key"
                value={settings.sttApiKey}
                onChange={(e) => setSettings({ sttApiKey: e.target.value })}
              />
            </div>
          )}
          <ListItem
            title="Language"
            trailing={
              <Select
                options={LANGUAGES}
                value={settings.sttLanguage}
                onValueChange={(v) => setSettings({ sttLanguage: v })}
              />
            }
          />
        </SettingsGroup>

        {/* ── Agent Defaults ─────────────────────────────────── */}
        <SettingsGroup label="Agent Defaults">
          <ListItem
            title="Runtime Mode"
            trailing={
              <Select
                options={RUNTIME_MODES}
                value={settings.defaultRuntimeMode}
                onValueChange={(v) => setSettings({ defaultRuntimeMode: v as RuntimeMode })}
              />
            }
          />
          <ListItem
            title="Default Model"
            trailing={
              <Select
                options={MODELS}
                value={`${settings.defaultModel.provider}:${settings.defaultModel.model}`}
                onValueChange={(v) => {
                  const [provider, model] = v.split(':');
                  if (provider && model) {
                    setSettings({
                      defaultModel: { provider: provider as 'claudeAgent' | 'codex', model },
                    });
                  }
                }}
              />
            }
          />
          <div className="px-4 py-3 space-y-1.5">
            <span className="text-[13px] tracking-[-0.13px] text-text-dim">Default Workspace Root</span>
            <Input
              type="text"
              placeholder="/home/user"
              value={settings.defaultWorkspaceRoot}
              onChange={(e) => setSettings({ defaultWorkspaceRoot: e.target.value })}
            />
          </div>
        </SettingsGroup>
      </main>
    </AppShell>
  );
}
