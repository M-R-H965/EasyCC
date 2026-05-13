import React, { useEffect } from 'react'
import { useMemory } from '../hooks/useMemory'

export function MemoryPanel() {
  const { content, load } = useMemory()

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Main Memory</h2>
      </div>
      <pre className="bg-gray-50 border rounded-lg p-3 text-sm whitespace-pre-wrap overflow-auto max-h-[600px]">
        {content || 'No memory content yet.'}
      </pre>
    </div>
  )
}
