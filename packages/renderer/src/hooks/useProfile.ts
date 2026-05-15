import { useCallback, useEffect } from 'react'
import { useProfileStore } from '../stores/profileStore'

export function useProfile() {
  const { profiles, currentProfile, setProfiles, setCurrentProfile } = useProfileStore()

  const loadProfiles = useCallback(async () => {
    const list = await window.electronAPI.profile.list()
    setProfiles(list)
    if (!currentProfile && list.length > 0) {
      const def = list.find((p) => p.isDefault) ?? list[0]
      setCurrentProfile(def)
    }
  }, [])

  const createProfile = useCallback(async (data: Record<string, unknown>) => {
    const profile = await window.electronAPI.profile.create(data)
    await loadProfiles()
    return profile
  }, [loadProfiles])

  const updateProfile = useCallback(async (id: string, patch: Record<string, string>) => {
    const profile = await window.electronAPI.profile.update(id, patch)
    await loadProfiles()
    return profile
  }, [loadProfiles])

  const deleteProfile = useCallback(async (id: string) => {
    await window.electronAPI.profile.delete(id)
    if (currentProfile?.id === id) {
      setCurrentProfile(null)
    }
    await loadProfiles()
  }, [loadProfiles, currentProfile])

  const setDefault = useCallback(async (id: string) => {
    await window.electronAPI.profile.setDefault(id)
    await loadProfiles()
  }, [loadProfiles])

  const testConnection = useCallback(async (id: string) => {
    return window.electronAPI.profile.testConnection(id)
  }, [])

  useEffect(() => {
    loadProfiles()
  }, [])

  return { profiles, currentProfile, setCurrentProfile, createProfile, updateProfile, deleteProfile, setDefault, testConnection }
}
