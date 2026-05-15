// Shared types across all packages

export interface Profile {
  id: string
  name: string
  apiUrl: string
  apiKey: string
  model: string
  systemPrompt?: string
  isDefault: boolean
}

export interface FlowMeta {
  id: string
  name: string
  description: string
  version: string
  tools: string[]
  group?: string
  dir: string
  body?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  thinking?: string
  toolUse?: ToolUseInfo[]
  isStreaming?: boolean
}

export interface ToolUseInfo {
  name: string
  input: Record<string, unknown>
}

// Claude CLI stream-json event types
export interface CLIInitEvent {
  type: 'system'
  subtype: 'init'
  session_id: string
  tools: string[]
  model: string
}

export interface CLIAssistantEvent {
  type: 'assistant'
  subtype: 'text' | 'thinking' | 'tool_use'
  content: string
  session_id: string
}

export interface CLIStreamEvent {
  type: 'stream_event'
  content: string
  session_id: string
}

export interface CLIDoneEvent {
  type: 'result'
  subtype: 'success' | 'error'
  result: string
  session_id: string
  cost_usd?: number
  duration_ms?: number
  num_turns?: number
}

export type CLIEvent = CLIInitEvent | CLIAssistantEvent | CLIStreamEvent | CLIDoneEvent

export interface RunnerOptions {
  model: string
  systemPrompt?: string
  appendSystemPrompt?: string
  cwd?: string
  addDirs?: string[]
  bare?: boolean
  sessionId?: string
  env?: Record<string, string>
  allowedTools?: string[]
  settingsFile?: string
  firstMessage?: string
}

export interface SessionInfo {
  sessionId: string
  profileId: string
  flowId?: string
  isMainSession?: boolean
  startedAt: number
}

export type CoreEventMap = {
  'chat:stream': { sessionId: string; content: string }
  'chat:thinking': { sessionId: string; content: string }
  'chat:tool_use': { sessionId: string; tool: ToolUseInfo }
  'chat:done': { sessionId: string; result: CLIDoneEvent }
  'chat:error': { sessionId: string; error: Error }
  'session:init': { sessionId: string }
  'session:exit': { sessionId: string; code: number | null }
  'flow:installed': { flowId: string }
  'flow:removed': { flowId: string }
  'memory:updated': { path: string }
}
