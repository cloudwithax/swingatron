import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// custom apis for renderer
const api = {
  // window control methods
  minimizeWindow: (): void => ipcRenderer.send('window-minimize'),
  maximizeWindow: (): void => ipcRenderer.send('window-maximize'),
  closeWindow: (): void => ipcRenderer.send('window-close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window-is-maximized'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void): void => {
    ipcRenderer.on('window-maximized-changed', (_event, isMaximized) => callback(isMaximized))
  },
  // media control methods for windows thumbnail toolbar
  updatePlaybackState: (isPlaying: boolean): void => {
    ipcRenderer.send('media-playback-state-changed', isPlaying)
  },
  onMediaPlayPause: (callback: () => void): void => {
    ipcRenderer.on('media-play-pause', () => callback())
  },
  onMediaNext: (callback: () => void): void => {
    ipcRenderer.on('media-next', () => callback())
  },
  onMediaPrevious: (callback: () => void): void => {
    ipcRenderer.on('media-previous', () => callback())
  },
  // discord rpc methods
  updateDiscordPresence: (data: {
    trackTitle: string
    artist: string
    album: string
    duration: number
    position: number
    isPaused: boolean
    artworkUrl?: string
    imageHash?: string
  }): void => {
    ipcRenderer.send('discord-rpc-update', data)
  },
  setDiscordIdle: (): void => {
    ipcRenderer.send('discord-rpc-idle')
  },
  clearDiscordPresence: (): void => {
    ipcRenderer.send('discord-rpc-clear')
  },
  // session management
  clearSessionCookies: (): Promise<boolean> => ipcRenderer.invoke('clear-session-cookies')
}

// use `contextBridge` apis to expose electron apis to
// renderer only if context isolation is enabled, otherwise
// just add to the dom global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch {
    // failed to expose api to main world
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
