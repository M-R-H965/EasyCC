import React, { useEffect, useRef } from 'react'
import { useAppStore } from './stores/appStore'
import { useChatStore } from './stores/chatStore'
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

export default function App() {
  const activePanel = useAppStore((s) => s.activePanel)
  const store = useChatStore()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaded = useRef(false)

  // Load persisted conversations on first mount
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

  // Debounced save on every store change (skip until initial load is done)
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

  // Wire stream events
  useEffect(() => {
    window.electronAPI?.events?.onChatStream((payload) => {
      store.appendToLastAssistantBySessionId(payload.sessionId, payload.content)
    })
    window.electronAPI?.events?.onChatThinking((payload) => {
      store.setLastAssistantThinkingBySessionId(payload.sessionId, payload.content)
    })
    window.electronAPI?.events?.onChatDone((payload) => {
      store.setStreamingBySessionId(payload.sessionId, false)
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
        {activePanel === 'chat' && <ChatArea />}
        {activePanel === 'profile' && <ProfilePanel />}
        {activePanel === 'cc' && <CCSettings />}
        {activePanel === 'memory' && <MemoryPanel />}
      </main>
    </div>
  )
}
