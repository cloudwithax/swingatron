import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Track, RepeatMode } from '@/api/types'
import { fetchAuthenticatedAudioUrl, getThumbnailUrl } from '@/api/client'
import { logTrackPlayback } from '@/api/playback'
import { toggleFavorite } from '@/api/favorites'
import { AudioSource } from '@/utils/audioSource'

const STORAGE_KEYS = {
  QUEUE: 'player_queue',
  CURRENT_INDEX: 'player_current_index',
  CURRENT_POSITION: 'player_current_position',
  VOLUME: 'player_volume',
  SHUFFLE_MODE: 'player_shuffle',
  REPEAT_MODE: 'player_repeat',
  GAPLESS_PLAYBACK: 'player_gapless'
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
  // track hash of the track that is currently being loaded (set immediately on click)
  // this allows the ui to show loading state before the async loadtrack function runs
  const pendingTrackHash = ref<string | null>(null)
  const error = ref<string | null>(null)

  // UI State
  const showQueue = ref(false)

  // Watchers
  watch(isPlaying, (playing) => {
    if (playing) {
      pendingTrackHash.value = null
      isLoading.value = false
    }
  })

  // Playback source tracking for logging (e.g., 'al:albumhash', 'ar:artisthash', 'pl:playlistid')
  const playbackSource = ref<string>('queue')

  // Enhanced playback tracking for proper scrobbling
  let currentSession: PlaybackSession | null = null
  let scrobbleCheckInterval: NodeJS.Timeout | null = null

  // gapless playback - enabled by default, loaded from storage
  const gaplessPlayback = ref(localStorage.getItem(STORAGE_KEYS.GAPLESS_PLAYBACK) !== 'false')

  // dual audio source for gapless playback
  let audioSource: AudioSource | null = null

  // preloaded next track data
  interface PreloadedTrackData {
    trackhash: string
    blobUrl: string
    audio: HTMLAudioElement
    loaded: boolean
  }
  let preloadedNext: PreloadedTrackData | null = null
  let preloadAbortController: AbortController | null = null
  let transitionTimer: NodeJS.Timeout | null = null

  // keep references to the initial audio element listeners so we can detach them later
  interface InitialAudioListeners {
    timeupdate: () => void
    durationchange: () => void
    loadeddata: () => void
    ended: () => void
    play: () => void
    pause: () => void
    seeking: () => void
    loadstart: () => void
    canplay: () => void
    error: () => void
  }

  let initialAudio: HTMLAudioElement | null = null
  let initialAudioListeners: InitialAudioListeners | null = null

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

    initialAudio = audio
    initialAudioListeners = {
      timeupdate: () => {
        currentPosition.value = audio!.currentTime * 1000
        updatePlaybackSession()
        updateMediaSessionPositionState()
        // check if we should preload next track for gapless playback
        checkForGaplessPreload()
      },
      durationchange: () => {
        duration.value = audio!.duration * 1000
        updateMediaSessionPositionState()
      },
      loadeddata: () => {
        isLoading.value = false
      },
      ended: () => {
        handleTrackEnd()
      },
      play: () => {
        isPlaying.value = true
        startPlaybackSession()
        // sync with desktop thumbnail toolbar
        syncDesktopPlaybackState()
        updateMediaSessionPlaybackState()
        // update discord presence
        syncDiscordPresence()
        // check for preload immediately on play
        checkForGaplessPreload()
      },
      pause: () => {
        isPlaying.value = false
        pausePlaybackSession()
        // sync with desktop thumbnail toolbar
        syncDesktopPlaybackState()
        updateMediaSessionPlaybackState()
        // update discord presence
        syncDiscordPresence()
        // clear any pending gapless transition
        clearGaplessTransitionTimer()
      },
      seeking: () => {
        handleSeek()
        updateMediaSessionPositionState()
        // clear any pending gapless transition (will be rescheduled by timeupdate)
        clearGaplessTransitionTimer()
      },
      loadstart: () => {
        isLoading.value = true
      },
      canplay: () => {
        isLoading.value = false
        // check for preload as soon as we can play
        checkForGaplessPreload()
      },
      error: () => {
        isLoading.value = false
        error.value = 'Failed to load track'
      }
    }

    audio.addEventListener('timeupdate', initialAudioListeners.timeupdate)
    audio.addEventListener('durationchange', initialAudioListeners.durationchange)
    audio.addEventListener('loadeddata', initialAudioListeners.loadeddata)
    audio.addEventListener('ended', initialAudioListeners.ended)
    audio.addEventListener('play', initialAudioListeners.play)
    audio.addEventListener('pause', initialAudioListeners.pause)
    audio.addEventListener('seeking', initialAudioListeners.seeking)
    audio.addEventListener('loadstart', initialAudioListeners.loadstart)
    audio.addEventListener('canplay', initialAudioListeners.canplay)
    audio.addEventListener('error', initialAudioListeners.error)

    // initialize desktop media controls if available (electron)
    initDesktopControls()
  }

  // ... (existing code)

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

  // sync discord rich presence
  function syncDiscordPresence(): void {
    if (typeof window === 'undefined' || !window.api) return

    if (!currentTrack.value) {
      window.api.setDiscordIdle()
      return
    }

    const artists = currentTrack.value.artists || []
    const artistName = artists.map((a) => a.name).join(', ') || 'Unknown Artist'

    // get the full artwork url for discord rpc
    const artworkUrl = currentTrack.value.image
      ? getThumbnailUrl(currentTrack.value.image, 'large')
      : undefined

    // use the image hash for caching in litterbox
    const imageHash = currentTrack.value.image || undefined

    window.api.updateDiscordPresence({
      trackTitle: currentTrack.value.title,
      artist: artistName,
      album: currentTrack.value.album || 'Unknown Album',
      duration: duration.value / 1000, // convert to seconds
      position: currentPosition.value / 1000, // convert to seconds
      isPaused: !isPlaying.value,
      artworkUrl,
      imageHash
    })
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
      updateMediaSessionPositionState()
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

    // clear any pending gapless preload since we're manually changing tracks
    clearGaplessPreload()

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

    // set pending track hash immediately for ui feedback
    pendingTrackHash.value = track.trackhash
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
        isLoading.value = false
        pendingTrackHash.value = null
        return
      }

      audio!.src = blobUrl
    } catch (err) {
      // ignore abort errors - these are expected when skipping tracks
      if (err instanceof Error && err.name === 'AbortError') {
        pendingTrackHash.value = null
        return
      }
      error.value = 'Failed to load track'
      isLoading.value = false
      pendingTrackHash.value = null
      throw err
    }

    // Update media session
    updateMediaSession(track)

    // Update discord presence
    syncDiscordPresence()
  }

  async function playTrack(track: Track): Promise<void> {
    await loadTrack(track)
    try {
      await play()
    } finally {
      // defensive: ensure pending/loading cleared even if play rejects
      pendingTrackHash.value = null
      isLoading.value = false
    }
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

    // clear any scheduled gapless transition since seek changes timing
    clearGaplessTransitionTimer()

    // if we seek near the end or beginning, the preload may need to be rescheduled
    // checkForGaplessPreload will handle this on next timeupdate
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
      ).catch(() => {})

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

  // gapless playback functions

  // get the next track in the queue (for preloading)
  function getNextTrack(): Track | null {
    if (queue.value.length === 0) return null

    // if repeat one, next track is the same track
    if (repeatMode.value === 'one') return null // no need to preload same track

    // if last track and repeat all, next is first
    if (currentIndex.value >= queue.value.length - 1) {
      if (repeatMode.value === 'all') {
        return queue.value[0]
      }
      return null // no next track
    }

    return queue.value[currentIndex.value + 1]
  }

  // check if we should preload the next track (called on timeupdate)
  function checkForGaplessPreload(): void {
    if (!gaplessPlayback.value || !audio) return

    if (!isPlaying.value && audio.paused) return

    const trackDuration = audio.duration
    const currentTime = audio.currentTime

    if (Number.isNaN(trackDuration)) return

    const nextTrack = getNextTrack()
    if (!nextTrack) return

    // if we already have this track preloaded or preloading, handle transition scheduling
    if (preloadedNext && preloadedNext.trackhash === nextTrack.trackhash) {
      // if loaded and no transition timer, schedule it regardless of time remaining
      // this ensures we always schedule when ready, even if preload completed early
      if (preloadedNext.loaded && !transitionTimer) {
        scheduleGaplessTransition()
      }
      // if still loading, do nothing and wait for oncanplay to call us again
      return
    }

    // if we have a different track preloaded, clear it
    if (preloadedNext && preloadedNext.trackhash !== nextTrack.trackhash) {
      clearGaplessPreload()
    }

    // only start preloading when we're within a reasonable window
    // this prevents preloading too early and wasting resources
    const timeRemaining = trackDuration - currentTime
    if (timeRemaining > 30) return

    // start preloading the next track
    preloadNextTrack(nextTrack)
  }

  // preload the next track into a standby audio element
  async function preloadNextTrack(track: Track): Promise<void> {
    // prevent starting a new preload if one is already in progress for this track
    if (preloadedNext && preloadedNext.trackhash === track.trackhash) {
      return
    }

    // init audio source if needed
    if (!audioSource) {
      audioSource = new AudioSource()
      audioSource.updateSettings({
        volume: volume.value,
        muted: isMuted.value,
        crossfadeDuration: 0,
        useCrossfade: false
      })
    }

    preloadAbortController = new AbortController()
    const signal = preloadAbortController.signal

    // mark as preloading immediately to prevent duplicate requests
    preloadedNext = {
      trackhash: track.trackhash,
      blobUrl: '',
      audio: audioSource.standbySource,
      loaded: false
    }

    try {
      const blobUrl = await fetchAuthenticatedAudioUrl(track.trackhash, track.filepath, signal)

      if (signal.aborted) {
        URL.revokeObjectURL(blobUrl)
        return
      }

      const preloadedAudio = audioSource.preloadWithBlobUrl(blobUrl)

      // update with actual blob url
      if (preloadedNext && preloadedNext.trackhash === track.trackhash) {
        preloadedNext.blobUrl = blobUrl
        preloadedNext.audio = preloadedAudio
      } else {
        // track changed while we were loading, clean up
        URL.revokeObjectURL(blobUrl)
        return
      }

      // wait for the audio to be ready to play
      preloadedAudio.oncanplay = () => {
        if (preloadedNext && preloadedNext.trackhash === track.trackhash) {
          preloadedNext.loaded = true
          // schedule transition now that it's ready
          checkForGaplessPreload()
        }
      }

      preloadedAudio.onerror = () => {
        // preload failed, clear and let normal playback handle it
        if (preloadedNext && preloadedNext.trackhash === track.trackhash) {
          clearGaplessPreload()
        }
      }
    } catch {
      // preload failed, clear only if this is still the track we're preloading
      if (preloadedNext && preloadedNext.trackhash === track.trackhash) {
        clearGaplessPreload()
      }
    }
  }

  // schedule the gapless transition right before the current track ends
  function scheduleGaplessTransition(): void {
    if (!audio || !preloadedNext?.loaded) return

    // if timer already exists, don't reschedule
    if (transitionTimer) return

    const trackDuration = audio.duration
    const currentTime = audio.currentTime

    // safety check for invalid values
    if (Number.isNaN(trackDuration) || Number.isNaN(currentTime)) return

    const timeRemaining = (trackDuration - currentTime) * 1000 // in ms

    // if we're already past the end somehow, transition immediately
    if (timeRemaining <= 0) {
      performGaplessTransition()
      return
    }

    // transition 100ms before track ends for truly gapless playback
    const transitionTime = Math.max(0, timeRemaining - 100)

    transitionTimer = setTimeout(() => {
      performGaplessTransition()
    }, transitionTime)
  }

  // perform the actual gapless transition
  function performGaplessTransition(): void {
    if (!preloadedNext?.loaded || !audioSource) {
      clearGaplessTransitionTimer()
      return
    }

    const nextTrack = getNextTrack()
    if (!nextTrack || nextTrack.trackhash !== preloadedNext.trackhash) {
      clearGaplessPreload()
      return
    }

    // Capture the old audio element before we switch references
    const oldAudio = audio

    // finalize current session
    finalizePlaybackSession()

    // remove event listeners from the old audio to prevent handleTrackEnd from firing
    // when the old track finishes playing out its last ~100ms
    if (oldAudio) {
      // detach the initial addEventListener handlers if this was the first audio element
      if (initialAudio && oldAudio === initialAudio && initialAudioListeners) {
        oldAudio.removeEventListener('timeupdate', initialAudioListeners.timeupdate)
        oldAudio.removeEventListener('durationchange', initialAudioListeners.durationchange)
        oldAudio.removeEventListener('ended', initialAudioListeners.ended)
        oldAudio.removeEventListener('play', initialAudioListeners.play)
        oldAudio.removeEventListener('pause', initialAudioListeners.pause)
        oldAudio.removeEventListener('seeking', initialAudioListeners.seeking)
        oldAudio.removeEventListener('loadstart', initialAudioListeners.loadstart)
        oldAudio.removeEventListener('canplay', initialAudioListeners.canplay)
        oldAudio.removeEventListener('error', initialAudioListeners.error)
        initialAudio = null
        initialAudioListeners = null
      }

      oldAudio.onended = null
      oldAudio.ontimeupdate = null
      oldAudio.onpause = null
      oldAudio.onplay = null
      oldAudio.ondurationchange = null
      oldAudio.onseeking = null
    }

    // switch audio sources
    audioSource.switchSources()

    // update the main audio reference
    audio = audioSource.playingSource

    // new track is already loaded via preload, ensure loading state is cleared
    isLoading.value = false
    pendingTrackHash.value = null

    // update player state
    const nextIndex =
      repeatMode.value === 'all' && currentIndex.value >= queue.value.length - 1
        ? 0
        : currentIndex.value + 1

    currentIndex.value = nextIndex
    currentTrack.value = nextTrack
    currentPosition.value = 0
    duration.value = audio.duration * 1000

    // reassign event listeners to new audio element
    assignAudioEventListeners(audio)

    // play the preloaded audio
    audio.play().catch(() => {
      // ignore play errors during gapless transition
    })

    // Handle initialization transition: If the old audio was NOT managed by AudioSource
    // (i.e. it was the initial standalone Audio element), clean up its src after a delay
    if (
      oldAudio &&
      oldAudio !== audioSource.playingSource &&
      oldAudio !== audioSource.standbySource
    ) {
      // let it play out the remaining ~100ms for a smooth transition
      setTimeout(() => {
        oldAudio.pause()
        if (oldAudio.src && oldAudio.src.startsWith('blob:')) {
          URL.revokeObjectURL(oldAudio.src)
        }
        oldAudio.src = ''
      }, 2000)
    }

    // update media session
    updateMediaSession(nextTrack)
    syncDiscordPresence()

    // clear preloaded data
    preloadedNext = null
    transitionTimer = null
  }

  // clear any preloaded data
  function clearGaplessPreload(): void {
    if (preloadAbortController) {
      preloadAbortController.abort()
      preloadAbortController = null
    }

    if (preloadedNext) {
      // revoke blob url
      if (preloadedNext.blobUrl) {
        URL.revokeObjectURL(preloadedNext.blobUrl)
      }
      preloadedNext = null
    }

    if (audioSource) {
      audioSource.clearStandbySource()
    }

    clearGaplessTransitionTimer()
  }

  // clear transition timer
  function clearGaplessTransitionTimer(): void {
    if (transitionTimer) {
      clearTimeout(transitionTimer)
      transitionTimer = null
    }
  }

  // assign event listeners to an audio element
  function assignAudioEventListeners(audioEl: HTMLAudioElement): void {
    audioEl.ontimeupdate = () => {
      currentPosition.value = audioEl.currentTime * 1000
      updatePlaybackSession()
      updateMediaSessionPositionState()
      checkForGaplessPreload()
    }

    audioEl.ondurationchange = () => {
      duration.value = audioEl.duration * 1000
      updateMediaSessionPositionState()
    }

    audioEl.onloadstart = () => {
      isLoading.value = true
    }

    audioEl.onloadeddata = () => {
      isLoading.value = false
      pendingTrackHash.value = null
    }

    audioEl.onloadedmetadata = () => {
      // some browsers fire loadedmetadata instead of loadeddata first
      pendingTrackHash.value = null
    }

    audioEl.oncanplay = () => {
      isLoading.value = false
      pendingTrackHash.value = null
      checkForGaplessPreload()
    }

    audioEl.onerror = () => {
      isLoading.value = false
      pendingTrackHash.value = null
      error.value = 'Failed to load track'
    }

    audioEl.onended = () => {
      handleTrackEnd()
    }

    audioEl.onplay = () => {
      isPlaying.value = true
      pendingTrackHash.value = null
      startPlaybackSession()
      syncDesktopPlaybackState()
      updateMediaSessionPlaybackState()
      syncDiscordPresence()
      checkForGaplessPreload()
    }

    audioEl.onplaying = () => {
      // defensive: ensure pending is cleared when playback actually starts
      pendingTrackHash.value = null
      isLoading.value = false
    }

    audioEl.onpause = () => {
      isPlaying.value = false
      pausePlaybackSession()
      syncDesktopPlaybackState()
      updateMediaSessionPlaybackState()
      syncDiscordPresence()
      clearGaplessTransitionTimer()
    }

    audioEl.onseeking = () => {
      handleSeek()
      updateMediaSessionPositionState()
      clearGaplessTransitionTimer()
    }
  }

  // toggle gapless playback setting
  function toggleGaplessPlayback(): void {
    gaplessPlayback.value = !gaplessPlayback.value
    localStorage.setItem(STORAGE_KEYS.GAPLESS_PLAYBACK, String(gaplessPlayback.value))

    if (!gaplessPlayback.value) {
      // clear any preloaded data when disabling
      clearGaplessPreload()
    }
  }

  // set gapless playback setting explicitly
  function setGaplessPlayback(enabled: boolean): void {
    gaplessPlayback.value = enabled
    localStorage.setItem(STORAGE_KEYS.GAPLESS_PLAYBACK, String(enabled))

    if (!enabled) {
      clearGaplessPreload()
    }
  }

  function clearQueue(): void {
    // abort any in-progress track load
    if (loadAbortController) {
      loadAbortController.abort()
      loadAbortController = null
    }
    finalizePlaybackSession()
    // clear gapless playback preload
    clearGaplessPreload()
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
    updateMediaSession(null)
    updateMediaSessionPlaybackState()
    // clear discord presence
    if (typeof window !== 'undefined' && window.api) {
      window.api.setDiscordIdle()
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

  function updateMediaSession(track: Track | null): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return

    if (track) {
      const artists = track.artists || []
      const artwork: MediaImage[] = []

      if (track.image) {
        artwork.push(
          { src: getThumbnailUrl(track.image, 'small'), sizes: '96x96' },
          { src: getThumbnailUrl(track.image, 'medium'), sizes: '256x256' },
          { src: getThumbnailUrl(track.image, 'large'), sizes: '512x512' }
        )
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: artists.map((a) => a.name).join(', '),
        album: track.album,
        artwork
      })
    } else {
      navigator.mediaSession.metadata = null
    }

    navigator.mediaSession.setActionHandler('play', play)
    navigator.mediaSession.setActionHandler('pause', pause)
    navigator.mediaSession.setActionHandler('previoustrack', previous)
    navigator.mediaSession.setActionHandler('nexttrack', next)
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        seekTo(details.seekTime * 1000)
      }
    })

    updateMediaSessionPlaybackState()
  }

  function updateMediaSessionPlaybackState(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return

    if (!currentTrack.value) {
      navigator.mediaSession.playbackState = 'none'
      return
    }

    navigator.mediaSession.playbackState = isPlaying.value ? 'playing' : 'paused'
    updateMediaSessionPositionState()
  }

  function updateMediaSessionPositionState(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    if (typeof navigator.mediaSession.setPositionState !== 'function') return
    if (!audio) return

    const rawDuration = audio.duration
    if (!Number.isFinite(rawDuration) || rawDuration <= 0) return

    const rawPosition = audio.currentTime
    const clampedPosition = Number.isFinite(rawPosition)
      ? Math.max(0, Math.min(rawDuration, rawPosition))
      : 0

    navigator.mediaSession.setPositionState({
      duration: rawDuration,
      position: clampedPosition,
      playbackRate: audio.playbackRate || 1
    })
  }

  // Cleanup
  function dispose(): void {
    // abort any in-progress track load
    if (loadAbortController) {
      loadAbortController.abort()
      loadAbortController = null
    }
    finalizePlaybackSession()
    // clear gapless playback resources
    clearGaplessPreload()
    if (audioSource) {
      audioSource.dispose()
      audioSource = null
    }
    if (audio) {
      audio.pause()
      // Revoke blob URL to prevent memory leaks
      if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src)
      }
      audio.src = ''
      audio = null
    }
    updateMediaSession(null)
    updateMediaSessionPlaybackState()
  }

  function reset(): void {
    clearQueue()
    dispose()
    currentPosition.value = 0
    duration.value = 0
    volume.value = 1
    isMuted.value = false
    shuffleMode.value = false
    repeatMode.value = 'off'
    isPlaying.value = false
    isLoading.value = false
    error.value = null
    playbackSource.value = 'queue'
    showQueue.value = false
    currentIndex.value = 0
    localStorage.removeItem(STORAGE_KEYS.QUEUE)
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
    } catch {
      // failed to save player state
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
    } catch {
      // failed to load player state
    }
  }

  function restorePlayback(): void {
    if (currentTrack.value && !audio?.src) {
      loadTrack(currentTrack.value)
      // Don't auto-play, just load it
    }
  }

  // toggle favorite status for the current track
  async function toggleCurrentTrackFavorite(): Promise<void> {
    if (!currentTrack.value) return

    try {
      const newStatus = await toggleFavorite(
        currentTrack.value.trackhash,
        'track',
        !currentTrack.value.is_favorite
      )

      const trackhash = currentTrack.value.trackhash

      // update current track
      currentTrack.value = { ...currentTrack.value, is_favorite: newStatus }

      // update the track in the queue as well
      const trackIndex = queue.value.findIndex((t) => t.trackhash === trackhash)
      if (trackIndex !== -1) {
        queue.value[trackIndex] = { ...queue.value[trackIndex], is_favorite: newStatus }
      }

      // update in original queue if shuffled
      if (shuffleMode.value) {
        const originalIndex = originalQueue.value.findIndex((t) => t.trackhash === trackhash)
        if (originalIndex !== -1) {
          originalQueue.value[originalIndex] = {
            ...originalQueue.value[originalIndex],
            is_favorite: newStatus
          }
        }
      }

      // broadcast the favorite change to other stores so they stay in sync
      broadcastFavoriteChange(trackhash, newStatus)
    } catch {
      // failed to toggle favorite
    }
  }

  // broadcast favorite status change to all relevant stores
  async function broadcastFavoriteChange(trackhash: string, isFavorite: boolean): Promise<void> {
    // dynamic import stores to avoid circular dependencies
    const [
      { useAlbumStore },
      { usePlaylistStore },
      { useFavoritesStore },
      { useSearchStore },
      { useFolderStore }
    ] = await Promise.all([
      import('./albums'),
      import('./playlists'),
      import('./favorites'),
      import('./search'),
      import('./folders')
    ])

    // update each store that may have this track
    try {
      const albumStore = useAlbumStore()
      albumStore.updateTrackFavorite(trackhash, isFavorite)
    } catch {
      // store may not be initialized yet
    }

    try {
      const playlistStore = usePlaylistStore()
      playlistStore.updateTrackFavorite(trackhash, isFavorite)
    } catch {
      // store may not be initialized yet
    }

    try {
      const favoritesStore = useFavoritesStore()
      favoritesStore.updateTrackFavorite(trackhash, isFavorite)
    } catch {
      // store may not be initialized yet
    }

    try {
      const searchStore = useSearchStore()
      searchStore.updateTrackFavorite({ trackhash } as Track, isFavorite)
    } catch {
      // store may not be initialized yet
    }

    try {
      const foldersStore = useFolderStore()
      foldersStore.updateTrackFavorite({ trackhash } as Track, isFavorite)
    } catch {
      // store may not be initialized yet
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
    pendingTrackHash,
    error,
    showQueue,
    playbackSource,
    gaplessPlayback,
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
    reset,
    loadState,
    restorePlayback,
    toggleCurrentTrackFavorite,
    toggleGaplessPlayback,
    setGaplessPlayback
  }
})
