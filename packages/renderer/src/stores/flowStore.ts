import { create } from 'zustand'
import type { FlowMeta } from '../../../../shared/types'

interface FlowState {
  flows: FlowMeta[]
  enabledFlows: Set<string>
  currentFlow: FlowMeta | null
  setFlows: (flows: FlowMeta[]) => void
  setEnabled: (flowId: string, enabled: boolean) => void
  setCurrentFlow: (flow: FlowMeta | null) => void
}

export const useFlowStore = create<FlowState>((set) => ({
  flows: [],
  enabledFlows: new Set(),
  currentFlow: null,

  setFlows: (flows) => set({ flows }),
  setEnabled: (flowId, enabled) =>
    set((state) => {
      const next = new Set(state.enabledFlows)
      if (enabled) next.add(flowId)
      else next.delete(flowId)
      return { enabledFlows: next }
    }),
  setCurrentFlow: (flow) => set({ currentFlow: flow }),
}))
