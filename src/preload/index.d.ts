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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: WindowAPI
  }
}
