import React, { useEffect, useRef } from 'react'
import { useAppStore } from './stores/appStore'
import { useChatStore } from './stores/chatStore'
import { useProfileStore } from './stores/profileStore'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './components/ChatView'
import { InputBar } from './components/InputBar'
import { FlowPanel } from './components/FlowPanel'
import { ProfilePanel } from './components/ProfilePanel'
import { CCSettings } from './components/CCSettings'
import { MemoryPanel } from './components/MemoryPanel'
import { ConversationTabs } from './components/ConversationTabs'

function ChatArea() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <ConversationTabs />
      <ChatView />
      <InputBar />
    </div>
  )
}

// Ensures at least one no-flow conversation exists when the Chat panel is open
function ChatPanel() {
  const profile = useProfileStore((s) => s.currentProfile)
  const store = useChatStore()

  useEffect(() => {
    if (!profile) return
    const hasGeneralConv = Object.values(store.conversations).some((c) => c.flowId === null)
    if (!hasGeneralConv) {
      store.createConversation({ flow: null, profile })
    }
  }, [profile])

  return <ChatArea />
}

export default function App() {
  const activePanel = useAppStore((s) => s.activePanel)
  const store = useChatStore()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.convstore) return

    api.flow.listAvailable().then(async (flows) => {
      const flowDirs = flows.map((f) => f.dir)
      const persisted = await api.convstore.loadAll(flowDirs)
      if (persisted.length > 0) {
        useChatStore.getState().hydrateConversations(persisted)
      }
      loaded.current = true
    })
  }, [])

  useEffect(() => {
    const unsub = useChatStore.subscribe((state) => {
      if (!loaded.current) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const convs = Object.values(state.conversations).map((c) => ({
          id: c.id,
          title: c.title,
          flowId: c.flowId,
          flowName: c.flowName,
          flowDir: c.flowDir,
          flowTools: c.flowTools,
          profileId: c.profileId,
          sessionId: c.sessionId,
          messages: c.messages,
          createdAt: c.createdAt,
        }))
        window.electronAPI?.convstore?.saveAll(convs)
      }, 500)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    window.electronAPI?.events?.onChatStream((payload) => {
      store.appendToLastAssistantBySessionId(payload.sessionId, payload.content)
    })
    window.electronAPI?.events?.onChatThinking((payload) => {
      store.setLastAssistantThinkingBySessionId(payload.sessionId, payload.content)
    })
    window.electronAPI?.events?.onChatDone((payload) => {
      store.setStreamingBySessionId(payload.sessionId, false)
      const conv = Object.values(useChatStore.getState().conversations)
        .find((c) => c.sessionId === payload.sessionId)
      if (conv && conv.messages.length >= 2) {
        const msgs = conv.messages
        const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
        const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')
        if (lastUser && lastAssistant) {
          const entry = `[${conv.title}] Q: ${lastUser.content.slice(0, 120)} → A: ${lastAssistant.content.slice(0, 200)}`
          window.electronAPI.memory.append('Recent', entry)
        }
      }
    })
    window.electronAPI?.events?.onChatError((payload) => {
      store.setStreamingBySessionId((payload as any).sessionId, false)
    })
  }, [])

  if (activePanel === 'flows') {
    return (
      <div className="flex h-screen bg-white">
        <Sidebar />
        <div className="w-56 border-r border-gray-200 flex-shrink-0 overflow-y-auto">
          <FlowPanel />
        </div>
        <ChatArea />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {activePanel === 'chat' && <ChatPanel />}
        {activePanel === 'profile' && <ProfilePanel />}
        {activePanel === 'cc' && <CCSettings />}
        {activePanel === 'memory' && <MemoryPanel />}
      </main>
    </div>
  )
}

