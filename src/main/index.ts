import { app, shell, BrowserWindow, ipcMain, nativeImage, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { discordRPC } from './discord-rpc'

// thumbnail toolbar icons for windows taskbar controls
import playIcon from '../../resources/icons/play.png?asset'
import pauseIcon from '../../resources/icons/pause.png?asset'
import nextIcon from '../../resources/icons/next.png?asset'
import previousIcon from '../../resources/icons/previous.png?asset'

// track playback state for thumbnail toolbar
let isPlaying = false

function createWindow(): void {
  // create the browser window with frameless style for custom titlebar
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hidden',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false // allow cross-origin requests to local servers
    }
  })

  // ipc handlers for window controls
  ipcMain.on('window-minimize', () => {
    mainWindow.minimize()
  })

  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcMain.on('window-close', () => {
    mainWindow.close()
  })

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow.isMaximized()
  })

  // ipc handlers for media controls from renderer
  ipcMain.on('media-playback-state-changed', (_event, playing: boolean) => {
    isPlaying = playing
    if (process.platform === 'win32') {
      updateThumbnailToolbar(mainWindow, isPlaying)
    }
  })

  // discord rpc handlers
  ipcMain.on(
    'discord-rpc-update',
    (
      _event,
      data: {
        trackTitle: string
        artist: string
        album: string
        duration: number
        position: number
        isPaused: boolean
        artworkUrl?: string
        imageHash?: string
      }
    ) => {
      discordRPC.setPlayingPresence(
        data.trackTitle,
        data.artist,
        data.album,
        data.duration,
        data.position,
        data.isPaused,
        data.artworkUrl,
        data.imageHash
      )
    }
  )

  ipcMain.on('discord-rpc-idle', () => {
    discordRPC.setIdlePresence()
  })

  ipcMain.on('discord-rpc-clear', () => {
    discordRPC.clearPresence()
  })

  // clear all session cookies - used when authentication fails
  ipcMain.handle('clear-session-cookies', async () => {
    try {
      const cookies = await session.defaultSession.cookies.get({})
      for (const cookie of cookies) {
        // build the url for the cookie
        const protocol = cookie.secure ? 'https' : 'http'
        const url = `${protocol}://${cookie.domain?.replace(/^\./, '')}${cookie.path || '/'}`
        await session.defaultSession.cookies.remove(url, cookie.name)
      }
      return true
    } catch {
      return false
    }
  })

  // notify renderer when window maximize state changes
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized-changed', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized-changed', false)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // set up initial thumbnail toolbar on windows
    if (process.platform === 'win32') {
      updateThumbnailToolbar(mainWindow, false)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => {})

  // initialize discord rpc
  discordRPC.connect().catch(() => {})

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  await discordRPC.disconnect()
})

// windows thumbnail toolbar management
function updateThumbnailToolbar(window: BrowserWindow, playing: boolean): void {
  if (process.platform !== 'win32') return

  const prevImage = nativeImage.createFromPath(previousIcon)
  const playImage = nativeImage.createFromPath(playIcon)
  const pauseImage = nativeImage.createFromPath(pauseIcon)
  const nextImage = nativeImage.createFromPath(nextIcon)

  window.setThumbarButtons([
    {
      tooltip: 'Previous',
      icon: prevImage,
      click: (): void => {
        window.webContents.send('media-previous')
      }
    },
    {
      tooltip: playing ? 'Pause' : 'Play',
      icon: playing ? pauseImage : playImage,
      click: (): void => {
        window.webContents.send('media-play-pause')
      }
    },
    {
      tooltip: 'Next',
      icon: nextImage,
      click: (): void => {
        window.webContents.send('media-next')
      }
    }
  ])
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
