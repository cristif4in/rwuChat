# rwuChat

The Ideal ai chat interface.

## Quick start

1. **Configure your AI** — do ONE of:
   - Copy `ai.key.example` to `ai.key` and fill in your URL + API key
   - OR open the app → Settings → "Connect your own AI" and enter them there

2. **Open `index.html`** in your browser (double-click, or serve via any static host)

## ai.key format

```
See in the file bro.
```

## Settings → "Connect your own AI"

## Local vs Cloud mode available

When the host is unreachable (likely down), the failed message exchange is cleared automatically.

## Features

- Markdown rendering with callouts, tables, code blocks
- HTML enviroment (Run button on .html code blocks)
- Python enviroment via Pyodide (install from Settings → Py Environment)
- MCP (Model Context Protocol) support via `/mcp` command
- 70+ themes, 4 topbar layouts, adjustable font/size
- Chats & settings persist in IndexedDB (no localStorage quota ceiling)
- Service worker: hashed assets precached, offline-capable, deploys go live immediately
- Editing protocol: the AI re-emits small files whole (fenced block with filename) and reserves ```diff for files ~200+ lines
- Provider auto-detect: key-only configs are routed by key prefix (`sk-ant-` → Anthropic, `sk-or-` → OpenRouter, `sk-…` → OpenAI, `AIza…`/`AQ…` → Gemini), cycling through the others as fallback; a server URL always uses your own backend
- Thinking/reasoning panel: streamed model reasoning (Gemini thought parts, Anthropic thinking, OpenAI/OpenRouter reasoning tokens) shows live and collapses to "Thought for Xs"

## File structure

```
rwuChat/
├── index.html          # markup + <link>/<script> tags
├── ai.key.example      # template — copy to ai.key
├── .gitignore
├── css/
│   ├── base.css        # :root vars, reset, typography
│   ├── themes.css      # body background
│   ├── layout.css      # topbar, tabs, composer, messages
│   ├── components.css   # callouts, tables, code blocks, runner
│   └── settings.css    # dialogs, pickers, py-status
└── js/
    ├── idb.js         # IndexedDB key-value helpers (idbGet/idbSet)
    ├── state.js        # globals + theme list + settings persistence (loadState/save)
    ├── themes.js       # $ helpers, app shell state, theme application
    ├── markdown.js     # markdown→HTML rendering + incremental mdStream()
    ├── chat.js         # API streaming, respond(), editing protocol, config helpers
    ├── mcp.js          # MCP server connection + tool calling
    ├── pyodide.js      # Python-in-browser (Pyodide)
    ├── input.js        # composer, /mcp command, plus menu
    ├── runner.js       # HTML/Python runner modal
    ├── tabs.js         # chat tabs, context menu, saved chats
    ├── search.js       # Ctrl+K search palette
    ├── settings.js     # settings dialog handlers
    ├── sw.js           # service worker template (build.js injects precache list)
    └── init.js         # startup + SW registration
```
