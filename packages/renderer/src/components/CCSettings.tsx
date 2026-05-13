import React from 'react'
import { useCC } from '../hooks/useCC'

export function CCSettings() {
  const { ccVersion, ccInstalled, install, update } = useCC()

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Claude Code CLI</h2>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Status</span>
          <span className={`text-sm font-medium ${ccInstalled ? 'text-green-600' : 'text-red-600'}`}>
            {ccInstalled ? `Installed (v${ccVersion ?? 'unknown'})` : 'Not Installed'}
          </span>
        </div>

        <div className="flex gap-2">
          {!ccInstalled && (
            <button
              onClick={install}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
            >
              Install
            </button>
          )}
          {ccInstalled && (
            <button
              onClick={update}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-200"
            >
              Update
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
