# rwuChat

Ideal interface.

## Quick start

1. **Configure your AI** — do ONE of:
   - Copy `ai.key.example` to `ai.key` and fill in your URL + API key
   - OR open the app → Settings → "Connect your own AI" and enter them there

2. **Open `index.html`** in your browser (double-click, or serve via any static host)

## ai.key format

```
See in the file bro.


## Settings → "Connect your own AI"

## Local vs Cloud mode available

When the host is unreachable (likely down), the failed message exchange is cleared automatically.

## Features

- Markdown rendering with callouts, tables, code blocks
- HTML enviroment (Run button on .html code blocks)
- Python enviroment via Pyodide (install from Settings → Py Environment)
- MCP (Model Context Protocol) support via `/mcp` command
- 70+ themes, 4 topbar layouts, adjustable font/size

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
    ├── state.js        # globals + config loading
    ├── themes.js       # apply(), theme list
    ├── markdown.js     # markdown→HTML rendering
    ├── chat.js         # API streaming, respond(), config helpers
    ├── mcp.js          # MCP server connection + tool calling
    ├── pyodide.js      # Python-in-browser (Pyodide)
    ├── input.js        # composer, /mcp command, plus menu
    ├── runner.js       # HTML/Python runner modal
    ├── tabs.js         # chat tabs, context menu, saved chats
    ├── search.js       # Ctrl+K search palette
    ├── settings.js     # settings dialog handlers
    └── init.js         # startup
```
