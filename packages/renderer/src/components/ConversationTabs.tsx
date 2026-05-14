import React from 'react'
import { useChat } from '../hooks/useChat'
import { useFlowStore } from '../stores/flowStore'

export function ConversationTabs() {
  const { conversations, order, activeConvId, setActiveConv, closeConversation, newConversation, currentProfile } = useChat()
  const currentFlow = useFlowStore((s) => s.currentFlow)

  if (order.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-gray-50">
        <span className="text-xs text-gray-400">No conversations</span>
        {currentProfile && (
          <button
            onClick={() => newConversation(currentFlow)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            + New
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0 border-b border-gray-200 bg-gray-50 overflow-x-auto flex-shrink-0">
      {order.map((id) => {
        const conv = conversations[id]
        if (!conv) return null
        const isActive = id === activeConvId
        return (
          <div
            key={id}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs border-r border-gray-200 cursor-pointer flex-shrink-0 ${
              isActive ? 'bg-white text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-100'
            }`}
            onClick={() => setActiveConv(id)}
          >
            <span>{conv.title}</span>
            {conv.isStreaming && <span className="text-blue-400 animate-pulse">●</span>}
            <button
              onClick={(e) => { e.stopPropagation(); closeConversation(id) }}
              className="ml-1 text-gray-400 hover:text-gray-700 leading-none"
            >
              ×
            </button>
          </div>
        )
      })}
      {currentProfile && (
        <button
          onClick={() => newConversation(currentFlow)}
          className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-700 flex-shrink-0"
        >
          +
        </button>
      )}
    </div>
  )
}
