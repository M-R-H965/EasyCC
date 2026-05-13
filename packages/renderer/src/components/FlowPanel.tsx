import React from 'react'
import { useFlows } from '../hooks/useFlows'
import { useFlowStore } from '../stores/flowStore'

export function FlowPanel() {
  const { flows, enableFlow, disableFlow, selectFlow } = useFlows()
  const enabledFlows = useFlowStore((s) => s.enabledFlows)
  const currentFlow = useFlowStore((s) => s.currentFlow)

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Flows</h2>
      {flows.length === 0 && (
        <p className="text-gray-500">No flows found in flows/ directory.</p>
      )}
      <div className="space-y-2">
        {flows.map((flow) => {
          const isEnabled = enabledFlows.has(flow.id)
          const isActive = currentFlow?.id === flow.id

          return (
            <div
              key={flow.id}
              className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => selectFlow(isActive ? null : flow)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{flow.name}</span>
                  <span className="ml-2 text-xs text-gray-500">v{flow.version}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    isEnabled ? disableFlow(flow.id) : enableFlow(flow.id)
                  }}
                  className={`text-xs px-2 py-1 rounded ${
                    isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">{flow.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
