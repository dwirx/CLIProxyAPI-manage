import { Copy, Filter, TerminalSquare } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { CopyToast } from './CopyToast';
import { useCopyFeedback } from '../lib/useCopyFeedback';

type Snippet = {
  label: string;
  code: string;
};

type Integration = {
  title: string;
  description: string;
  notes?: string[];
  snippets?: Snippet[];
  fields?: Array<{ label: string; value: string }>;
};

type ClaudeCodeVersion = 'v2' | 'v1';

type ShellMode = 'bash' | 'powershell';

type ClaudeCodeMapping = {
  id: string;
  label: string;
  v2: { opus: string; sonnet: string; haiku: string };
  v1: { default: string; fast: string };
};

type ModelOverrides = Record<
  string,
  {
    v2?: Partial<ClaudeCodeMapping['v2']>;
    v1?: Partial<ClaudeCodeMapping['v1']>;
  }
>;

type StoredPreferences = {
  providerId: string;
  version: ClaudeCodeVersion;
  shell: ShellMode;
  token: string;
  overrides?: ModelOverrides;
};

const openaiBaseUrl = 'http://127.0.0.1:8317/v1';
const anthropicBaseUrl = 'http://127.0.0.1:8317';
const apiKey = 'sk-dummy';
const modelSuggestionsId = 'cli-model-suggestions';

const storageKey = 'cliProxy.claudePreferences';
const storageEnabledKey = 'cliProxy.claudePreferencesEnabled';

const getInitialPreferences = () => {
  if (typeof window === 'undefined') {
    return { savePrefs: true, prefs: null as StoredPreferences | null };
  }

  const storedEnabled = window.localStorage.getItem(storageEnabledKey);
  const savePrefs = storedEnabled ? storedEnabled === 'true' : true;
  if (!savePrefs) {
    return { savePrefs, prefs: null as StoredPreferences | null };
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return { savePrefs, prefs: null as StoredPreferences | null };
  }

  try {
    return { savePrefs, prefs: JSON.parse(raw) as StoredPreferences };
  } catch (err) {
    return { savePrefs, prefs: null as StoredPreferences | null };
  }
};

const claudeCodeMappings: ClaudeCodeMapping[] = [
  {
    id: 'gemini',
    label: 'Gemini',
    v2: {
      opus: 'gemini-2.5-pro',
      sonnet: 'gemini-2.5-flash',
      haiku: 'gemini-2.5-flash-lite'
    },
    v1: {
      default: 'gemini-2.5-pro',
      fast: 'gemini-2.5-flash'
    }
  },
  {
    id: 'gpt-5',
    label: 'OpenAI GPT-5',
    v2: {
      opus: 'gpt-5(high)',
      sonnet: 'gpt-5(medium)',
      haiku: 'gpt-5(minimal)'
    },
    v1: {
      default: 'gpt-5',
      fast: 'gpt-5(minimal)'
    }
  },
  {
    id: 'gpt-5-codex',
    label: 'OpenAI GPT-5 Codex',
    v2: {
      opus: 'gpt-5-codex(high)',
      sonnet: 'gpt-5-codex(medium)',
      haiku: 'gpt-5-codex(low)'
    },
    v1: {
      default: 'gpt-5-codex',
      fast: 'gpt-5-codex(low)'
    }
  },
  {
    id: 'claude',
    label: 'Claude',
    v2: {
      opus: 'claude-opus-4-1-20250805',
      sonnet: 'claude-sonnet-4-5-20250929',
      haiku: 'claude-3-5-haiku-20241022'
    },
    v1: {
      default: 'claude-sonnet-4-20250514',
      fast: 'claude-3-5-haiku-20241022'
    }
  },
  {
    id: 'qwen',
    label: 'Qwen',
    v2: {
      opus: 'qwen3-coder-plus',
      sonnet: 'qwen3-coder-plus',
      haiku: 'qwen3-coder-flash'
    },
    v1: {
      default: 'qwen3-coder-plus',
      fast: 'qwen3-coder-flash'
    }
  },
  {
    id: 'iflow',
    label: 'iFlow',
    v2: {
      opus: 'qwen3-max',
      sonnet: 'qwen3-coder-plus',
      haiku: 'qwen3-235b-a22b-instruct'
    },
    v1: {
      default: 'qwen3-max',
      fast: 'qwen3-235b-a22b-instruct'
    }
  }
];

const formatEnvLine = (shell: ShellMode, key: string, value: string) => {
  if (shell === 'bash') {
    return `export ${key}="${value}"`;
  }
  return `$env:${key}="${value}"`;
};

const resolveMappingValue = (override: string | undefined, fallback: string) => {
  const trimmed = override?.trim();
  return trimmed ? trimmed : fallback;
};

const buildClaudeSnippet = (
  shell: ShellMode,
  version: ClaudeCodeVersion,
  mapping: ClaudeCodeMapping['v2'] | ClaudeCodeMapping['v1'],
  token: string
) => {
  const lines = [
    formatEnvLine(shell, 'ANTHROPIC_BASE_URL', anthropicBaseUrl),
    formatEnvLine(shell, 'ANTHROPIC_AUTH_TOKEN', token),
    ''
  ];

  if (version === 'v2') {
    const v2 = mapping as ClaudeCodeMapping['v2'];
    lines.push('# version 2.x.x');
    lines.push(formatEnvLine(shell, 'ANTHROPIC_DEFAULT_OPUS_MODEL', v2.opus));
    lines.push(formatEnvLine(shell, 'ANTHROPIC_DEFAULT_SONNET_MODEL', v2.sonnet));
    lines.push(formatEnvLine(shell, 'ANTHROPIC_DEFAULT_HAIKU_MODEL', v2.haiku));
  } else {
    const v1 = mapping as ClaudeCodeMapping['v1'];
    lines.push('# version 1.x.x');
    lines.push(formatEnvLine(shell, 'ANTHROPIC_MODEL', v1.default));
    lines.push(formatEnvLine(shell, 'ANTHROPIC_SMALL_FAST_MODEL', v1.fast));
  }

  return lines.join('\n');
};

const integrations: Integration[] = [
  {
    title: 'Factory Droid',
    description: 'Installer automatically updates ~/.factory/config.json for you.',
    snippets: [
      { label: 'Linux / macOS (Bash)', code: `start-cliproxyapi -Background\n\ndroid` },
      { label: 'Windows (PowerShell)', code: `start-cliproxyapi -Background\n\ndroid` }
    ],
    notes: ['Start the proxy first, then launch Droid and select a model.']
  },
  {
    title: 'OpenCode',
    description: 'Edit ~/.opencode/config.json and set the base URL.',
    snippets: [
      {
        label: 'config.json',
        code: `{
  "provider": "openai",
  "model": "gemini-2.5-pro",
  "providers": {
    "openai": {
      "apiKey": "${apiKey}",
      "baseUrl": "${openaiBaseUrl}"
    }
  }
}`
      }
    ],
    notes: [
      'Windows path: C:\\Users\\<you>\\.opencode\\config.json',
      'Restart OpenCode after saving.'
    ]
  },
  {
    title: 'Cursor',
    description: 'Use Settings -> Models -> OpenAI API and enter the proxy.',
    fields: [
      { label: 'API Key', value: apiKey },
      { label: 'Base URL', value: openaiBaseUrl },
      { label: 'Model', value: 'gemini-2.5-pro (or any available model)' }
    ]
  },
  {
    title: 'Continue (VS Code Extension)',
    description: 'Update ~/.continue/config.json to add CLIProxy models.',
    snippets: [
      {
        label: 'config.json',
        code: `{
  "models": [
    {
      "title": "CLIProxy - Gemini",
      "provider": "openai",
      "model": "gemini-2.5-pro",
      "apiKey": "${apiKey}",
      "apiBase": "${openaiBaseUrl}"
    },
    {
      "title": "CLIProxy - Claude",
      "provider": "openai",
      "model": "claude-opus-4.5",
      "apiKey": "${apiKey}",
      "apiBase": "${openaiBaseUrl}"
    }
  ]
}`
      }
    ],
    notes: ['Windows path: C:\\Users\\<you>\\.continue\\config.json']
  },
  {
    title: 'Generic OpenAI Client (Python)',
    description: 'Point any OpenAI SDK to the local proxy.',
    snippets: [
      {
        label: 'Python',
        code: `from openai import OpenAI

client = OpenAI(
    base_url="${openaiBaseUrl}",
    api_key="${apiKey}"
)

response = client.chat.completions.create(
    model="gemini-2.5-pro",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`
      }
    ]
  },
  {
    title: 'Generic OpenAI Client (curl)',
    description: 'Simple curl request to the chat completions endpoint.',
    snippets: [
      {
        label: 'curl',
        code: `curl ${openaiBaseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "gemini-2.5-pro",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`
      }
    ]
  }
];

export function CliIntegrations() {
  const addLog = useAppStore((state) => state.addLog);
  const models = useAppStore((state) => state.models);
  const copyFeedback = useCopyFeedback();
  const initialPreferences = useMemo(() => getInitialPreferences(), []);

  const [savePrefs, setSavePrefs] = useState(initialPreferences.savePrefs);
  const [claudeProviderId, setClaudeProviderId] = useState(
    initialPreferences.prefs?.providerId ?? claudeCodeMappings[0].id
  );
  const [claudeVersion, setClaudeVersion] = useState<ClaudeCodeVersion>(
    initialPreferences.prefs?.version ?? 'v2'
  );
  const [shellMode, setShellMode] = useState<ShellMode>(
    initialPreferences.prefs?.shell ?? 'bash'
  );
  const [authToken, setAuthToken] = useState(initialPreferences.prefs?.token ?? apiKey);
  const [modelOverrides, setModelOverrides] = useState<ModelOverrides>(
    initialPreferences.prefs?.overrides ?? {}
  );
  const [showToken, setShowToken] = useState(false);
  const [modelFilter, setModelFilter] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageEnabledKey, String(savePrefs));
    if (!savePrefs) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    const payload: StoredPreferences = {
      providerId: claudeProviderId,
      version: claudeVersion,
      shell: shellMode,
      token: authToken,
      overrides: modelOverrides
    };

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [savePrefs, claudeProviderId, claudeVersion, shellMode, authToken, modelOverrides]);

  const selectedProvider = useMemo(
    () => claudeCodeMappings.find((provider) => provider.id === claudeProviderId),
    [claudeProviderId]
  );

  const activeProvider = selectedProvider ?? claudeCodeMappings[0];
  const providerOverrides = modelOverrides[activeProvider.id];

  const resolvedV2 = useMemo(
    () => ({
      opus: resolveMappingValue(providerOverrides?.v2?.opus, activeProvider.v2.opus),
      sonnet: resolveMappingValue(providerOverrides?.v2?.sonnet, activeProvider.v2.sonnet),
      haiku: resolveMappingValue(providerOverrides?.v2?.haiku, activeProvider.v2.haiku)
    }),
    [activeProvider, providerOverrides]
  );

  const resolvedV1 = useMemo(
    () => ({
      default: resolveMappingValue(providerOverrides?.v1?.default, activeProvider.v1.default),
      fast: resolveMappingValue(providerOverrides?.v1?.fast, activeProvider.v1.fast)
    }),
    [activeProvider, providerOverrides]
  );

  const modelFields =
    claudeVersion === 'v2'
      ? [
          { key: 'opus', label: 'Opus' },
          { key: 'sonnet', label: 'Sonnet' },
          { key: 'haiku', label: 'Haiku' }
        ]
      : [
          { key: 'default', label: 'Default' },
          { key: 'fast', label: 'Small/Fast' }
        ];

  const modelTiers = modelFields.map((field) => {
    if (claudeVersion === 'v2') {
      const key = field.key as keyof ClaudeCodeMapping['v2'];
      const isCustom = Boolean(providerOverrides?.v2?.[key]);
      return { label: field.label, value: resolvedV2[key], key, isCustom };
    }
    const key = field.key as keyof ClaudeCodeMapping['v1'];
    const isCustom = Boolean(providerOverrides?.v1?.[key]);
    return { label: field.label, value: resolvedV1[key], key, isCustom };
  });

  const sortedModels = useMemo(() => {
    return [...models].sort((a, b) => a.localeCompare(b));
  }, [models]);

  const filteredModels = useMemo(() => {
    const term = modelFilter.trim().toLowerCase();
    if (!term) return sortedModels;
    return sortedModels.filter((model) => model.toLowerCase().includes(term));
  }, [sortedModels, modelFilter]);

  const claudeSnippet = useMemo(() => {
    const mapping = claudeVersion === 'v2' ? resolvedV2 : resolvedV1;
    return buildClaudeSnippet(shellMode, claudeVersion, mapping, authToken);
  }, [shellMode, claudeVersion, resolvedV2, resolvedV1, authToken]);

  const toggleClass = (active: boolean) => `btn btn-xs ${active ? 'btn-primary' : 'btn-outline'}`;

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      copyFeedback.trigger('Copied');
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `${label} copied to clipboard`,
        type: 'success'
      });
    } catch (err) {
      copyFeedback.trigger('Copy failed');
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `Failed to copy ${label}`,
        type: 'warning'
      });
    }
  };

  const updateModelOverride = (field: string, value: string) => {
    const trimmed = value.trim();
    const defaultValue =
      claudeVersion === 'v2'
        ? activeProvider.v2[field as keyof ClaudeCodeMapping['v2']]
        : activeProvider.v1[field as keyof ClaudeCodeMapping['v1']];

    setModelOverrides((prev) => {
      const next = { ...prev };
      const providerEntry = { ...(next[activeProvider.id] ?? {}) };

      if (claudeVersion === 'v2') {
        const v2 = { ...(providerEntry.v2 ?? {}) };
        const key = field as keyof ClaudeCodeMapping['v2'];
        if (!trimmed || trimmed === defaultValue) {
          delete v2[key];
        } else {
          v2[key] = trimmed;
        }
        if (Object.keys(v2).length > 0) {
          providerEntry.v2 = v2;
        } else {
          delete providerEntry.v2;
        }
      } else {
        const v1 = { ...(providerEntry.v1 ?? {}) };
        const key = field as keyof ClaudeCodeMapping['v1'];
        if (!trimmed || trimmed === defaultValue) {
          delete v1[key];
        } else {
          v1[key] = trimmed;
        }
        if (Object.keys(v1).length > 0) {
          providerEntry.v1 = v1;
        } else {
          delete providerEntry.v1;
        }
      }

      if (Object.keys(providerEntry).length > 0) {
        next[activeProvider.id] = providerEntry;
      } else {
        delete next[activeProvider.id];
      }

      return next;
    });
  };


  const resetModelOverrides = () => {
    setModelOverrides((prev) => {
      const next = { ...prev };
      delete next[activeProvider.id];
      return next;
    });
  };

  const resetAll = () => {
    setClaudeProviderId(claudeCodeMappings[0].id);
    setClaudeVersion('v2');
    setShellMode('bash');
    setAuthToken(apiKey);
    setModelOverrides({});
  };

  return (
    <section className="section-card relative grid gap-4">
      <CopyToast message={copyFeedback.message} />
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/20 p-2 text-primary">
          <TerminalSquare size={18} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Integrations</p>
          <h3 className="text-lg font-semibold text-white">Usage with CLI Tools</h3>
        </div>
      </div>
      <div className="grid gap-4">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-base-200/80 via-base-200/70 to-base-300/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Claude Code</p>
              <h4 className="text-base font-semibold text-white">Local proxy + model mapping</h4>
              <p className="text-xs text-slate-400">
                Start CLIProxyAPI, then export env vars that map Claude tiers to your provider.
              </p>
              <p className="text-xs text-slate-500">
                Pick models from the suggestion list to fill the mapping fields quickly.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="badge-soft">
                {savePrefs ? 'Preferences saved' : 'Preferences not saved'}
              </span>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <span>Save preferences</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={savePrefs}
                  onChange={(event) => setSavePrefs(event.target.checked)}
                />
              </label>
              <button
                onClick={resetAll}
                className="btn btn-outline btn-xs"
                title="Reset to defaults"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="grid gap-4 rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Setup</p>
                  <button
                    onClick={() => copyText('Claude Code env', claudeSnippet)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-200 transition hover:text-white"
                  >
                    <Copy size={12} /> Copy env
                  </button>
                </div>
                <label className="grid gap-2 text-xs text-slate-400">
                  Provider
                  <select
                    value={activeProvider.id}
                    onChange={(event) => setClaudeProviderId(event.target.value)}
                    className="select select-bordered select-sm w-full bg-base-300/60 text-slate-200"
                  >
                    {claudeCodeMappings.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Version</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={toggleClass(claudeVersion === 'v2')}
                      onClick={() => setClaudeVersion('v2')}
                    >
                      2.x.x
                    </button>
                    <button
                      type="button"
                      className={toggleClass(claudeVersion === 'v1')}
                      onClick={() => setClaudeVersion('v1')}
                    >
                      1.x.x
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Shell</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={toggleClass(shellMode === 'bash')}
                      onClick={() => setShellMode('bash')}
                    >
                      Bash
                    </button>
                    <button
                      type="button"
                      className={toggleClass(shellMode === 'powershell')}
                      onClick={() => setShellMode('powershell')}
                    >
                      PowerShell
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 text-xs text-slate-300">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                    <span className="text-slate-400">ANTHROPIC_BASE_URL</span>
                    <span className="font-mono text-[11px] text-slate-200">{anthropicBaseUrl}</span>
                  </div>
                  <label className="grid gap-2 text-xs text-slate-400">
                    ANTHROPIC_AUTH_TOKEN
                    <div className="flex flex-wrap gap-2">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={authToken}
                        onChange={(event) => setAuthToken(event.target.value)}
                        className="flex-1 rounded-xl border border-white/10 bg-base-300/60 px-3 py-2 text-xs text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken((prev) => !prev)}
                        className="btn btn-outline btn-xs"
                      >
                        {showToken ? 'Hide' : 'Show'}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText('ANTHROPIC_AUTH_TOKEN', authToken)}
                        className="btn btn-outline btn-xs"
                      >
                        Copy
                      </button>
                    </div>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    {savePrefs
                      ? 'Saved locally in this browser.'
                      : 'Not saved when preferences are off.'}
                  </p>
                </div>
                <div className="grid gap-2 rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Start server</span>
                    <button
                      type="button"
                      onClick={() => copyText('Start server', 'betacliproxyapi start')}
                      className="btn btn-ghost btn-xs"
                    >
                      Copy
                    </button>
                  </div>
                  <code className="rounded-lg bg-black/40 px-2 py-1 font-mono text-[11px] text-slate-200">
                    betacliproxyapi start
                  </code>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Run Claude Code</span>
                    <button
                      type="button"
                      onClick={() => copyText('Claude Code', 'claude')}
                      className="btn btn-ghost btn-xs"
                    >
                      Copy
                    </button>
                  </div>
                  <code className="rounded-lg bg-black/40 px-2 py-1 font-mono text-[11px] text-slate-200">
                    claude
                  </code>
                </div>
              </div>
              <div className="grid gap-4 rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Model mapping</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge-soft">
                      {claudeVersion === 'v2' ? 'Opus/Sonnet/Haiku' : 'Default/Fast'}
                    </span>
                    <button
                      type="button"
                      onClick={resetModelOverrides}
                      className="btn btn-outline btn-xs"
                    >
                      Reset models
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Edit model names or choose from suggestions to override defaults.
                </p>
                <div className="grid gap-2 text-xs text-slate-300">
                  <label className="grid gap-2 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Filter size={14} /> Filter available models
                    </div>
                    <input
                      value={modelFilter}
                      onChange={(event) => setModelFilter(event.target.value)}
                      placeholder="Type to filter model suggestions..."
                      className="w-full rounded-lg border border-white/10 bg-base-300/60 px-3 py-2 text-xs text-slate-100"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="badge-soft">{sortedModels.length} total</span>
                    <span>{filteredModels.length} shown</span>
                    {sortedModels.length === 0 && (
                      <span>Start the server to load models.</span>
                    )}
                  </div>
                  {modelTiers.map((tier) => {
                    const hasCurrent = Boolean(tier.value);
                    const currentInFiltered = filteredModels.includes(tier.value);
                    const selectOptions =
                      hasCurrent && !currentInFiltered
                        ? [tier.value, ...filteredModels]
                        : filteredModels;
                    const selectValue =
                      hasCurrent && selectOptions.includes(tier.value) ? tier.value : '';
                    return (
                      <div
                        key={tier.label}
                        className="grid gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400">{tier.label}</span>
                          <span className="badge-soft text-[10px]">
                            {tier.isCustom ? 'Custom' : 'Default'}
                          </span>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-[1.4fr_1fr]">
                          <input
                            value={tier.value}
                            onChange={(event) => updateModelOverride(tier.key, event.target.value)}
                            list={sortedModels.length > 0 ? modelSuggestionsId : undefined}
                            className="rounded-lg border border-white/10 bg-base-300/60 px-2 py-2 font-mono text-[11px] text-slate-100"
                          />
                          <select
                            value={selectValue}
                            onChange={(event) => updateModelOverride(tier.key, event.target.value)}
                            disabled={sortedModels.length === 0}
                            className="select select-bordered select-sm w-full bg-base-300/60 text-slate-200"
                          >
                            <option value="">Pick from available models</option>
                            {selectOptions.map((model) => (
                              <option key={`${tier.label}-${model}`} value={model}>
                                {model === tier.value && !currentInFiltered ? `${model} (current)` : model}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {sortedModels.length > 0 && (
                  <datalist id={modelSuggestionsId}>
                    {sortedModels.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Env snippet</p>
                <button
                  onClick={() => copyText('Claude Code env snippet', claudeSnippet)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-200 transition hover:text-white"
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
              <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-black/50 p-3 text-xs text-slate-200">
                {claudeSnippet}
              </pre>
            </div>
            <div className="grid gap-1 text-xs text-slate-400">
              <p>- Run `betacliproxyapi start` before launching Claude Code.</p>
              <p>- Use a key from `api-keys` in `~/.cli-proxy-api/config.yaml`.</p>
              <p>- Add the exports to your shell profile for a persistent setup.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3">
          {integrations.map((item) => (
            <details
              key={item.title}
              className="group rounded-2xl border border-white/10 bg-base-200/60 p-4"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-white">
                <span>{item.title}</span>
                <span className="text-xs text-slate-400 group-open:rotate-180">v</span>
              </summary>
              <div className="mt-3 grid gap-3 text-sm text-slate-300">
                <p>{item.description}</p>
                {item.fields && (
                  <div className="grid gap-2 text-xs text-slate-300">
                    {item.fields.map((field) => (
                      <div
                        key={field.label}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                      >
                        <span className="text-slate-400">{field.label}</span>
                        <span className="font-mono text-[11px] text-slate-200">{field.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {item.snippets?.map((snippet) => (
                  <div key={snippet.label} className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        {snippet.label}
                      </p>
                      <button
                        onClick={() => copyText(`${item.title} ${snippet.label}`, snippet.code)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-200 transition hover:text-white"
                      >
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-black/50 p-3 text-xs text-slate-200">
                      {snippet.code}
                    </pre>
                  </div>
                ))}
                {item.notes && (
                  <div className="grid gap-1 text-xs text-slate-400">
                    {item.notes.map((note) => (
                      <p key={note}>- {note}</p>
                    ))}
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
