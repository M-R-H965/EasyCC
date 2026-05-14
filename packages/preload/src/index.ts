import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  profile: {
    list: () => ipcRenderer.invoke('profile:list'),
    get: (id: string) => ipcRenderer.invoke('profile:get', id),
    getDefault: () => ipcRenderer.invoke('profile:getDefault'),
    create: (data: unknown) => ipcRenderer.invoke('profile:create', data),
    update: (id: string, patch: unknown) => ipcRenderer.invoke('profile:update', id, patch),
    delete: (id: string) => ipcRenderer.invoke('profile:delete', id),
    setDefault: (id: string) => ipcRenderer.invoke('profile:setDefault', id),
    testConnection: (id: string) => ipcRenderer.invoke('profile:testConnection', id),
  },

  conversation: {
    create: (options: unknown) => ipcRenderer.invoke('conversation:create', options),
    send: (sessionId: string, message: string) => ipcRenderer.invoke('conversation:send', sessionId, message),
    stop: (sessionId: string) => ipcRenderer.invoke('conversation:stop', sessionId),
  },

  flow: {
    listAvailable: () => ipcRenderer.invoke('flow:listAvailable'),
    get: (id: string) => ipcRenderer.invoke('flow:get', id),
    enable: (id: string) => ipcRenderer.invoke('flow:enable', id),
    disable: (id: string) => ipcRenderer.invoke('flow:disable', id),
    getByGroup: (group: string) => ipcRenderer.invoke('flow:getByGroup', group),
  },

  cc: {
    getVersion: () => ipcRenderer.invoke('cc:getVersion'),
    isInstalled: () => ipcRenderer.invoke('cc:isInstalled'),
    install: () => ipcRenderer.invoke('cc:install'),
    update: () => ipcRenderer.invoke('cc:update'),
  },

  memory: {
    read: () => ipcRenderer.invoke('memory:read'),
    append: (section: string, content: string) => ipcRenderer.invoke('memory:append', section, content),
    compress: () => ipcRenderer.invoke('memory:compress'),
  },

  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
  },

  convstore: {
    saveAll: (conversations: unknown[]) => ipcRenderer.invoke('convstore:saveAll', conversations),
    loadAll: (flowDirs: string[]) => ipcRenderer.invoke('convstore:loadAll', flowDirs),
  },

  events: {
    onChatStream: (callback: (payload: unknown) => void) => {
      ipcRenderer.on('core:chat:stream', (_, payload) => callback(payload))
    },
    onChatThinking: (callback: (payload: unknown) => void) => {
      ipcRenderer.on('core:chat:thinking', (_, payload) => callback(payload))
    },
    onChatToolUse: (callback: (payload: unknown) => void) => {
      ipcRenderer.on('core:chat:tool_use', (_, payload) => callback(payload))
    },
    onChatDone: (callback: (payload: unknown) => void) => {
      ipcRenderer.on('core:chat:done', (_, payload) => callback(payload))
    },
    onChatError: (callback: (payload: unknown) => void) => {
      ipcRenderer.on('core:chat:error', (_, payload) => callback(payload))
    },
    onSessionInit: (callback: (payload: unknown) => void) => {
      ipcRenderer.on('core:session:init', (_, payload) => callback(payload))
    },
    onSessionExit: (callback: (payload: unknown) => void) => {
      ipcRenderer.on('core:session:exit', (_, payload) => callback(payload))
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
