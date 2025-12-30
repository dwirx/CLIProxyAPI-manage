import { Copy, TerminalSquare } from 'lucide-react';
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

const baseUrl = 'http://localhost:8317/v1';
const apiKey = 'sk-dummy';

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
    title: 'Claude Code',
    description: 'Point Claude to the local OpenAI-compatible endpoint.',
    snippets: [
      {
        label: 'Linux / macOS (Bash)',
        code: `export ANTHROPIC_BASE_URL="${baseUrl}"\nexport ANTHROPIC_API_KEY="${apiKey}"\nclaude`
      },
      {
        label: 'Windows (PowerShell)',
        code: `$env:ANTHROPIC_BASE_URL="${baseUrl}"\n$env:ANTHROPIC_API_KEY="${apiKey}"\nclaude`
      }
    ],
    notes: ['Add the env vars to your shell profile for a persistent setup.']
  },
  {
    title: 'OpenCode',
    description: 'Edit ~/.opencode/config.json and set the base URL.',
    snippets: [
      {
        label: 'config.json',
        code: `{\n  "provider": "openai",\n  "model": "gemini-2.5-pro",\n  "providers": {\n    "openai": {\n      "apiKey": "${apiKey}",\n      "baseUrl": "${baseUrl}"\n    }\n  }\n}`
      }
    ],
    notes: [
      'Windows path: C:\\\\Users\\\\<you>\\\\.opencode\\\\config.json',
      'Restart OpenCode after saving.'
    ]
  },
  {
    title: 'Cursor',
    description: 'Use Settings -> Models -> OpenAI API and enter the proxy.',
    fields: [
      { label: 'API Key', value: apiKey },
      { label: 'Base URL', value: baseUrl },
      { label: 'Model', value: 'gemini-2.5-pro (or any available model)' }
    ]
  },
  {
    title: 'Continue (VS Code Extension)',
    description: 'Update ~/.continue/config.json to add CLIProxy models.',
    snippets: [
      {
        label: 'config.json',
        code: `{\n  "models": [\n    {\n      "title": "CLIProxy - Gemini",\n      "provider": "openai",\n      "model": "gemini-2.5-pro",\n      "apiKey": "${apiKey}",\n      "apiBase": "${baseUrl}"\n    },\n    {\n      "title": "CLIProxy - Claude",\n      "provider": "openai",\n      "model": "claude-opus-4.5",\n      "apiKey": "${apiKey}",\n      "apiBase": "${baseUrl}"\n    }\n  ]\n}`
      }
    ],
    notes: ['Windows path: C:\\\\Users\\\\<you>\\\\.continue\\\\config.json']
  },
  {
    title: 'Generic OpenAI Client (Python)',
    description: 'Point any OpenAI SDK to the local proxy.',
    snippets: [
      {
        label: 'Python',
        code: `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${baseUrl}",\n    api_key="${apiKey}"\n)\n\nresponse = client.chat.completions.create(\n    model="gemini-2.5-pro",\n    messages=[{"role": "user", "content": "Hello!"}]\n)\nprint(response.choices[0].message.content)`
      }
    ]
  },
  {
    title: 'Generic OpenAI Client (curl)',
    description: 'Simple curl request to the chat completions endpoint.',
    snippets: [
      {
        label: 'curl',
        code: `curl ${baseUrl}/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -d '{\n    "model": "gemini-2.5-pro",\n    "messages": [{"role": "user", "content": "Hello!"}]\n  }'`
      }
    ]
  }
];

export function CliIntegrations() {
  const addLog = useAppStore((state) => state.addLog);
  const copyFeedback = useCopyFeedback();

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
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{snippet.label}</p>
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
    </section>
  );
}
