import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Track, RepeatMode } from '@/api/types'
import { fetchAuthenticatedAudioUrl } from '@/api/client'
import { logTrackPlayback } from '@/api/playback'

const STORAGE_KEYS = {
  QUEUE: 'player_queue',
  CURRENT_INDEX: 'player_current_index',
  CURRENT_POSITION: 'player_current_position',
  VOLUME: 'player_volume',
  SHUFFLE_MODE: 'player_shuffle',
  REPEAT_MODE: 'player_repeat'
}

const MIN_PLAY_DURATION_TO_LOG = 30 // 30 seconds for proper scrobbling
const SCROBBLE_CHECK_INTERVAL = 1000 // check every second

interface StoredPlayerState {
  queue: Track[]
  currentIndex: number
  currentPosition: number
  volume: number
  shuffleMode: boolean
  repeatMode: RepeatMode
  playbackSource: string
}

interface PlaybackSession {
  trackHash: string
  startTime: number
  lastPosition: number
  accumulatedTime: number
  hasScrobbled: boolean
}

export const usePlayerStore = defineStore('player', () => {
  // Audio element
  let audio: HTMLAudioElement | null = null

  // abort controller for canceling in-progress track loads
  let loadAbortController: AbortController | null = null

  // promise representing the current play() request to prevent race conditions
  let playPromise: Promise<void> | null = null

  // flag to track if desktop media controls are initialized
  let desktopControlsInitialized = false

  // State
  const currentTrack = ref<Track | null>(null)
  const queue = ref<Track[]>([])
  const originalQueue = ref<Track[]>([]) // For restoring after shuffle
  const currentIndex = ref(0)
  const isPlaying = ref(false)
  const currentPosition = ref(0) // ms
  const duration = ref(0) // ms
  const volume = ref(1)
  const isMuted = ref(false)
  const shuffleMode = ref(false)
  const repeatMode = ref<RepeatMode>('off')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // UI State
  const showQueue = ref(false)

  // Playback source tracking for logging (e.g., 'al:albumhash', 'ar:artisthash', 'pl:playlistid')
  const playbackSource = ref<string>('queue')

  // Enhanced playback tracking for proper scrobbling
  let currentSession: PlaybackSession | null = null
  let scrobbleCheckInterval: NodeJS.Timeout | null = null

  // Computed
  const hasNext = computed(() => {
    if (repeatMode.value === 'all') return queue.value.length > 0
    return currentIndex.value < queue.value.length - 1
  })

  const hasPrevious = computed(() => {
    if (repeatMode.value === 'all') return queue.value.length > 0
    return currentIndex.value > 0
  })

  const progress = computed(() => {
    if (duration.value === 0) return 0
    return (currentPosition.value / duration.value) * 100
  })

  const formattedPosition = computed(() => formatTime(currentPosition.value))
  const formattedDuration = computed(() => formatTime(duration.value))

  // Initialize audio
  function initAudio(): void {
    if (audio) return

    audio = new Audio()
    audio.volume = volume.value

    audio.addEventListener('timeupdate', () => {
      currentPosition.value = audio!.currentTime * 1000
      updatePlaybackSession()
    })

    audio.addEventListener('durationchange', () => {
      duration.value = audio!.duration * 1000
    })

    audio.addEventListener('ended', () => {
      handleTrackEnd()
    })

    audio.addEventListener('play', () => {
      isPlaying.value = true
      startPlaybackSession()
      // sync with desktop thumbnail toolbar
      syncDesktopPlaybackState()
    })

    audio.addEventListener('pause', () => {
      isPlaying.value = false
      pausePlaybackSession()
      // sync with desktop thumbnail toolbar
      syncDesktopPlaybackState()
    })

    audio.addEventListener('seeking', () => {
      handleSeek()
    })

    audio.addEventListener('loadstart', () => {
      isLoading.value = true
    })

    audio.addEventListener('canplay', () => {
      isLoading.value = false
    })

    audio.addEventListener('error', () => {
      isLoading.value = false
      error.value = 'Failed to load track'
    })

    // initialize desktop media controls if available (electron)
    initDesktopControls()
  }

  // initialize handlers for desktop media controls (windows thumbnail toolbar)
  function initDesktopControls(): void {
    if (desktopControlsInitialized) return
    if (typeof window === 'undefined' || !window.api) return

    desktopControlsInitialized = true

    // listen for media control events from main process
    window.api.onMediaPlayPause(() => {
      playPause()
    })

    window.api.onMediaNext(() => {
      next()
    })

    window.api.onMediaPrevious(() => {
      previous()
    })
  }

  // sync playback state with desktop thumbnail toolbar
  function syncDesktopPlaybackState(): void {
    if (typeof window === 'undefined' || !window.api) return
    window.api.updatePlaybackState(isPlaying.value)
  }

  // Actions
  async function play(): Promise<void> {
    if (!audio) initAudio()
    if (!audio) return

    try {
      playPromise = audio.play()
      await playPromise
    } catch (err) {
      // ignore AbortError - this happens when play() is interrupted by pause() or load()
      // this is expected behavior when rapidly switching tracks or toggling playback
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      throw err
    } finally {
      playPromise = null
    }
  }

  async function pause(): Promise<void> {
    if (!audio) return

    // wait for any pending play() to settle before pausing to prevent AbortError spam
    if (playPromise) {
      try {
        await playPromise
      } catch {
        // ignore errors from the pending play - we're pausing anyway
      }
      playPromise = null
    }

    audio.pause()
  }

  async function playPause(): Promise<void> {
    if (isPlaying.value) {
      await pause()
    } else {
      await play()
    }
  }

  function seekTo(position: number): void {
    if (audio) {
      audio.currentTime = position / 1000
      currentPosition.value = position
      // seeking interrupts uninterrupted playback
      handleSeek()
    }
  }

  function setVolume(newVolume: number): void {
    volume.value = Math.max(0, Math.min(1, newVolume))
    if (audio) {
      audio.volume = volume.value
    }
    if (volume.value > 0) {
      isMuted.value = false
    }
  }

  function toggleMute(): void {
    isMuted.value = !isMuted.value
    if (audio) {
      audio.muted = isMuted.value
    }
  }

  async function loadTrack(track: Track): Promise<void> {
    if (!audio) initAudio()

    // abort any in-progress track load to prevent stale tracks from loading
    if (loadAbortController) {
      loadAbortController.abort()
    }
    loadAbortController = new AbortController()
    const signal = loadAbortController.signal

    // wait for any pending play() to settle before loading new track
    if (playPromise) {
      try {
        await playPromise
      } catch {
        // ignore errors from the pending play - we're loading a new track anyway
      }
      playPromise = null
    }

    // Pause current playback immediately when loading a new track
    audio?.pause()

    // Reset playhead to zero before loading new track
    currentPosition.value = 0
    duration.value = 0

    currentTrack.value = track
    error.value = null
    isLoading.value = true

    // Reset playback session for new track
    resetPlaybackSession()

    try {
      // Revoke previous blob URL to prevent memory leaks
      if (audio!.src && audio!.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio!.src)
      }

      // Fetch audio with authentication and create blob URL
      const blobUrl = await fetchAuthenticatedAudioUrl(track.trackhash, track.filepath, signal)

      // check if this load was aborted while waiting for fetch
      if (signal.aborted) {
        // clean up the blob url we just created since we're not using it
        URL.revokeObjectURL(blobUrl)
        return
      }

      audio!.src = blobUrl
    } catch (err) {
      // ignore abort errors - these are expected when skipping tracks
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      error.value = 'Failed to load track'
      isLoading.value = false
      throw err
    }

    // Update media session
    updateMediaSession(track)
  }

  async function playTrack(track: Track): Promise<void> {
    await loadTrack(track)
    await play()
  }

  async function setQueue(
    tracks: Track[],
    startIndex: number = 0,
    preserveShuffle: boolean = false,
    source: string = 'queue'
  ): Promise<void> {
    // store the playback source for logging
    playbackSource.value = source
    originalQueue.value = [...tracks]

    // Only shuffle if explicitly preserving shuffle mode (e.g., from shuffle button)
    if (shuffleMode.value && preserveShuffle) {
      queue.value = shuffleArray([...tracks])
      // Find the track at startIndex in original and move to front
      const startTrack = tracks[startIndex]
      const newIndex = queue.value.findIndex((t) => t.trackhash === startTrack.trackhash)
      if (newIndex > 0) {
        queue.value.unshift(queue.value.splice(newIndex, 1)[0])
      }
      currentIndex.value = 0
    } else {
      // Reset shuffle mode when starting a new queue (unless preserveShuffle is true)
      if (!preserveShuffle) {
        shuffleMode.value = false
      }
      queue.value = [...tracks]
      currentIndex.value = startIndex
    }

    if (queue.value.length > 0) {
      await playTrack(queue.value[currentIndex.value])
    }
  }

  function addToQueue(track: Track): void {
    queue.value.push(track)
    originalQueue.value.push(track)
  }

  function playNext(track: Track): void {
    queue.value.splice(currentIndex.value + 1, 0, track)
    originalQueue.value.splice(currentIndex.value + 1, 0, track)
  }

  function removeFromQueue(index: number): void {
    if (index === currentIndex.value) return

    queue.value.splice(index, 1)
    if (index < currentIndex.value) {
      currentIndex.value--
    }
  }

  async function next(): Promise<void> {
    if (queue.value.length === 0) return

    // Finalize current session before skipping
    finalizePlaybackSession()

    if (repeatMode.value === 'one') {
      seekTo(0)
      await play()
      return
    }

    if (currentIndex.value < queue.value.length - 1) {
      currentIndex.value++
    } else if (repeatMode.value === 'all') {
      currentIndex.value = 0
    } else {
      await pause()
      return
    }

    await playTrack(queue.value[currentIndex.value])
  }

  async function previous(): Promise<void> {
    if (queue.value.length === 0) return

    // If more than 3 seconds in, restart current track
    if (currentPosition.value > 3000) {
      seekTo(0)
      return
    }

    // Finalize current session before skipping
    finalizePlaybackSession()

    if (currentIndex.value > 0) {
      currentIndex.value--
    } else if (repeatMode.value === 'all') {
      currentIndex.value = queue.value.length - 1
    } else {
      seekTo(0)
      return
    }

    await playTrack(queue.value[currentIndex.value])
  }

  async function skipTo(index: number): Promise<void> {
    if (index < 0 || index >= queue.value.length) return
    currentIndex.value = index
    await playTrack(queue.value[currentIndex.value])
  }

  function toggleShuffle(): void {
    shuffleMode.value = !shuffleMode.value

    if (shuffleMode.value) {
      const current = queue.value[currentIndex.value]
      const remaining = queue.value.filter((_, i) => i !== currentIndex.value)
      queue.value = [current, ...shuffleArray(remaining)]
      currentIndex.value = 0
    } else {
      // Restore original order
      const current = queue.value[currentIndex.value]
      queue.value = [...originalQueue.value]
      currentIndex.value = queue.value.findIndex((t) => t.trackhash === current.trackhash)
    }
  }

  function cycleRepeatMode(): void {
    const modes: RepeatMode[] = ['off', 'all', 'one']
    const currentModeIndex = modes.indexOf(repeatMode.value)
    repeatMode.value = modes[(currentModeIndex + 1) % modes.length]
  }

  function handleTrackEnd(): void {
    finalizePlaybackSession()
    if (repeatMode.value === 'one') {
      seekTo(0)
      play().catch(() => {
        // ignore errors - play might fail if user navigated away
      })
    } else {
      next()
    }
  }

  // Enhanced scrobbling logic - start new playback session
  function startPlaybackSession(): void {
    if (!currentTrack.value) return

    currentSession = {
      trackHash: currentTrack.value.trackhash,
      startTime: Date.now(),
      lastPosition: audio?.currentTime || 0,
      accumulatedTime: 0,
      hasScrobbled: false
    }

    // start checking for scrobble eligibility
    if (scrobbleCheckInterval) {
      clearInterval(scrobbleCheckInterval)
    }
    scrobbleCheckInterval = setInterval(checkForScrobble, SCROBBLE_CHECK_INTERVAL)
  }

  // pause current session but keep accumulated time
  function pausePlaybackSession(): void {
    if (currentSession && audio) {
      const currentPos = audio.currentTime
      const elapsed = currentPos - currentSession.lastPosition
      if (elapsed > 0) {
        currentSession.accumulatedTime += elapsed
      }
    }

    if (scrobbleCheckInterval) {
      clearInterval(scrobbleCheckInterval)
      scrobbleCheckInterval = null
    }
  }

  // update session during continuous playback
  function updatePlaybackSession(): void {
    if (!currentSession || !audio || !isPlaying.value) return

    const currentPos = audio.currentTime
    const timeDiff = Math.abs(currentPos - currentSession.lastPosition)

    // check if there was a seek (position jumped more than 2 seconds)
    if (timeDiff > 2) {
      handleSeek()
      return
    }

    // normal playback progress
    const elapsed = currentPos - currentSession.lastPosition
    if (elapsed > 0) {
      currentSession.accumulatedTime += elapsed
    }
    currentSession.lastPosition = currentPos
  }

  // handle seeking - reset uninterrupted time
  function handleSeek(): void {
    if (!currentSession || !audio) return

    // reset accumulated time since seek interrupts uninterrupted playback
    currentSession.accumulatedTime = 0
    currentSession.lastPosition = audio.currentTime
    currentSession.hasScrobbled = false
  }

  // check if track should be scrobbled (30 uninterrupted seconds)
  function checkForScrobble(): void {
    if (!currentSession || !currentTrack.value || currentSession.hasScrobbled) return

    if (currentSession.accumulatedTime >= MIN_PLAY_DURATION_TO_LOG) {
      // scrobble the track
      logTrackPlayback(
        currentTrack.value.trackhash,
        MIN_PLAY_DURATION_TO_LOG,
        playbackSource.value
      ).catch((err) => {
        console.warn('Failed to log track playback:', err)
      })

      currentSession.hasScrobbled = true

      // stop checking for this session
      if (scrobbleCheckInterval) {
        clearInterval(scrobbleCheckInterval)
        scrobbleCheckInterval = null
      }
    }
  }

  // finalize session when track changes or ends
  function finalizePlaybackSession(): void {
    if (scrobbleCheckInterval) {
      clearInterval(scrobbleCheckInterval)
      scrobbleCheckInterval = null
    }
    currentSession = null
  }

  // reset session for new track
  function resetPlaybackSession(): void {
    finalizePlaybackSession()
  }

  function clearQueue(): void {
    // abort any in-progress track load
    if (loadAbortController) {
      loadAbortController.abort()
      loadAbortController = null
    }
    finalizePlaybackSession()
    queue.value = []
    originalQueue.value = []
    currentTrack.value = null
    currentIndex.value = 0
    // use synchronous pause here since we're clearing everything
    audio?.pause()
    if (audio) {
      // Revoke blob URL to prevent memory leaks
      if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src)
      }
      audio.src = ''
    }
  }

  function openQueue(): void {
    showQueue.value = true
  }

  function closeQueue(): void {
    showQueue.value = false
  }

  // Helpers
  function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  function updateMediaSession(track: Track): void {
    if ('mediaSession' in navigator) {
      const artists = track.artists || []
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: artists.map((a) => a.name).join(', '),
        album: track.album
        // artwork will be set if we have thumbnail support
      })

      navigator.mediaSession.setActionHandler('play', play)
      navigator.mediaSession.setActionHandler('pause', pause)
      navigator.mediaSession.setActionHandler('previoustrack', previous)
      navigator.mediaSession.setActionHandler('nexttrack', next)
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime) {
          seekTo(details.seekTime * 1000)
        }
      })
    }
  }

  // Cleanup
  function dispose(): void {
    // abort any in-progress track load
    if (loadAbortController) {
      loadAbortController.abort()
      loadAbortController = null
    }
    finalizePlaybackSession()
    if (audio) {
      audio.pause()
      // Revoke blob URL to prevent memory leaks
      if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src)
      }
      audio.src = ''
      audio = null
    }
  }

  // Persistence functions
  function saveState(): void {
    try {
      const state: StoredPlayerState = {
        queue: queue.value,
        currentIndex: currentIndex.value,
        currentPosition: currentPosition.value,
        volume: volume.value,
        shuffleMode: shuffleMode.value,
        repeatMode: repeatMode.value,
        playbackSource: playbackSource.value
      }
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(state))
    } catch (err) {
      console.warn('Failed to save player state:', err)
    }
  }

  function loadState(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.QUEUE)
      if (!stored) return

      const state: StoredPlayerState = JSON.parse(stored)
      queue.value = state.queue || []
      originalQueue.value = [...queue.value]
      currentIndex.value = state.currentIndex || 0
      volume.value = state.volume ?? 1
      shuffleMode.value = state.shuffleMode || false
      repeatMode.value = state.repeatMode || 'off'
      playbackSource.value = state.playbackSource || 'queue'

      // Restore current track without auto-playing
      if (queue.value.length > 0 && currentIndex.value < queue.value.length) {
        currentTrack.value = queue.value[currentIndex.value]
        // Store position but don't seek until user plays
      }
    } catch (err) {
      console.warn('Failed to load player state:', err)
    }
  }

  function restorePlayback(): void {
    if (currentTrack.value && !audio?.src) {
      loadTrack(currentTrack.value)
      // Don't auto-play, just load it
    }
  }

  // Watch for changes to persist state
  watch(
    [queue, currentIndex, volume, shuffleMode, repeatMode, playbackSource],
    () => {
      saveState()
    },
    { deep: true }
  )

  return {
    // State
    currentTrack,
    queue,
    currentIndex,
    isPlaying,
    currentPosition,
    duration,
    volume,
    isMuted,
    shuffleMode,
    repeatMode,
    isLoading,
    error,
    showQueue,
    playbackSource,
    // Computed
    hasNext,
    hasPrevious,
    progress,
    formattedPosition,
    formattedDuration,
    // Actions
    initAudio,
    play,
    pause,
    playPause,
    seekTo,
    setVolume,
    toggleMute,
    loadTrack,
    playTrack,
    setQueue,
    addToQueue,
    playNext,
    removeFromQueue,
    next,
    previous,
    skipTo,
    toggleShuffle,
    cycleRepeatMode,
    clearQueue,
    openQueue,
    closeQueue,
    dispose,
    loadState,
    restorePlayback
  }
})
