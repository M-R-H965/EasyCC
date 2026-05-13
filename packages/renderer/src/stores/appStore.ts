import { create } from 'zustand'

type Panel = 'chat' | 'flows' | 'profile' | 'cc' | 'memory'

interface AppState {
  activePanel: Panel
  ccVersion: string | null
  ccInstalled: boolean
  setActivePanel: (panel: Panel) => void
  setCCVersion: (version: string | null) => void
  setCCInstalled: (installed: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activePanel: 'chat',
  ccVersion: null,
  ccInstalled: false,
  setActivePanel: (panel) => set({ activePanel: panel }),
  setCCVersion: (version) => set({ ccVersion: version }),
  setCCInstalled: (installed) => set({ ccInstalled: installed }),
}))
