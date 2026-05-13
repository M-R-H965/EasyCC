import { useState, useCallback } from 'react'

export function useMemory() {
  const [content, setContent] = useState('')

  const load = useCallback(async () => {
    const text = await window.electronAPI.memory.read()
    setContent(text)
  }, [])

  const append = useCallback(async (section: string, entry: string) => {
    await window.electronAPI.memory.append(section, entry)
    await load()
  }, [load])

  const compress = useCallback(async () => {
    await window.electronAPI.memory.compress()
    await load()
  }, [load])

  return { content, load, append, compress }
}
