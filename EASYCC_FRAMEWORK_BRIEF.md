# EasyCC 框架拆包说明

## 目标

EasyCC 是一个 Claude Code 桌面壳：用 Electron + React 提供 GUI，用 Claude Code CLI 作为底层执行器，并在外层封装 Profile、会话、Flow 插件、主记忆、反馈和更新能力。

本文只保留可拆包复用的框架设计；不包含具体 Flow 实现、业务数据、凭据、真实仓库地址、真实分组码或任何用户配置。

## 总体架构

```text
renderer: React UI
  ↓ window.electronAPI
preload: contextBridge API 白名单
  ↓ ipcRenderer.invoke / event listener
main: Electron 生命周期 + IPC handlers
  ↓ 调用 core，并转发事件
core: 纯 Node.js 业务逻辑
  ↓ spawn
Claude Code CLI: stream-json 输入输出
```

核心原则：

- Renderer 不直接访问文件系统、子进程或密钥。
- Preload 只暴露明确白名单 API。
- Main 负责 Electron、窗口、IPC 和应用生命周期。
- Core 不依赖 Electron，方便拆包复用。
- Claude Code CLI 是唯一模型执行器。
- Flow 是业务插件层，框架只识别目录和元数据。

## 主要模块

### renderer

负责 UI：

- 聊天窗口和流式消息展示
- 输入框、文件附加、发送/停止
- Profile 管理
- Flow 列表、启用、同步、启动
- Claude Code 设置、版本、安装/升级
- 反馈入口

### preload

通过 `contextBridge` 暴露 `electronAPI`，建议 API 分组：

- `profile`: list/get/create/update/delete/getDefault/testConnection
- `conversation`: create/createWithFlow/createMain/send/sendMain/stop/resetMain
- `cc`: getVersion/install/update/getEnvVars/setEnvVar
- `flow`: listAvailable/enable/disable/sync/group
- `app`: getVersion/getDiagnostics/update/relaunch/updateProgress
- `feedback`: createIssue 或替代反馈通道
- `memory`: search/append/write/reset
- `events`: chatStream/chatError/chatDone/sessionReset

### main

负责：

- 创建 BrowserWindow
- 加载开发服务器或构建产物
- 检查并引导安装 Claude Code CLI
- 注册各类 IPC handler
- 应用退出时清理 Claude 子进程

### core

可优先拆包复用：

- `event-bus`: core 到 main/renderer 的事件通道
- `claude-runner`: Claude 子进程、stream-json、会话恢复
- `profile-manager`: Profile 持久化与密钥加密封装
- `flows`: Flow 发现、frontmatter、分组、安装/同步
- `main-memory`: `warmup.md` 读写与压缩
- `logger`: 本地日志

## 会话模型

### 普通会话

Profile 定义一次 Claude 会话的运行参数：

```text
id
name
apiUrl
apiKey
model
systemPrompt
isDefault
```

发送消息时，Main 调用 Core，Core 启动 Claude Code CLI 子进程，通过 stdin/stdout 传输 stream-json。

### Flow 会话

Flow 会话是带工作目录的会话：

- 每个 Flow 是一个独立目录。
- 会话 cwd 指向 Flow 目录。
- 使用 `--add-dir <flowDir>` 加入 Flow 目录。
- 使用 `--bare` 隔离用户全局 Claude 配置、插件、hooks 和记忆。
- Flow 的说明入口是 `FLOW.md`。

### Main Session

应用级常驻会话：

- 固定 conversation id。
- 使用独立工作目录。
- 启动时确保 `warmup.md` 存在。
- 启动后让 Claude 读取 `warmup.md` 并问候用户。

## Claude Runner

启动 Claude CLI 的核心参数：

```text
--output-format stream-json
--input-format stream-json
--print
--include-partial-messages
--verbose
--model <profile.model>
```

可选参数：

```text
--system-prompt <profile.systemPrompt>
--bare
--add-dir <flowDir>
--resume <sessionId>
```

事件流：

- `system/init`: 记录 session id，标记 ready
- `assistant`: assistant 消息
- `stream_event`: 增量文本或 thinking
- `result`: 最终结果与用量信息

稳定性机制：

- init 超时后允许继续写入，避免会话卡死。
- 子进程退出后保存 tombstone。
- 后续发送消息时按 session id 尝试 respawn。
- Windows 下停止会话时结束进程树。

## Profile 存储

Profile 存在用户数据目录，不进入仓库或分发包。

要求：

- API Key 落盘前加密。
- Electron 环境优先使用系统安全存储。
- 不在日志、文档、示例配置中写真实 Key。
- 第一个 Profile 自动设为默认。
- 删除默认 Profile 后自动选择剩余 Profile。

## Flow 插件系统

### 目录约定

```text
flows/
  common/
  NNN-FlowName/
    FLOW.md
    input/
    output/
    content/
```

### FLOW.md frontmatter

```yaml
---
name: Flow 名称
description: 一句话描述
version: "1.0.0"
tools: read, write, grep, glob
group: optional-group
---
```

规则：

- Flow id 使用目录名。
- `FLOW.md` 是 Flow 元数据和说明入口。
- `version` 使用 SemVer。
- `group` 可选，用于可见性过滤。
- `input/`、`output/` 是运行时目录，应忽略提交。
- 拆包时删除所有真实业务 Flow，只保留 Demo Flow。

### Flow 可见性与同步

- 无 group 的 Flow 默认可见。
- 有 group 的 Flow 仅在用户解锁后可见。
- 解锁状态保存在用户数据目录。
- 当前框架可用 Git sparse-checkout 分发 Flow；拆包后可替换分发方式，但保留“元数据索引 + 插件目录”的边界。

## Main Memory

使用一个 `warmup.md` 保存跨会话上下文：

```markdown
# 主记忆

## 近期工作

## 历史概览

## 专题档案
```

行为：

- 近期工作保留少量短条目。
- 超阈值后压缩到历史概览。
- 专题档案按主题追加。
- Main Session 启动时读取。

## 拆包保留清单

建议保留：

```text
src/core/
src/main/
src/preload/
src/renderer/
src/shared/
src/headless/
package.json
tsconfig*.json
vite.config.ts
vitest.config.ts
README.md 的框架说明
flows/ 的空骨架或 Demo Flow
```

建议移除或替换：

```text
真实业务 Flow
真实 Profile / 用户配置
真实分组码 / 凭据 / token
内部仓库地址 / 内部反馈地址
input/ output/ 日志 / 缓存
node_modules/ dist/ .git/ .idea/
带凭据的启动脚本或更新脚本
```

## 最小骨架

```text
EasyCC/
  src/
    core/
    main/
    preload/
    renderer/
    shared/
    headless/
  flows/
    common/
    000-Demo/
      FLOW.md
      input/.gitkeep
      output/.gitkeep
      content/
  package.json
  README.md
```

Demo Flow 只说明目录约定，不放业务脚本、业务配置或真实数据。

## 拆包步骤

1. 复制 TypeScript 框架代码和构建配置。
2. 删除具体业务 Flow，只保留 Demo Flow。
3. 替换启动/更新脚本中的仓库、分支、认证为占位配置。
4. 清空 Profile、日志、缓存、用户数据和构建产物。
5. 全文搜索并确认不存在真实 token、key、内部域名、真实分组码和业务数据。
6. 运行测试和构建，确认骨架可启动。
