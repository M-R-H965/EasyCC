import { create } from 'zustand'
import type { ChatMessage, FlowMeta, Profile } from '@easycc/shared'

export interface Conversation {
  id: string
  title: string
  flowId: string | null
  flowName: string | null
  flowDir: string | null
  profileId: string
  profileSnapshot: Profile // captured at creation; subsequent profile edits don't affect existing conv
  sessionId: string | null
  messages: ChatMessage[]
  isStreaming: boolean
  createdAt: number
}

interface ChatState {
  conversations: Record<string, Conversation>
  order: string[] // tab order
  activeConvId: string | null

  createConversation: (params: { flow: FlowMeta | null; profile: Profile }) => string
  closeConversation: (convId: string) => void
  setActiveConv: (convId: string) => void

  addMessage: (convId: string, message: ChatMessage) => void
  appendToLastAssistantBySessionId: (sessionId: string, content: string) => void
  setLastAssistantThinkingBySessionId: (sessionId: string, content: string) => void
  setStreaming: (convId: string, streaming: boolean) => void
  setStreamingBySessionId: (sessionId: string, streaming: boolean) => void
  setSessionId: (convId: string, sessionId: string | null) => void
  hydrateConversations: (convs: Array<Omit<Conversation, 'isStreaming' | 'profileSnapshot'>>) => void
}

function nextTitle(existing: Conversation[], flowName: string | null): string {
  const base = flowName ?? 'Chat'
  let n = 1
  const used = new Set(existing.map((c) => c.title))
  while (used.has(`${base} #${n}`)) n++
  return `${base} #${n}`
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: {},
  order: [],
  activeConvId: null,

  createConversation: ({ flow, profile }) => {
    const id = crypto.randomUUID()
    const all = Object.values(get().conversations)
    const conv: Conversation = {
      id,
      title: nextTitle(all, flow?.name ?? null),
      flowId: flow?.id ?? null,
      flowName: flow?.name ?? null,
      flowDir: flow?.dir ?? null,
      profileId: profile.id,
      profileSnapshot: profile,
      sessionId: null,
      messages: [],
      isStreaming: false,
      createdAt: Date.now(),
    }
    set((state) => ({
      conversations: { ...state.conversations, [id]: conv },
      order: [...state.order, id],
      activeConvId: id,
    }))
    return id
  },

  closeConversation: (convId) =>
    set((state) => {
      const { [convId]: _, ...rest } = state.conversations
      const order = state.order.filter((x) => x !== convId)
      let activeConvId = state.activeConvId
      if (activeConvId === convId) {
        activeConvId = order[order.length - 1] ?? null
      }
      return { conversations: rest, order, activeConvId }
    }),

  setActiveConv: (convId) => set({ activeConvId: convId }),

  addMessage: (convId, message) =>
    set((state) => {
      const conv = state.conversations[convId]
      if (!conv) return state
      return {
        conversations: {
          ...state.conversations,
          [convId]: { ...conv, messages: [...conv.messages, message] },
        },
      }
    }),

  appendToLastAssistantBySessionId: (sessionId, content) =>
    set((state) => {
      const conv = Object.values(state.conversations).find((c) => c.sessionId === sessionId)
      if (!conv) return state
      const messages = [...conv.messages]
      const lastIdx = messages.length - 1
      if (lastIdx < 0 || messages[lastIdx].role !== 'assistant') return state
      messages[lastIdx] = { ...messages[lastIdx], content: messages[lastIdx].content + content }
      return {
        conversations: { ...state.conversations, [conv.id]: { ...conv, messages } },
      }
    }),

  setLastAssistantThinkingBySessionId: (sessionId, content) =>
    set((state) => {
      const conv = Object.values(state.conversations).find((c) => c.sessionId === sessionId)
      if (!conv) return state
      const messages = [...conv.messages]
      const lastIdx = messages.length - 1
      if (lastIdx < 0 || messages[lastIdx].role !== 'assistant') return state
      messages[lastIdx] = { ...messages[lastIdx], thinking: content }
      return {
        conversations: { ...state.conversations, [conv.id]: { ...conv, messages } },
      }
    }),

  setStreaming: (convId, streaming) =>
    set((state) => {
      const conv = state.conversations[convId]
      if (!conv) return state
      return {
        conversations: {
          ...state.conversations,
          [convId]: { ...conv, isStreaming: streaming },
        },
      }
    }),

  setStreamingBySessionId: (sessionId, streaming) =>
    set((state) => {
      const conv = Object.values(state.conversations).find((c) => c.sessionId === sessionId)
      if (!conv) return state
      return {
        conversations: {
          ...state.conversations,
          [conv.id]: { ...conv, isStreaming: streaming },
        },
      }
    }),

  setSessionId: (convId, sessionId) =>
    set((state) => {
      const conv = state.conversations[convId]
      if (!conv) return state
      return {
        conversations: {
          ...state.conversations,
          [convId]: { ...conv, sessionId },
        },
      }
    }),

  hydrateConversations: (convs) => {
    const conversations: Record<string, Conversation> = {}
    const order: string[] = []
    for (const c of convs) {
      conversations[c.id] = {
        ...c,
        isStreaming: false,
        // profileSnapshot is not persisted — reconstruct a minimal stub so the
        // type is satisfied; the real profile is only needed when sending a new
        // message, at which point the user will have re-selected a profile.
        profileSnapshot: { id: c.profileId, name: '', apiUrl: '', apiKey: '', model: '', isDefault: false },
      }
      order.push(c.id)
    }
    set({ conversations, order, activeConvId: order[order.length - 1] ?? null })
  },
}))
