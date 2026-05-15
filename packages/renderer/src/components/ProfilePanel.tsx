import React, { useState } from 'react'
import { useProfile } from '../hooks/useProfile'

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

export function ProfilePanel() {
  const { profiles, currentProfile, setCurrentProfile, createProfile, deleteProfile, setDefault, testConnection } = useProfile()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', apiUrl: 'https://api.anthropic.com', apiKey: '', model: 'claude-sonnet-4-6' })
  const [testStates, setTestStates] = useState<Record<string, TestState>>({})

  const handleCreate = async () => {
    if (!form.name || !form.apiKey) return
    await createProfile({ ...form, isDefault: false })
    setForm({ name: '', apiUrl: 'https://api.anthropic.com', apiKey: '', model: 'claude-sonnet-4-6' })
    setShowCreate(false)
  }

  const handleTest = async (id: string) => {
    setTestStates((s) => ({ ...s, [id]: 'testing' }))
    try {
      const ok = await testConnection(id)
      setTestStates((s) => ({ ...s, [id]: ok ? 'ok' : 'fail' }))
    } catch {
      setTestStates((s) => ({ ...s, [id]: 'fail' }))
    }
    setTimeout(() => {
      setTestStates((s) => {
        const { [id]: _, ...rest } = s
        return rest
      })
    }, 4000)
  }

  const renderTestButton = (id: string) => {
    const state = testStates[id] ?? 'idle'
    const label = state === 'testing' ? 'Testing…' : state === 'ok' ? '✓ OK' : state === 'fail' ? '✗ Failed' : 'Test'
    const color =
      state === 'ok' ? 'text-green-600' :
      state === 'fail' ? 'text-red-600' :
      state === 'testing' ? 'text-gray-400' :
      'text-blue-500 hover:text-blue-700'
    return (
      <button
        onClick={(e) => { e.stopPropagation(); handleTest(id) }}
        disabled={state === 'testing'}
        className={`text-xs ${color}`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Profiles</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          + New
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 border rounded-lg p-3 space-y-2">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
          <input
            placeholder="API URL"
            value={form.apiUrl}
            onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
          <input
            placeholder="API Key"
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
          <input
            placeholder="Model"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="text-sm bg-green-600 text-white px-3 py-1 rounded">Create</button>
            <button onClick={() => setShowCreate(false)} className="text-sm bg-gray-200 px-3 py-1 rounded">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`rounded-lg border p-3 cursor-pointer ${
              currentProfile?.id === profile.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
            onClick={() => setCurrentProfile(profile)}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{profile.name}</span>
              <div className="flex gap-2 items-center">
                {profile.isDefault && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Default</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setDefault(profile.id) }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Set Default
                </button>
                {renderTestButton(profile.id)}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteProfile(profile.id) }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">{profile.model} &middot; {profile.apiUrl}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
