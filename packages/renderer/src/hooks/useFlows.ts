import { useCallback, useEffect } from 'react'
import { useFlowStore } from '../stores/flowStore'

export function useFlows() {
  const { flows, currentFlow, setFlows, setEnabled, setCurrentFlow } = useFlowStore()

  const loadFlows = useCallback(async () => {
    const list = await window.electronAPI.flow.listAvailable()
    setFlows(list)
  }, [])

  const enableFlow = useCallback(async (id: string) => {
    await window.electronAPI.flow.enable(id)
    setEnabled(id, true)
  }, [])

  const disableFlow = useCallback(async (id: string) => {
    await window.electronAPI.flow.disable(id)
    setEnabled(id, false)
  }, [])

  const selectFlow = useCallback((flow: typeof currentFlow) => {
    setCurrentFlow(flow)
  }, [])

  useEffect(() => {
    loadFlows()
  }, [])

  return { flows, currentFlow, loadFlows, enableFlow, disableFlow, selectFlow }
}
