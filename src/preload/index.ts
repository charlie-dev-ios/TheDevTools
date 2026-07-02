import { contextBridge, ipcRenderer } from 'electron'

export interface Snippet {
  id: string
  title: string
  content: string
}

const api = {
  getHistory: (): Promise<string[]> => ipcRenderer.invoke('history:get'),
  clearHistory: (): Promise<string[]> => ipcRenderer.invoke('history:clear'),
  removeHistory: (text: string): Promise<string[]> =>
    ipcRenderer.invoke('history:remove', text),
  getSnippets: (): Promise<Snippet[]> => ipcRenderer.invoke('snippets:get'),
  saveSnippets: (snippets: Snippet[]): Promise<Snippet[]> =>
    ipcRenderer.invoke('snippets:save', snippets),
  // Insert text into the app that was focused before the panel opened.
  paste: (text: string): Promise<void> => ipcRenderer.invoke('paste', text),
  hide: (): Promise<void> => ipcRenderer.invoke('window:hide'),
  onHistoryUpdate: (callback: (history: string[]) => void): (() => void) => {
    const listener = (_event: unknown, history: string[]): void => callback(history)
    ipcRenderer.on('history:update', listener)
    return () => ipcRenderer.removeListener('history:update', listener)
  },
  onWindowShown: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('window:shown', listener)
    return () => ipcRenderer.removeListener('window:shown', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
