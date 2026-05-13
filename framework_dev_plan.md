# EasyCC Framework Development Plan

## Context

EasyCC 是一个基于 Electron + React + Claude Code CLI 的 AI 工作流桌面框架。目标是将现有产品提炼为一个可复用的 Template Repo，让开发者 fork 后即可快速搭建自己的 AI 工作流平台。

**核心定位**：AI 工作流平台，Flow 是核心，聊天是交互入口。

**交付形态**：GitHub Template Repo，用户 fork/clone 后直接改业务代码。

**Flow 设计**：目录约定 + FLOW.md，框架只负责发现和挂载，不介入 Flow 内部逻辑。

---

## 项目结构

```
easycc/
├── package.json              # npm workspaces root
├── packages/
│   ├── core/                 # @easycc/core — 纯 Node.js，不依赖 Electron
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── event-bus.ts
│   │       ├── claude-runner.ts
│   │       ├── claude-installer.ts
│   │       ├── profile-manager.ts
│   │       ├── flow-manager.ts
│   │       ├── flow-parser.ts
│   │       ├── main-memory.ts
│   │       └── logger.ts
│   ├── main/                 # @easycc/main — Electron 主进程
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── window.ts
│   │       └── ipc-handlers.ts
│   ├── preload/              # @easycc/preload — contextBridge
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   └── renderer/             # @easycc/renderer — React UI
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── components/
│           │   ├── ChatView.tsx
│           │   ├── InputBar.tsx
│           │   ├── FlowPanel.tsx
│           │   ├── ProfilePanel.tsx
│           │   ├── CCSettings.tsx
│           │   ├── MemoryPanel.tsx
│           │   └── Sidebar.tsx
│           ├── hooks/
│           │   ├── useChat.ts
│           │   ├── useProfile.ts
│           │   ├── useFlows.ts
│           │   ├── useCC.ts
│           │   └── useMemory.ts
│           ├── stores/
│           │   ├── chatStore.ts
│           │   ├── profileStore.ts
│           │   ├── flowStore.ts
│           │   └── appStore.ts
│           └── styles/
│               └── index.css
├── flows/
│   └── 000-Demo/
│       ├── FLOW.md
│       ├── input/.gitkeep
│       ├── output/.gitkeep
│       └── content/.gitkeep
├── shared/
│   └── types.ts
├── electron-builder.yml
├── tsconfig.base.json
├── vitest.config.ts
└── README.md
```

---

## 依赖选型

| 用途 | 选择 | 理由 |
|------|------|------|
| 包管理 | npm workspaces | 零额外依赖，Node 原生支持 |
| UI 框架 | React 18 + TypeScript | 生态最大 |
| Renderer 构建 | Vite | 快，Electron 集成成熟 |
| 主进程/Preload/Core | tsc | 简单直接 |
| 应用打包 | electron-builder | 跨平台标准方案 |
| 测试 | Vitest | 快速，原生 ESM/TS 支持 |
| 样式 | Tailwind CSS | 框架级 UI 最小依赖 |
| 状态管理 | Zustand | 轻量，比 Redux 简单一个数量级 |
| FLOW.md 解析 | gray-matter | YAML + Markdown 标准解析 |
| IPC 方向 | 单向数据流 core → main → renderer | 避免循环依赖 |

---

## Phase 0: 项目脚手架

**目标**：建立可编译运行的空项目骨架。

### 做什么

1. 初始化 `package.json`（workspaces 指向 `packages/*`）
2. 创建 `tsconfig.base.json`，各包 extends
3. 创建各子包的 `package.json` 和 `tsconfig.json`
4. 配置 `electron-builder.yml`（macOS DMG + Windows NSIS + Linux AppImage）
5. 创建 Demo Flow 骨架
6. 添加 `shared/types.ts` 共享类型定义
7. 配置根 scripts：`dev`、`build`、`test`

### 验证

- `npm install` 成功
- `npm run build` 全量编译通过
- `npm run dev` 启动空 Electron 窗口

---

## Phase 1: Core — EventBus + Logger

**目标**：建立 core 包基础设施。

### EventBus

```typescript
interface CoreEvents {
  'chat:stream': { sessionId: string; content: string }
  'chat:done': { sessionId: string; result: unknown }
  'chat:error': { sessionId: string; error: Error }
  'session:init': { sessionId: string }
  'session:exit': { sessionId: string; code: number | null }
  'flow:installed': { flowId: string }
  'flow:removed': { flowId: string }
  'memory:updated': { path: string }
}

class EventBus<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): void
  off<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): void
  once<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): void
  emit<K extends keyof Events>(event: K, payload: Events[K]): void
  onAny(handler: (event: string, payload: unknown) => void): void  // wildcard，用于日志
}
```

要点：纯 TypeScript，不依赖 Node 或 Electron API。

### Logger

```typescript
interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void
  info(msg: string, meta?: Record<string, unknown>): void
  warn(msg: string, meta?: Record<string, unknown>): void
  error(msg: string, meta?: Record<string, unknown>): void
}

function createLogger(module: string, logDir: string): Logger
```

要点：
- 写入用户数据目录的日志文件
- 按大小轮转（默认 5MB）
- 自动过滤敏感字段（apiKey、token、password）
- 子 logger 按 module 区分来源

### 验证

- EventBus 单元测试（emit/on/once/off/wildcard）
- Logger 单元测试（写入、轮转、敏感信息过滤）
- `packages/core` 独立编译通过

---

## Phase 2: Core — Claude Runner

**目标**：实现 Claude Code CLI 子进程管理。

### ClaudeRunner

```typescript
interface RunnerOptions {
  model: string
  systemPrompt?: string
  cwd?: string
  addDirs?: string[]
  bare?: boolean
  sessionId?: string
  env?: Record<string, string>
}

interface ClaudeRunner {
  start(options: RunnerOptions): Promise<string>  // 返回 sessionId
  send(sessionId: string, message: string): void
  stop(sessionId: string): void
  stopAll(): void
  isRunning(sessionId: string): boolean
}
```

CLI 启动参数：
```
claude --output-format stream-json --input-format stream-json --print --verbose
       --model <model>
       [--system-prompt <prompt>] [--bare] [--add-dir <dir>] [--resume <sessionId>]
```

事件解析：
- `system/init` → 记录 sessionId，emit `session:init`
- `assistant` / `stream_event` → emit `chat:stream`
- `result` → emit `chat:done`

稳定性机制：
- init 超时后允许继续写入，避免会话卡死
- 子进程退出后保存 tombstone
- 后续 send 时按 sessionId 尝试 respawn
- Windows 下 stop 结束进程树

### ClaudeInstaller

```typescript
interface ClaudeInstaller {
  getVersion(): Promise<string | null>
  isInstalled(): Promise<boolean>
  install(): Promise<void>
  update(): Promise<void>
}
```

### 验证

- Mock child_process 单元测试（spawn 参数、事件解析）
- 集成测试：真实 CLI 发送消息、接收流式响应
- stop/stopAll 清理子进程
- resume 场景

---

## Phase 3: Core — Profile Manager

**目标**：多 Profile 持久化，API Key 加密存储。

```typescript
interface ProfileManager {
  list(): Promise<Profile[]>
  get(id: string): Promise<Profile | null>
  getDefault(): Promise<Profile | null>
  create(data: Omit<Profile, 'id'>): Promise<Profile>
  update(id: string, patch: Partial<Profile>): Promise<Profile>
  delete(id: string): Promise<void>
  setDefault(id: string): Promise<void>
  testConnection(id: string): Promise<boolean>
}
```

Profile 数据结构：
```typescript
interface Profile {
  id: string
  name: string
  apiUrl: string
  apiKey: string        // 落盘前加密
  model: string
  systemPrompt?: string
  isDefault: boolean
}
```

存储：
- 数据文件：`userData/profiles.json`
- API Key 加密：Electron 环境用 safeStorage，降级到 AES-256-GCM
- 第一个 Profile 自动设为默认
- 删除默认 Profile 后自动选剩余第一个

### 验证

- CRUD 单元测试
- API Key 加密/解密往返
- 默认 Profile 逻辑（首创建、删除自动切换）
- 日志和错误信息不泄露 Key

---

## Phase 4: Core — Flow Manager

**目标**：Flow 插件发现、元数据解析、可见性管理。

### FlowManager

```typescript
interface FlowManager {
  listAvailable(): Promise<FlowMeta[]>
  get(id: string): Promise<FlowMeta | null>
  enable(id: string): void
  disable(id: string): void
  isEnabled(id: string): boolean
  getByGroup(group: string): Promise<FlowMeta[]>
}
```

### FlowMeta

```typescript
interface FlowMeta {
  id: string            // 目录名，如 "000-Demo"
  name: string          // frontmatter.name
  description: string   // frontmatter.description
  version: string       // frontmatter.version（SemVer）
  tools: string[]       // frontmatter.tools
  group?: string        // frontmatter.group（可选，用于可见性过滤）
  dir: string           // 绝对路径
}
```

解析规则：
- 用 gray-matter 解析 YAML frontmatter + Markdown body
- Flow ID = 目录名
- 无 FLOW.md 的目录跳过
- 缺少必填字段（name/description/version）时 warn 并跳过

可见性：
- 无 group 的 Flow 默认可见
- 有 group 的 Flow 需用户解锁后才可见
- 解锁状态存 `userData/flow-unlocks.json`

### Demo Flow

`flows/000-Demo/FLOW.md`：
```yaml
---
name: Demo
description: EasyCC Demo Flow — 展示目录约定
version: "1.0.0"
tools: read, write
---
```

### 验证

- 目录扫描正确
- FLOW.md 解析：正常/缺字段/无 frontmatter 容错
- enable/disable 状态持久化
- group 过滤正确

---

## Phase 5: Core — Main Memory

**目标**：跨会话上下文记忆。

```typescript
interface MainMemory {
  read(): Promise<string>
  append(section: string, content: string): Promise<void>
  compress(): Promise<void>
}
```

warmup.md 结构：
```markdown
# Main Memory

## Recent
- ...

## History
- ...

## Topics
### ...
```

要点：
- 固定路径，不存在时自动创建模板
- append 追加到指定 section
- compress：Recent 超 10 条时归档到 History
- 纯文本操作

### 验证

- read/append 单元测试
- compress 阈值触发和归档
- 空文件自动创建

---

## Phase 6: Electron Shell

**目标**：Core 接入 Electron，IPC 通信。

### Main 进程

- `index.ts`：应用入口，创建窗口、注册 IPC、管理生命周期
- `window.ts`：BrowserWindow 创建管理
- `ipc-handlers.ts`：IPC handler，调用 core 模块

IPC 分组：

| Channel | 调用 |
|---------|------|
| `profile:list/get/getDefault/create/update/delete/setDefault/testConnection` | ProfileManager |
| `conversation:create/createWithFlow/send/stop` | ClaudeRunner |
| `flow:listAvailable/get/enable/disable/getByGroup` | FlowManager |
| `cc:getVersion/isInstalled/install/update` | ClaudeInstaller |
| `memory:read/append/compress` | MainMemory |
| `app:getVersion/getDiagnostics` | 应用信息 |

### Preload

`contextBridge.exposeInMainWorld('electronAPI', { ... })`，按上述分组暴露 API。

额外暴露事件监听：
```typescript
events: {
  onChatStream(callback): void
  onChatDone(callback): void
  onChatError(callback): void
  onSessionInit(callback): void
  onSessionExit(callback): void
  // ...
}
```

### 事件转发

```
Core EventBus → Main 监听 → webContents.send → Renderer
```

### 验证

- Electron 窗口启动
- IPC 双向通信
- 退出时子进程清理

---

## Phase 7: Renderer UI

**目标**：工作流平台核心 UI。

### 布局

```
┌─────────────────────────────────────────────┐
│  Title Bar                                   │
├──────────┬──────────────────────────────────┤
│          │                                    │
│  Sidebar │         Chat Area                  │
│          │                                    │
│  Flows   │  ┌──────────────────────────────┐  │
│  Profile │  │  Message List (streaming)     │  │
│  CC      │  │                               │  │
│  Memory  │  └──────────────────────────────┘  │
│          │  ┌──────────────────────────────┐  │
│          │  │  Input Bar                    │  │
│          │  └──────────────────────────────┘  │
└──────────┴──────────────────────────────────┘
```

### 核心组件

| 组件 | 职责 |
|------|------|
| `ChatView` | 流式消息展示（text/thinking/tool_use） |
| `InputBar` | 消息输入、文件附加、发送/停止 |
| `FlowPanel` | Flow 列表、启禁用、启动 Flow 会话 |
| `ProfilePanel` | Profile CRUD、默认选择、连接测试 |
| `CCSettings` | Claude Code 版本、安装/升级 |
| `MemoryPanel` | 查看/编辑 warmup.md |
| `Sidebar` | 导航，面板切换 |

### 状态管理（Zustand）

| Store | 状态 |
|-------|------|
| `chatStore` | 消息列表、流式状态、当前会话 |
| `profileStore` | Profile 列表、当前选中 |
| `flowStore` | Flow 列表、启用状态、当前 Flow |
| `appStore` | CC 版本、更新状态、面板切换 |

### 验证

- 各面板渲染正确
- 流式消息实时展示
- Profile CRUD 端到端
- Flow 列表、启禁用、启动会话
- 窗口 resize 自适应

---

## Phase 8: 会话模型整合

**目标**：三种会话模式的完整生命周期。

### 普通会话

选择 Profile → 启动 ClaudeRunner → 自由聊天。无工作目录约束。

### Flow 会话

选择 Flow → cwd 设为 Flow 目录 → `--add-dir <flowDir> --bare`。Claude 在 Flow 目录上下文中工作，FLOW.md 作为说明入口。

### Main Session

应用级常驻会话。固定 conversation id，独立工作目录。启动时读取 warmup.md 并问候用户。用户可在此发起全局指令。

### 验证

- 三种会话各自端到端跑通
- 会话切换互不干扰
- 应用退出再启动，Main Session 恢复正常

---

## Phase 9: 打包 & 分发

**目标**：Template Repo 就绪。

### electron-builder 配置

- macOS：DMG + zip
- Windows：NSIS installer + portable
- Linux：AppImage + deb

### 清洁检查

确认不包含：
- 真实 API Key / token / 凭据
- 真实业务 Flow
- 真实分组码
- 内部仓库地址
- node_modules / dist / .git
- 用户数据、日志、缓存

### README.md

- 一句话介绍
- 快速开始（fork → install → dev → build）
- 架构概览
- 如何创建自定义 Flow
- 如何修改 UI
- 配置说明

### 验证

- 全新环境 clone → install → dev → build
- 打包产物可安装运行
- 全文搜索无敏感信息

---

## 开发依赖图

```
Phase 0 (脚手架)
  │
  ├── Phase 1 (EventBus + Logger)
  │     │
  │     ├── Phase 2 (Claude Runner)     ─┐
  │     ├── Phase 3 (Profile Manager)    ├── 可并行
  │     ├── Phase 4 (Flow Manager)       ─┘
  │     └── Phase 5 (Main Memory)        ─┘
  │
  ├── Phase 6 (Electron Shell)     ← 依赖 Phase 1-5
  ├── Phase 7 (Renderer UI)        ← 依赖 Phase 6
  ├── Phase 8 (会话整合)            ← 依赖 Phase 6-7
  └── Phase 9 (打包分发)            ← 依赖 Phase 8
```

Phase 2-5 可并行开发（各自依赖 EventBus/Logger 但互不依赖）。
