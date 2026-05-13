import { create } from 'zustand'
import type { Profile } from '../../../../shared/types'

interface ProfileState {
  profiles: Profile[]
  currentProfile: Profile | null
  setProfiles: (profiles: Profile[]) => void
  setCurrentProfile: (profile: Profile | null) => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  profiles: [],
  currentProfile: null,
  setProfiles: (profiles) => set({ profiles }),
  setCurrentProfile: (profile) => set({ currentProfile: profile }),
}))
