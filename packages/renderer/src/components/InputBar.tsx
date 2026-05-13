import React, { useState } from 'react'
import { useChat } from '../hooks/useChat'

export function InputBar() {
  const [input, setInput] = useState('')
  const { sendMessage, stopStreaming, isStreaming } = useChat()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    sendMessage(text)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-gray-200">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={isStreaming}
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={stopStreaming}
          className="rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
        >
          Stop
        </button>
      ) : (
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          disabled={!input.trim()}
        >
          Send
        </button>
      )}
    </form>
  )
}
