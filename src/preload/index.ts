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
  copy: (text: string): Promise<void> => ipcRenderer.invoke('clipboard:copy', text),
  onHistoryUpdate: (callback: (history: string[]) => void): (() => void) => {
    const listener = (_event: unknown, history: string[]): void => callback(history)
    ipcRenderer.on('history:update', listener)
    return () => ipcRenderer.removeListener('history:update', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
