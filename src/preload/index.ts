import { contextBridge, ipcRenderer } from 'electron'

export interface Snippet {
  id: string
  title: string
  content: string
}

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: string
  end: string
}

const api = {
  getHistory: (): Promise<string[]> => ipcRenderer.invoke('history:get'),
  clearHistory: (): Promise<string[]> => ipcRenderer.invoke('history:clear'),
  removeHistory: (text: string): Promise<string[]> =>
    ipcRenderer.invoke('history:remove', text),
  getSnippets: (): Promise<Snippet[]> => ipcRenderer.invoke('snippets:get'),
  saveSnippets: (snippets: Snippet[]): Promise<Snippet[]> =>
    ipcRenderer.invoke('snippets:save', snippets),
  getEvents: (): Promise<CalendarEvent[]> => ipcRenderer.invoke('events:get'),
  saveEvents: (events: CalendarEvent[]): Promise<CalendarEvent[]> =>
    ipcRenderer.invoke('events:save', events),
  // Copy without moving focus (used by the main window).
  copy: (text: string): Promise<void> => ipcRenderer.invoke('clipboard:copy', text),
  // Insert text into the app that was focused before the launcher opened.
  paste: (text: string): Promise<void> => ipcRenderer.invoke('paste', text),
  hide: (): Promise<void> => ipcRenderer.invoke('window:hide'),
  openMain: (): Promise<void> => ipcRenderer.invoke('window:open-main'),
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
