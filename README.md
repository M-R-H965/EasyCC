# EasyCC

AI workflow desktop framework powered by Claude Code CLI. Fork this repo and build your own AI-powered desktop app.

## Prerequisites

- Node.js 18+
- Claude Code CLI: `npm i -g @anthropic-ai/claude-code`
- An Anthropic API key

## Quick Start

```bash
git clone https://github.com/YOUR_USER/easycc.git
cd easycc
npm install
npm run build
npm start
```

## Development Mode

`npm run dev` starts the Vite renderer dev server and launches Electron in one command:

```bash
npm run dev
```

## UI Overview

The sidebar has five panels:

| Panel | Purpose |
|---|---|
| **Chat** | General-purpose conversation — no flow required |
| **Flows** | Three-column layout: flow list + conversation tabs + chat |
| **Profiles** | Manage API keys, models, and API URLs |
| **Claude Code** | Check CLI install status, install or update |
| **Memory** | View `warmup.md` — cross-session context fed to the main chat |

### Profiles

Create a profile before chatting: enter a name, API URL (`https://api.anthropic.com`), API key, and model (e.g. `claude-sonnet-4-5`). The first profile is set as default automatically.

### Conversations

- **Chat panel**: opens a general conversation automatically when a profile is selected.
- **Flows panel**: click **Load** on a flow card to open a new conversation scoped to that flow's directory. Each conversation gets its own tab. Multiple conversations can be open simultaneously.
- Tabs show a streaming indicator (●) while Claude is responding. Click × to close a tab.

### Conversation Persistence

Each conversation's message history and Claude session ID are saved automatically:

- Flow conversations → `flows/<FlowName>/conversations.json`
- General conversations → `userData/conversations.json`
- Global index (metadata only) → `userData/all-conversations.json`

On next launch, all conversations are restored. The saved session ID allows Claude to resume context via `--resume`.

### Cross-session Memory

After each completed response, the last Q&A pair is appended to `userData/main-session/warmup.md` under `## Recent`. The Chat panel's Claude session reads this file on startup, giving it awareness of what happened in all flow conversations.

## How to Create a Custom Flow

1. Create a directory under `flows/`:
   ```
   flows/
     MyFlow/
       FLOW.md
       input/
       output/
       content/
   ```

2. Write `FLOW.md` with frontmatter:
   ```yaml
   ---
   name: My Custom Flow
   description: What this flow does
   version: "1.0.0"
   tools: read, write, grep
   group: optional-group
   ---
   # Instructions
   Describe how the AI should work in this flow.
   ```

   The `tools` field maps directly to Claude Code CLI's `--allowed-tools` flag. Only the listed tools will be available in that flow's conversations.

3. Optionally add `flows/MyFlow/settings.json` for per-flow Claude Code configuration (MCP servers, permission overrides, hooks, etc.):
   ```json
   {
     "permissions": {
       "allow": ["Bash(git *)"],
       "deny": ["Bash(rm *)"]
     }
   }
   ```
   This is passed as `--settings` to the CLI. The `--bare` flag is also set for all flow conversations, so user-global Claude config does not bleed in.

4. The flow appears automatically in the Flows panel sidebar.

## Project Structure

```
packages/
  shared/      — Shared TypeScript types (@easycc/shared)
  core/        — Pure Node.js business logic (no Electron dependency)
  main/        — Electron main process + IPC handlers
  preload/     — Context bridge (IPC whitelist)
  renderer/    — React UI (Vite + Tailwind + Zustand)
flows/
  000-Demo/    — Example flow with starter settings.json
```

## Architecture

```
Renderer (React UI)
  ↓ window.electronAPI (contextBridge)
Preload (IPC whitelist)
  ↓ ipcRenderer.invoke
Main (Electron lifecycle + IPC handlers)
  ↓ core modules
Core (pure Node.js)
  ↓ spawn (shell: true on Windows)
Claude Code CLI (--input-format stream-json / --output-format stream-json)
```

## Configuration

| What | Where |
|---|---|
| Profiles (API keys, models) | `userData/profiles.json` — keys encrypted via `safeStorage` |
| Flow state (enabled/disabled) | `userData/flow-state.json` |
| Conversation history | `flows/<Name>/conversations.json` and `userData/conversations.json` |
| Cross-session memory | `userData/main-session/warmup.md` |

## Build & Package

```bash
npm run build       # build all packages
npm test            # run Vitest
npm run pack        # package for current platform (no installer)
npm run dist        # create distributable installer
```

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 + Tailwind CSS |
| State | Zustand |
| Desktop | Electron 35 |
| Build | Vite (renderer) + tsc (main/core/preload) |
| Package | electron-builder |
| Test | Vitest |
| AI Engine | Claude Code CLI (`@anthropic-ai/claude-code`) |

## License

MIT
