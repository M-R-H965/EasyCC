import React, { useEffect } from 'react'
import { useAppStore } from './stores/appStore'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './components/ChatView'
import { InputBar } from './components/InputBar'
import { FlowPanel } from './components/FlowPanel'
import { ProfilePanel } from './components/ProfilePanel'
import { CCSettings } from './components/CCSettings'
import { MemoryPanel } from './components/MemoryPanel'
import { useChatStore } from './stores/chatStore'

function PanelContent() {
  const activePanel = useAppStore((s) => s.activePanel)

  switch (activePanel) {
    case 'chat':
      return (
        <>
          <ChatView />
          <InputBar />
        </>
      )
    case 'flows':
      return <FlowPanel />
    case 'profile':
      return <ProfilePanel />
    case 'cc':
      return <CCSettings />
    case 'memory':
      return <MemoryPanel />
    default:
      return null
  }
}

export default function App() {
  // Register event listeners once
  useEffect(() => {
    const appendToLastAssistant = useChatStore.getState().appendToLastAssistant
    const setLastAssistantThinking = useChatStore.getState().setLastAssistantThinking
    const setStreaming = useChatStore.getState().setStreaming

    window.electronAPI?.events?.onChatStream((payload) => {
      appendToLastAssistant(payload.content)
    })

    window.electronAPI?.events?.onChatThinking((payload) => {
      setLastAssistantThinking(payload.content)
    })

    window.electronAPI?.events?.onChatDone(() => {
      setStreaming(false)
    })

    window.electronAPI?.events?.onChatError(() => {
      setStreaming(false)
    })
  }, [])

  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <PanelContent />
      </main>
    </div>
  )
}
