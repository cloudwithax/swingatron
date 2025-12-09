import { ElectronAPI } from '@electron-toolkit/preload'

interface WindowAPI {
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => void
  // media control methods for windows thumbnail toolbar
  updatePlaybackState: (isPlaying: boolean) => void
  onMediaPlayPause: (callback: () => void) => void
  onMediaNext: (callback: () => void) => void
  onMediaPrevious: (callback: () => void) => void
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
  }) => void
  setDiscordIdle: () => void
  clearDiscordPresence: () => void
  // session management
  clearSessionCookies: () => Promise<boolean>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: WindowAPI
  }
}
