import { create } from 'zustand'
import type { ChatMessage } from '../../../../shared/types'

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  currentSessionId: string | null
  addMessage: (message: ChatMessage) => void
  appendToLastAssistant: (content: string) => void
  setLastAssistantThinking: (content: string) => void
  setStreaming: (streaming: boolean) => void
  setSessionId: (id: string | null) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  currentSessionId: null,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  appendToLastAssistant: (content) =>
    set((state) => {
      const messages = [...state.messages]
      const lastIdx = messages.length - 1
      if (lastIdx >= 0 && messages[lastIdx].role === 'assistant') {
        messages[lastIdx] = {
          ...messages[lastIdx],
          content: messages[lastIdx].content + content,
        }
      }
      return { messages }
    }),

  setLastAssistantThinking: (content) =>
    set((state) => {
      const messages = [...state.messages]
      const lastIdx = messages.length - 1
      if (lastIdx >= 0 && messages[lastIdx].role === 'assistant') {
        messages[lastIdx] = { ...messages[lastIdx], thinking: content }
      }
      return { messages }
    }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setSessionId: (id) => set({ currentSessionId: id }),
  clearMessages: () => set({ messages: [], currentSessionId: null }),
}))
