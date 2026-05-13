# EasyCC

AI workflow desktop framework powered by Claude Code CLI. Fork this repo and build your own AI-powered desktop app.

## Quick Start

```bash
# Fork or clone this repo
git clone https://github.com/YOUR_USER/easycc.git
cd easycc

# Install dependencies
npm install

# Start dev mode
npm run dev
```

## Architecture

```
Renderer (React UI)
  ↓ electronAPI (contextBridge)
Preload (IPC whitelist)
  ↓ ipcRenderer.invoke
Main (Electron lifecycle + IPC handlers)
  ↓ calls core modules
Core (pure Node.js, no Electron dependency)
  ↓ spawn
Claude Code CLI (stream-json I/O)
```

Key principle: Core is a pure Node.js package with zero Electron dependency, making it testable and reusable independently.

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

3. The flow appears automatically in the UI sidebar.

## Project Structure

```
packages/
  core/        — Pure Node.js business logic
  main/        — Electron main process
  preload/     — Context bridge (IPC whitelist)
  renderer/    — React UI (Vite + Tailwind)
shared/        — Cross-package TypeScript types
flows/         — Flow plugins (directory-based)
```

## Configuration

- **Profiles**: Managed via UI, stored in `userData/profiles.json` with encrypted API keys
- **Flows**: Auto-discovered from `flows/` directory
- **Memory**: `userData/main-session/warmup.md` for cross-session context

## Build & Package

```bash
# Build all packages
npm run build

# Package for current platform
npm run pack

# Create distributable installer
npm run dist
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 + Tailwind CSS |
| State | Zustand |
| Desktop | Electron |
| Build | Vite (renderer) + tsc (main/core/preload) |
| Package | electron-builder |
| Test | Vitest |
| AI Engine | Claude Code CLI |

## License

MIT
