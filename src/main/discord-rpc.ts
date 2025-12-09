import { AutoClient } from 'discord-auto-rpc'

const CLIENT_ID = '1447450941019127860'

interface ActivityCache {
  type?: number
  details: string
  state: string
  largeImageKey: string
  largeImageText: string
  smallImageKey: string
  smallImageText: string
  startTimestamp?: number
  endTimestamp?: number
  instance: boolean
}

class DiscordRPCService {
  private client: AutoClient | null = null
  private ready: boolean = false
  private activityCache: ActivityCache = {
    details: '',
    state: '',
    largeImageKey: 'swingatron_logo',
    largeImageText: '',
    smallImageKey: '',
    smallImageText: '',
    instance: false
  }

  async connect(): Promise<void> {
    // create the client
    this.client = new AutoClient({ transport: 'ipc' })

    // runs on ready
    this.client.once('ready', () => {
      this.ready = true

      // restore activity cache if we have one
      if (this.activityCache.details && this.activityCache.state) {
        this.client?.setActivity(this.activityCache)
      }
    })

    // login to discord with endless retry
    try {
      await this.client.endlessLogin({ clientId: CLIENT_ID })
    } catch {
      // failed to start endless login
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) return

    try {
      this.client.destroy()
      this.client = null
      this.ready = false
    } catch {
      // error during disconnect
    }
  }

  async setPlayingPresence(
    trackTitle: string,
    artist: string,
    album: string,
    duration: number,
    position: number,
    isPaused: boolean,
    artworkUrl?: string,
    imageHash?: string
  ): Promise<void> {
    if (!this.client) {
      return
    }

    // truncate strings if too long (discord limit is 128 chars)
    const truncate = (str: string, max: number): string => {
      if (!str) return str
      return str.length > max ? str.substring(0, max - 3) + '...' : str
    }

    // start with default logo
    let largeImageKey = 'swingatron_logo'

    // try to upload artwork to litterbox if we have a local url
    if (artworkUrl && imageHash) {
      try {
        const { uploadImageToLitterbox } = await import('./litterbox')
        const publicUrl = await uploadImageToLitterbox(artworkUrl, imageHash)
        if (publicUrl) {
          largeImageKey = publicUrl
        }
      } catch {
        // failed to upload artwork
      }
    }

    const activity: ActivityCache = {
      type: 2, // 2 = listening
      details: truncate(trackTitle, 128),
      state: truncate(`by ${artist}`, 128),
      largeImageKey: largeImageKey,
      largeImageText: truncate(album || 'Swingatron', 128),
      smallImageKey: isPaused ? 'pause' : 'play',
      smallImageText: isPaused ? 'Paused' : 'Playing',
      instance: false
    }

    // add timestamps only when playing
    if (!isPaused && duration > 0) {
      const now = Date.now()
      const elapsedMs = position * 1000
      const remainingMs = (duration - position) * 1000

      activity.startTimestamp = now - elapsedMs
      activity.endTimestamp = now + remainingMs
    }

    if (!this.ready) {
      this.activityCache = activity
      return
    }

    try {
      this.client.setActivity(activity)
      this.activityCache = activity
    } catch {
      // failed to set activity
    }
  }

  setIdlePresence(): void {
    if (!this.client) return

    const activity: ActivityCache = {
      type: 2, // 2 = listening
      details: 'Idle',
      state: 'Not playing anything',
      largeImageKey: 'swingatron_logo',
      largeImageText: 'Swingatron',
      smallImageKey: '',
      smallImageText: '',
      instance: false
    }

    if (!this.ready) {
      this.activityCache = activity
      return
    }

    try {
      this.client.setActivity(activity)
      this.activityCache = activity
    } catch {
      // failed to set idle presence
    }
  }

  clearPresence(): void {
    if (!this.client || !this.ready) return

    try {
      this.client.clearActivity()
    } catch {
      // failed to clear activity
    }
  }
}

export const discordRPC = new DiscordRPCService()
