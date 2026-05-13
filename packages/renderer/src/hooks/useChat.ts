import { useCallback } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useProfileStore } from '../stores/profileStore'
import { useFlowStore } from '../stores/flowStore'

declare global {
  interface Window {
    electronAPI: {
      conversation: {
        create: (options: unknown) => Promise<string>
        send: (sessionId: string, message: string) => Promise<void>
        stop: (sessionId: string) => Promise<void>
      }
      events: {
        onChatStream: (cb: (payload: { sessionId: string; content: string }) => void) => void
        onChatThinking: (cb: (payload: { sessionId: string; content: string }) => void) => void
        onChatDone: (cb: (payload: { sessionId: string }) => void) => void
        onChatError: (cb: (payload: { sessionId: string; error: Error }) => void) => void
      }
    }
  }
}

export function useChat() {
  const { messages, isStreaming, currentSessionId, addMessage, appendToLastAssistant, setLastAssistantThinking, setStreaming, setSessionId, clearMessages } = useChatStore()
  const currentProfile = useProfileStore((s) => s.currentProfile)
  const currentFlow = useFlowStore((s) => s.currentFlow)

  const sendMessage = useCallback(async (content: string) => {
    if (!currentProfile || isStreaming) return

    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    })

    const assistantId = crypto.randomUUID()
    addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    })

    setStreaming(true)

    try {
      let sessionId = currentSessionId

      if (!sessionId) {
        const options: Record<string, unknown> = {
          model: currentProfile.model,
          env: {
            ANTHROPIC_API_KEY: currentProfile.apiKey,
            ...(currentProfile.apiUrl !== 'https://api.anthropic.com'
              ? { ANTHROPIC_BASE_URL: currentProfile.apiUrl }
              : {}),
          },
        }

        if (currentProfile.systemPrompt) {
          options.systemPrompt = currentProfile.systemPrompt
        }

        if (currentFlow) {
          options.cwd = currentFlow.dir
          options.addDirs = [currentFlow.dir]
          options.bare = true
        }

        sessionId = await window.electronAPI.conversation.create(options)
        setSessionId(sessionId)
      }

      await window.electronAPI.conversation.send(sessionId, content)
    } catch (err) {
      console.error('Failed to send message:', err)
      setStreaming(false)
    }
  }, [currentProfile, currentFlow, currentSessionId, isStreaming])

  const stopStreaming = useCallback(async () => {
    if (currentSessionId) {
      await window.electronAPI.conversation.stop(currentSessionId)
    }
    setStreaming(false)
  }, [currentSessionId])

  const resetSession = useCallback(() => {
    clearMessages()
  }, [])

  return { messages, isStreaming, sendMessage, stopStreaming, resetSession }
}
