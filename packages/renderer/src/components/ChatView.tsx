import React, { useRef, useEffect } from 'react'
import { useChatStore } from '../stores/chatStore'

export function ChatView() {
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-500">
          Select a Profile and start chatting
        </div>
      )}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
        >
          <div
            className={`inline-block max-w-[80%] rounded-lg px-4 py-2 ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            {msg.thinking && (
              <details className="mb-2 text-xs text-gray-500">
                <summary className="cursor-pointer">Thinking...</summary>
                <pre className="mt-1 whitespace-pre-wrap">{msg.thinking}</pre>
              </details>
            )}
            <div className="whitespace-pre-wrap">
              {msg.content || (msg.isStreaming ? '...' : '')}
            </div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
