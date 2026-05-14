import React from 'react'
import { useFlows } from '../hooks/useFlows'
import { useFlowStore } from '../stores/flowStore'
import { useChat } from '../hooks/useChat'

export function FlowPanel() {
  const { flows } = useFlows()
  const { currentFlow, setCurrentFlow } = useFlowStore()
  const { newConversation, currentProfile } = useChat()

  const handleSelectFlow = (flow: NonNullable<typeof currentFlow>) => {
    setCurrentFlow(flow)
    if (currentProfile) newConversation(flow)
  }

  return (
    <div className="p-3">
      <h2 className="text-sm font-semibold mb-3 text-gray-700">Flows</h2>
      {flows.length === 0 && (
        <p className="text-xs text-gray-400">No flows found in flows/ directory.</p>
      )}
      <div className="space-y-1.5">
        {flows.map((flow) => {
          const isActive = currentFlow?.id === flow.id
          return (
            <div
              key={flow.id}
              className={`rounded-lg border p-2.5 transition-colors ${
                isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-medium truncate">{flow.name}</span>
                <button
                  onClick={() => handleSelectFlow(flow)}
                  disabled={!currentProfile}
                  className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 flex-shrink-0"
                >
                  Load
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{flow.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
