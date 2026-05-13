import { useCallback, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'

export function useCC() {
  const { ccVersion, ccInstalled, setCCVersion, setCCInstalled } = useAppStore()

  const checkStatus = useCallback(async () => {
    const installed = await window.electronAPI.cc.isInstalled()
    setCCInstalled(installed)
    if (installed) {
      const version = await window.electronAPI.cc.getVersion()
      setCCVersion(version)
    }
  }, [])

  const install = useCallback(async () => {
    await window.electronAPI.cc.install()
    await checkStatus()
  }, [checkStatus])

  const update = useCallback(async () => {
    await window.electronAPI.cc.update()
    await checkStatus()
  }, [checkStatus])

  useEffect(() => {
    checkStatus()
  }, [])

  return { ccVersion, ccInstalled, install, update, checkStatus }
}
