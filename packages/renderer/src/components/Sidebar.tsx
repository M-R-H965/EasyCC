import React from 'react'
import { useAppStore } from '../stores/appStore'

const NAV_ITEMS = [
  { id: 'chat' as const, label: 'Chat', icon: '>' },
  { id: 'flows' as const, label: 'Flows', icon: '*' },
  { id: 'profile' as const, label: 'Profiles', icon: '@' },
  { id: 'cc' as const, label: 'Claude Code', icon: '#' },
  { id: 'memory' as const, label: 'Memory', icon: '&' },
]

export function Sidebar() {
  const activePanel = useAppStore((s) => s.activePanel)
  const setActivePanel = useAppStore((s) => s.setActivePanel)

  return (
    <div className="w-48 border-r border-gray-200 flex flex-col py-2">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => setActivePanel(item.id)}
          className={`text-left px-4 py-2.5 text-sm transition-colors ${
            activePanel === item.id
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span className="mr-2 text-xs opacity-50">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  )
}
