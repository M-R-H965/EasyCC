import { useCallback } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useProfileStore } from '../stores/profileStore'
import { useFlowStore } from '../stores/flowStore'
import type { FlowMeta, Profile } from '@easycc/shared'

interface PersistedConversation {
  id: string
  title: string
  flowId: string | null
  flowName: string | null
  flowDir: string | null
  profileId: string
  sessionId: string | null
  messages: import('@easycc/shared').ChatMessage[]
  createdAt: number
}

declare global {
  interface Window {
    electronAPI: {
      profile: {
        list: () => Promise<Profile[]>
        get: (id: string) => Promise<Profile | null>
        getDefault: () => Promise<Profile | null>
        create: (data: unknown) => Promise<Profile>
        update: (id: string, patch: unknown) => Promise<Profile>
        delete: (id: string) => Promise<void>
        setDefault: (id: string) => Promise<void>
        testConnection: (id: string) => Promise<boolean>
      }
      conversation: {
        create: (options: unknown) => Promise<string>
        send: (sessionId: string, message: string) => Promise<void>
        stop: (sessionId: string) => Promise<void>
      }
      flow: {
        listAvailable: () => Promise<FlowMeta[]>
        get: (id: string) => Promise<FlowMeta | null>
        enable: (id: string) => Promise<void>
        disable: (id: string) => Promise<void>
        getByGroup: (group: string) => Promise<FlowMeta[]>
      }
      cc: {
        getVersion: () => Promise<string | null>
        isInstalled: () => Promise<boolean>
        install: () => Promise<void>
        update: () => Promise<void>
      }
      memory: {
        read: () => Promise<string>
        append: (section: string, content: string) => Promise<void>
        compress: () => Promise<void>
      }
      app: {
        getVersion: () => Promise<string>
      }
      convstore: {
        saveAll: (conversations: unknown[]) => Promise<void>
        loadAll: (flowDirs: string[]) => Promise<PersistedConversation[]>
      }
      events: {
        onChatStream: (cb: (payload: { sessionId: string; content: string }) => void) => void
        onChatThinking: (cb: (payload: { sessionId: string; content: string }) => void) => void
        onChatDone: (cb: (payload: { sessionId: string }) => void) => void
        onChatError: (cb: (payload: { sessionId: string; error: Error }) => void) => void
        onChatToolUse: (cb: (payload: unknown) => void) => void
        onSessionInit: (cb: (payload: unknown) => void) => void
        onSessionExit: (cb: (payload: unknown) => void) => void
      }
    }
  }
}

export function useChat() {
  const store = useChatStore()
  const currentProfile = useProfileStore((s) => s.currentProfile)
  const currentFlow = useFlowStore((s) => s.currentFlow)

  const activeConv = store.activeConvId ? store.conversations[store.activeConvId] : null

  const newConversation = useCallback((flow: FlowMeta | null = currentFlow) => {
    if (!currentProfile) return null
    return store.createConversation({ flow, profile: currentProfile })
  }, [currentProfile, currentFlow])

  const sendMessage = useCallback(async (content: string, convId?: string) => {
    const targetId = convId ?? store.activeConvId
    if (!targetId) return
    const conv = store.conversations[targetId]
    if (!conv || conv.isStreaming) return

    store.addMessage(targetId, {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    })
    store.addMessage(targetId, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    })
    store.setStreaming(targetId, true)

    try {
      let sessionId = conv.sessionId
      const profile = (conv.profileSnapshot.apiKey && conv.profileSnapshot.model)
        ? conv.profileSnapshot
        : currentProfile
      if (!profile?.apiKey || !profile?.model) {
        store.setStreaming(targetId, false)
        return
      }
      const buildOptions = async (includeHistory = false) => {
        const options: Record<string, unknown> = {
          model: profile.model,
          env: {
            ANTHROPIC_API_KEY: profile.apiKey,
            ...(profile.apiUrl !== 'https://api.anthropic.com'
              ? { ANTHROPIC_BASE_URL: profile.apiUrl }
              : {}),
          },
        }
        if (profile.systemPrompt) options.systemPrompt = profile.systemPrompt
        if (conv.flowSystemPrompt) options.systemPrompt = conv.flowSystemPrompt

        // Build appended context: cross-session memory + conversation history (if restoring)
        let appendedContext = ''

        if (!conv.flowDir) {
          // Inject cross-session memory into general chat
          try {
            const memory = await window.electronAPI.memory.read()
            if (memory && memory.trim() !== '# Main Memory\n\n## Recent\n\n## History\n\n## Topics') {
              appendedContext += `\n\n# Cross-session memory (recent activity):\n${memory}`
            }
          } catch {}
        }

        if (includeHistory && conv.messages.length > 0) {
          // Inject this conversation's message history when restoring after restart
          appendedContext += `\n\n# This conversation's history (restored after restart):\n`
          for (const msg of conv.messages) {
            if (msg.role === 'user') {
              appendedContext += `\nUser: ${msg.content}`
            } else if (msg.role === 'assistant') {
              appendedContext += `\nAssistant: ${msg.content}`
            }
          }
          appendedContext += `\n\n# Continue the conversation from here:\n`
        }

        if (appendedContext) {
          options.appendSystemPrompt = appendedContext
        }

        if (conv.flowDir) {
          options.cwd = conv.flowDir
          options.addDirs = [conv.flowDir]
          options.bare = true
          if (conv.flowTools && conv.flowTools.length > 0) options.allowedTools = conv.flowTools
          options.settingsFile = `${conv.flowDir}/settings.json`
        }
        return options
      }

      if (!sessionId) {
        // New conversation — spawn fresh (no history to restore)
        const options = await buildOptions(false)
        options.firstMessage = content
        sessionId = await window.electronAPI.conversation.create(options)
        store.setSessionId(targetId, sessionId)
      } else {
        // Existing sessionId — try send; if runner doesn't know it (e.g. after restart), respawn with history
        try {
          await window.electronAPI.conversation.send(sessionId, content)
        } catch {
          // Session expired — respawn with conversation history so Claude remembers context
          const options = await buildOptions(true)
          options.firstMessage = content
          const newSessionId = await window.electronAPI.conversation.create(options)
          store.setSessionId(targetId, newSessionId)
        }
      }
    } catch {
      store.setStreaming(targetId, false)
    }
  }, [store])

  const stopStreaming = useCallback(async (convId?: string) => {
    const targetId = convId ?? store.activeConvId
    if (!targetId) return
    const conv = store.conversations[targetId]
    if (conv?.sessionId) {
      await window.electronAPI.conversation.stop(conv.sessionId)
    }
    store.setStreaming(targetId, false)
  }, [store])

  return {
    conversations: store.conversations,
    order: store.order,
    activeConvId: store.activeConvId,
    activeConv,
    newConversation,
    closeConversation: store.closeConversation,
    setActiveConv: store.setActiveConv,
    sendMessage,
    stopStreaming,
    currentProfile,
    currentFlow,
  }
}
