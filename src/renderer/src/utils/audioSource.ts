// dual audio source for gapless playback
// uses two audio elements to preload and switch between tracks seamlessly

export interface AudioSourceSettings {
  volume: number
  muted: boolean
  crossfadeDuration: number
  useCrossfade: boolean
}

export class AudioSource {
  private sources: HTMLAudioElement[] = []
  private playingSourceIndex: number = 0
  private settings: AudioSourceSettings = {
    volume: 1,
    muted: false,
    crossfadeDuration: 0,
    useCrossfade: false
  }

  constructor() {
    this.sources = [new Audio(), new Audio()]
  }

  get standbySource(): HTMLAudioElement {
    return this.sources[1 - this.playingSourceIndex]
  }

  get playingSource(): HTMLAudioElement {
    return this.sources[this.playingSourceIndex]
  }

  updateSettings(settings: Partial<AudioSourceSettings>): void {
    this.settings = { ...this.settings, ...settings }
    this.sources.forEach((audio) => {
      audio.muted = this.settings.muted
      audio.volume = this.settings.volume
    })
  }

  // preload the next track into the standby audio element
  preloadWithBlobUrl(blobUrl: string): HTMLAudioElement {
    const audio = this.standbySource
    audio.src = blobUrl
    audio.muted = this.settings.muted
    audio.volume = this.settings.volume
    audio.load()
    return audio
  }

  // switch sources with optional crossfade
  switchSources(): void {
    const oldSource = this.playingSource

    if (this.settings.useCrossfade && this.settings.crossfadeDuration > 0) {
      // fade out the old source
      this.fadeOut(oldSource, this.settings.crossfadeDuration)
    } else {
      oldSource.pause()
    }

    // switch to the standby source
    this.playingSourceIndex = 1 - this.playingSourceIndex

    // fade in the new source if crossfade is enabled
    if (this.settings.useCrossfade && this.settings.crossfadeDuration > 0) {
      this.fadeIn(this.playingSource, this.settings.crossfadeDuration)
    }
  }

  // fade out an audio element
  private fadeOut(audio: HTMLAudioElement, duration: number): void {
    const startVolume = audio.volume
    const steps = 20
    const stepDuration = duration / steps
    const volumeStep = startVolume / steps
    let currentStep = 0

    const fadeInterval = setInterval(() => {
      currentStep++
      audio.volume = Math.max(0, startVolume - volumeStep * currentStep)

      if (currentStep >= steps) {
        clearInterval(fadeInterval)
        audio.pause()
        audio.volume = startVolume
        // revoke the blob url to free memory
        if (audio.src && audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src)
        }
        audio.src = ''
      }
    }, stepDuration)
  }

  // fade in an audio element
  private fadeIn(audio: HTMLAudioElement, duration: number): void {
    const targetVolume = this.settings.volume
    audio.volume = 0

    const steps = 20
    const stepDuration = duration / steps
    const volumeStep = targetVolume / steps
    let currentStep = 0

    const fadeInterval = setInterval(() => {
      currentStep++
      audio.volume = Math.min(targetVolume, volumeStep * currentStep)

      if (currentStep >= steps) {
        clearInterval(fadeInterval)
        audio.volume = targetVolume
      }
    }, stepDuration)
  }

  pausePlayingSource(): void {
    this.playingSource.pause()
  }

  async playPlayingSource(): Promise<void> {
    await this.playingSource.play()
  }

  // clean up standby source
  clearStandbySource(): void {
    const standby = this.standbySource
    if (standby.src && standby.src.startsWith('blob:')) {
      URL.revokeObjectURL(standby.src)
    }
    standby.src = ''
    standby.oncanplay = null
  }

  // full cleanup
  dispose(): void {
    this.sources.forEach((audio) => {
      audio.pause()
      if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src)
      }
      audio.src = ''
      audio.oncanplay = null
      audio.onerror = null
      audio.onended = null
      audio.onplay = null
      audio.onpause = null
      audio.ontimeupdate = null
      audio.ondurationchange = null
    })
  }
}
