<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getThumbnailUrl } from '@/api/client'
import { usePlayerStore } from '@/stores/player'
import LyricsView from '@/components/LyricsView.vue'
import QueuePanel from '@/components/QueuePanel.vue'
import type { Track } from '@/api/types'

interface CoverFlowItem {
  track: Track
  index: number
  offset: number // relative position from current (-3, -2, -1, 0, 1, 2, 3)
}

const router = useRouter()
const playerStore = usePlayerStore()

// debounce for next/previous buttons to prevent loading tracks the user is skipping past
const SKIP_DEBOUNCE_MS = 300
let skipTimeout: ReturnType<typeof setTimeout> | null = null
let pendingSkipDirection: 'next' | 'previous' | null = null

function debouncedNext() {
  pendingSkipDirection = 'next'
  if (skipTimeout) clearTimeout(skipTimeout)
  skipTimeout = setTimeout(() => {
    if (pendingSkipDirection === 'next') {
      playerStore.next()
    }
    pendingSkipDirection = null
    skipTimeout = null
  }, SKIP_DEBOUNCE_MS)
}

function debouncedPrevious() {
  pendingSkipDirection = 'previous'
  if (skipTimeout) clearTimeout(skipTimeout)
  skipTimeout = setTimeout(() => {
    if (pendingSkipDirection === 'previous') {
      playerStore.previous()
    }
    pendingSkipDirection = null
    skipTimeout = null
  }, SKIP_DEBOUNCE_MS)
}

// ui state
const showLyrics = ref(false)
const showQueue = ref(false)
const isFullscreen = ref(false)
const iscoverFlowMode = ref(false)

// mode transition animation state
const isTransitioning = ref(false)
const transitionDirection = ref<'to-coverflow' | 'to-artwork' | null>(null)

// track fullscreen state
function updateFullscreenState() {
  isFullscreen.value = !!document.fullscreenElement
}

// if no track is playing, redirect to home
onMounted(() => {
  if (!playerStore.currentTrack) {
    router.replace('/')
  }

  // listen for fullscreen changes
  document.addEventListener('fullscreenchange', updateFullscreenState)
  updateFullscreenState()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', updateFullscreenState)
  document.removeEventListener('keydown', handleKeyDown)
  // clean up cover flow drag listeners if component unmounts during drag
  document.removeEventListener('mousemove', handleCoverFlowMouseMove)
  document.removeEventListener('mouseup', handleCoverFlowMouseUp)
  // reset cover flow drag state
  isDraggingCoverFlow.value = false
  coverFlowDragOffset.value = 0
  hasDragged.value = false
  if (skipTimeout) clearTimeout(skipTimeout)
})

const thumbnailUrl = computed(() => {
  return playerStore.currentTrack?.image
    ? getThumbnailUrl(playerStore.currentTrack.image, 'large')
    : ''
})

const artists = computed(() => {
  const track = playerStore.currentTrack
  if (!track) return []
  return track.artists || []
})

// cover flow tracks - get all tracks in queue with their offset from current
const coverFlowTracks = computed((): CoverFlowItem[] => {
  const queue = playerStore.queue
  const currentIndex = playerStore.currentIndex

  if (queue.length === 0) return []

  const tracks: CoverFlowItem[] = []

  // include all tracks in the queue
  for (let index = 0; index < queue.length; index++) {
    const offset = index - currentIndex
    tracks.push({
      track: queue[index],
      index,
      offset
    })
  }

  return tracks
})

// the track that appears in the center during drag (for preview)
const previewTrack = computed(() => {
  if (!isDraggingCoverFlow.value) {
    return playerStore.currentTrack
  }

  // calculate which track is closest to center based on drag offset
  const previewIndex = Math.round(playerStore.currentIndex + coverFlowDragOffset.value)
  const clampedIndex = Math.max(0, Math.min(playerStore.queue.length - 1, previewIndex))
  return playerStore.queue[clampedIndex] || playerStore.currentTrack
})

function goToAlbum(): void {
  const track = playerStore.currentTrack
  if (track?.albumhash) {
    router.push(`/album/${track.albumhash}`)
  }
}

function goToArtist(artisthash: string): void {
  router.push(`/artist/${artisthash}`)
}

function goBack(): void {
  // dismiss lyrics view first if it's open
  if (showLyrics.value) {
    showLyrics.value = false
  } else {
    // exit fullscreen if currently in fullscreen mode
    exitFullscreen()
    router.back()
  }
}

async function exitFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }
  } catch {
    // failed to exit fullscreen
  }
}

// seek functionality
const isDragging = ref(false)
const dragProgress = ref(0)
const progressBarRef = ref<HTMLElement | null>(null)

function handleProgressClick(event: MouseEvent): void {
  const bar = event.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const percent = (event.clientX - rect.left) / rect.width
  const position = percent * playerStore.duration
  playerStore.seekTo(position)
}

function handleProgressMouseDown(event: MouseEvent): void {
  isDragging.value = true
  updateDragProgress(event)
  document.addEventListener('mousemove', handleProgressMouseMove)
  document.addEventListener('mouseup', handleProgressMouseUp)
}

function handleProgressMouseMove(event: MouseEvent): void {
  if (!isDragging.value) return
  updateDragProgress(event)
}

function handleProgressMouseUp(event: MouseEvent): void {
  if (!isDragging.value) return
  updateDragProgress(event)
  const position = (dragProgress.value / 100) * playerStore.duration
  playerStore.seekTo(position)
  isDragging.value = false
  document.removeEventListener('mousemove', handleProgressMouseMove)
  document.removeEventListener('mouseup', handleProgressMouseUp)
}

function updateDragProgress(event: MouseEvent): void {
  if (!progressBarRef.value) return
  const rect = progressBarRef.value.getBoundingClientRect()
  const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))
  dragProgress.value = percent
}

const displayProgress = computed(() => {
  return isDragging.value ? dragProgress.value : playerStore.progress
})

// volume control
function handleVolumeChange(event: Event): void {
  const target = event.target as HTMLInputElement
  playerStore.setVolume(parseFloat(target.value))
}

// cover flow navigation
function navigateToCoverFlowTrack(trackIndex: number): void {
  // prevent navigation if user just finished dragging
  if (hasDragged.value) return

  if (trackIndex !== playerStore.currentIndex) {
    playerStore.skipTo(trackIndex)
  }
}

// check if an item is effectively current during drag
function isEffectivelyCurrent(offset: number): boolean {
  const effectiveOffset = isDraggingCoverFlow.value ? offset - coverFlowDragOffset.value : offset
  return Math.abs(effectiveOffset) < 0.5 // consider current if within 0.5 offset
}

// cover flow drag-to-select functionality
const isDraggingCoverFlow = ref(false)
const coverFlowDragStartX = ref(0)
const coverFlowDragCurrentX = ref(0)
const coverFlowDragOffset = ref(0) // continuous offset for smooth animation
const coverFlowSensitivity = 0.8 // how sensitive the drag is (lower = more sensitive)
const hasDragged = ref(false) // flag to prevent clicks after dragging

function handleCoverFlowMouseDown(event: MouseEvent): void {
  // only start drag on left mouse button
  if (event.button !== 0) return
  // prevent click events from firing on individual items during drag
  event.preventDefault()

  isDraggingCoverFlow.value = true
  hasDragged.value = false
  coverFlowDragStartX.value = event.clientX
  coverFlowDragCurrentX.value = event.clientX
  coverFlowDragOffset.value = 0

  document.addEventListener('mousemove', handleCoverFlowMouseMove)
  document.addEventListener('mouseup', handleCoverFlowMouseUp)
}

function handleCoverFlowMouseMove(event: MouseEvent): void {
  if (!isDraggingCoverFlow.value) return

  const deltaX = Math.abs(event.clientX - coverFlowDragStartX.value)
  // consider it a drag if moved more than 5 pixels
  if (deltaX > 5) {
    hasDragged.value = true
  }

  coverFlowDragCurrentX.value = event.clientX
  const deltaXSigned = coverFlowDragStartX.value - event.clientX
  // convert pixels to track offset (negative deltaX = drag right = go to previous tracks)
  coverFlowDragOffset.value = (deltaXSigned * coverFlowSensitivity) / 140 // 140px per track spacing
}

function handleCoverFlowMouseUp(): void {
  if (!isDraggingCoverFlow.value) return

  // snap to the nearest track based on the final offset
  const trackDelta = Math.round(coverFlowDragOffset.value)

  if (trackDelta !== 0) {
    const newIndex = Math.max(
      0,
      Math.min(playerStore.queue.length - 1, playerStore.currentIndex + trackDelta)
    )

    if (newIndex !== playerStore.currentIndex) {
      playerStore.skipTo(newIndex)
    }
  }

  // reset drag state
  isDraggingCoverFlow.value = false
  coverFlowDragOffset.value = 0
  document.removeEventListener('mousemove', handleCoverFlowMouseMove)
  document.removeEventListener('mouseup', handleCoverFlowMouseUp)

  // reset the drag flag after a short delay to prevent accidental clicks
  setTimeout(() => {
    hasDragged.value = false
  }, 100)
}

// calculate the 3d transform style for each cover flow item based on its offset from center
// apple's cover flow has side items stacked tightly together in a continuous row
function getCoverFlowItemStyle(offset: number): Record<string, string> {
  // apply drag offset to create smooth animation during drag
  const effectiveOffset = isDraggingCoverFlow.value ? offset - coverFlowDragOffset.value : offset
  const absOffset = Math.abs(effectiveOffset)

  // add staggered animation delay for entrance animation
  const animationDelay = `${0.15 + Math.abs(offset) * 0.06}s`

  // smooth size scaling based on distance from center
  // center item scale = 1.3 (260px), side items scale = 1.0 (200px)
  const maxScale = 1.3
  const minScale = 1.0
  const scale = Math.max(minScale, maxScale - absOffset * 0.3)

  // smooth box shadow based on distance from center
  const shadowStrength = Math.max(0, 1 - absOffset)
  const blur1 = 2 + shadowStrength * 2
  const blur2 = 8 + shadowStrength * 8
  const blur3 = 24 + shadowStrength * 24
  const boxShadow = `0 ${blur1}px ${blur2}px rgba(0, 0, 0, ${0.3 + shadowStrength * 0.1}), 0 ${blur2}px ${blur3}px rgba(0, 0, 0, ${0.4 + shadowStrength * 0.1})`

  // all calculations are continuous - no special cases for center
  const direction = effectiveOffset > 0 ? -1 : 1

  // rotation smoothly transitions to 0 at center, max 65deg at offset >= 1
  const rotateY = absOffset < 0.01 ? 0 : direction * Math.min(65, absOffset * 65)

  // horizontal position is continuous
  const translateX = effectiveOffset * 140

  // z position: 0 at center, pushed back for side items
  // use smooth interpolation instead of hard offset
  const translateZ = -absOffset * 180

  // opacity fades slightly for items further away
  const opacity = Math.max(0.3, 1 - absOffset * 0.2)

  // z-index ensures proper stacking - items closer to center are on top
  const zIndex = 10 - Math.floor(absOffset)

  return {
    transform: `rotateY(${rotateY}deg) translateX(${translateX}px) translateZ(${translateZ}px) scale(${scale})`,
    zIndex: String(zIndex),
    opacity: String(opacity),
    '--target-opacity': String(opacity),
    '--box-shadow': boxShadow,
    animationDelay
  } as Record<string, string>
}

async function toggleCoverFlowMode(): Promise<void> {
  if (isTransitioning.value) return

  isTransitioning.value = true
  transitionDirection.value = iscoverFlowMode.value ? 'to-artwork' : 'to-coverflow'

  // small delay to let the exit animation start
  await nextTick()

  // toggle the mode
  iscoverFlowMode.value = !iscoverFlowMode.value

  // wait for vue to render the new view, then trigger entrance animation
  await nextTick()

  // allow entrance animations to complete
  setTimeout(() => {
    isTransitioning.value = false
    transitionDirection.value = null
  }, 600)
}

// keyboard shortcuts
function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    goBack()
  } else if (event.key === ' ') {
    event.preventDefault()
    playerStore.playPause()
  } else if (event.key === 'ArrowLeft') {
    if (iscoverFlowMode.value) {
      debouncedPrevious()
    } else {
      playerStore.seekTo(Math.max(0, playerStore.currentPosition - 10000))
    }
  } else if (event.key === 'ArrowRight') {
    if (iscoverFlowMode.value) {
      debouncedNext()
    } else {
      playerStore.seekTo(Math.min(playerStore.duration, playerStore.currentPosition + 10000))
    }
  } else if (event.key === 'c' || event.key === 'C') {
    toggleCoverFlowMode()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div v-if="playerStore.currentTrack" class="now-playing-view">
    <!-- background blur effect -->
    <div class="background-blur">
      <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="" />
    </div>

    <!-- close button -->
    <button class="close-btn" title="Close (Esc)" @click="goBack">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        />
      </svg>
    </button>

    <!-- main content -->
    <div class="content">
      <!-- artwork or cover flow -->
      <div
        v-if="!iscoverFlowMode"
        class="artwork-section"
        :class="{
          entering: isTransitioning && transitionDirection === 'to-artwork',
          exiting: isTransitioning && transitionDirection === 'to-coverflow'
        }"
      >
        <div class="artwork-container" @click="goToAlbum">
          <img
            v-if="thumbnailUrl"
            :src="thumbnailUrl"
            :alt="playerStore.currentTrack.title"
            class="artwork"
          />
          <div v-else class="artwork-placeholder">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
              />
            </svg>
          </div>
        </div>
      </div>

      <!-- cover flow -->
      <div
        v-else
        class="cover-flow-section"
        :class="{
          entering: isTransitioning && transitionDirection === 'to-coverflow',
          exiting: isTransitioning && transitionDirection === 'to-artwork'
        }"
      >
        <div class="cover-flow-container">
          <div
            class="cover-flow-stage"
            :class="{ 'is-dragging': isDraggingCoverFlow }"
            @mousedown="handleCoverFlowMouseDown"
          >
            <div
              v-for="item in coverFlowTracks"
              :key="item.track.trackhash"
              class="cover-flow-item"
              :class="{ 'is-current': isEffectivelyCurrent(item.offset) }"
              :style="getCoverFlowItemStyle(item.offset)"
              @click="navigateToCoverFlowTrack(item.index)"
            >
              <div class="cover-flow-artwork">
                <img
                  v-if="item.track.image"
                  :src="getThumbnailUrl(item.track.image, 'large')"
                  :alt="item.track.title"
                  class="artwork"
                />
                <div v-else class="artwork-placeholder">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                    />
                  </svg>
                </div>
              </div>
              <!-- reflection effect -->
              <div class="cover-flow-reflection">
                <img
                  v-if="item.track.image"
                  :src="getThumbnailUrl(item.track.image, 'large')"
                  :alt="''"
                  class="artwork"
                />
                <div v-else class="artwork-placeholder">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- track info for cover flow mode -->
        <div class="cover-flow-info">
          <div class="cover-flow-title">{{ previewTrack?.title }}</div>
          <div class="cover-flow-artist">
            {{ previewTrack?.artists?.map((a) => a.name).join(', ') || 'Unknown Artist' }}
          </div>
          <div class="cover-flow-album">{{ previewTrack?.album }}</div>
        </div>
        <div class="cover-flow-nav">
          <button class="nav-btn" :disabled="!playerStore.hasPrevious" @click="debouncedPrevious">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>
          <button class="nav-btn" :disabled="!playerStore.hasNext" @click="debouncedNext">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- track info and controls -->
      <div class="info-section">
        <div v-if="!iscoverFlowMode" class="track-info">
          <h1 class="track-title" @click="goToAlbum">
            {{ playerStore.currentTrack.title }}
          </h1>
          <div class="track-artists">
            <template v-for="(artist, index) in artists" :key="artist.artisthash">
              <span class="artist-link" @click="goToArtist(artist.artisthash)">
                {{ artist.name }}
              </span>
              <span v-if="index < artists.length - 1" class="artist-separator">, </span>
            </template>
            <span v-if="artists.length === 0" class="artist-link">Unknown Artist</span>
          </div>
          <div class="track-album" @click="goToAlbum">
            {{ playerStore.currentTrack.album }}
          </div>
        </div>

        <!-- progress bar -->
        <div class="progress-section">
          <div
            ref="progressBarRef"
            class="progress-bar-container"
            @click.stop="handleProgressClick"
            @mousedown.stop="handleProgressMouseDown"
          >
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: `${displayProgress}%` }"></div>
              <div class="progress-head" :style="{ left: `${displayProgress}%` }"></div>
            </div>
          </div>
          <div class="time-labels">
            <span class="time-label">{{ playerStore.formattedPosition }}</span>
            <span class="time-label">{{ playerStore.formattedDuration }}</span>
          </div>
        </div>

        <!-- playback controls -->
        <div class="playback-controls">
          <button
            class="control-btn secondary"
            :class="{ active: playerStore.shuffleMode }"
            title="Shuffle"
            @click="playerStore.toggleShuffle"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"
              />
            </svg>
          </button>
          <button class="control-btn secondary" title="Previous" @click="debouncedPrevious">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
          <button
            class="control-btn play-btn"
            :disabled="playerStore.isLoading"
            title="Play/Pause"
            @click="playerStore.playPause"
          >
            <svg
              v-if="playerStore.isLoading"
              class="loading-spinner"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke-width="3"
                stroke-linecap="round"
                stroke-dasharray="31.4 31.4"
              />
            </svg>
            <svg v-else-if="playerStore.isPlaying" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <button class="control-btn secondary" title="Next" @click="debouncedNext">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
          <button
            class="control-btn secondary"
            :class="{ active: playerStore.repeatMode !== 'off' }"
            title="Repeat"
            @click="playerStore.cycleRepeatMode"
          >
            <svg v-if="playerStore.repeatMode === 'one'" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"
              />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
            </svg>
          </button>
        </div>

        <!-- extra controls -->
        <div class="extra-controls">
          <button
            class="control-btn secondary"
            :class="{ active: iscoverFlowMode }"
            title="Cover Flow (C)"
            @click="toggleCoverFlowMode"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"
              />
            </svg>
          </button>
          <button
            class="control-btn secondary"
            :class="{ active: showQueue }"
            title="Queue"
            @click="showQueue = !showQueue"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"
              />
            </svg>
          </button>
          <button
            class="control-btn secondary"
            :class="{ active: showLyrics }"
            title="Lyrics"
            @click="showLyrics = !showLyrics"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 8h12v2H6V8zm0 4h8v2H6v-2z"
              />
            </svg>
          </button>

          <div class="volume-control">
            <button class="control-btn secondary" title="Volume" @click="playerStore.toggleMute">
              <svg
                v-if="playerStore.isMuted || playerStore.volume === 0"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"
                />
              </svg>
              <svg v-else-if="playerStore.volume < 0.5" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"
                />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
                />
              </svg>
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="playerStore.volume"
              class="volume-slider"
              :style="{
                background: `linear-gradient(to right, var(--color-on-surface) 0%, var(--color-on-surface) ${playerStore.volume * 100}%, var(--color-surface-variant) ${playerStore.volume * 100}%, var(--color-surface-variant) 100%)`
              }"
              @input="handleVolumeChange"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- queue panel -->
    <QueuePanel v-if="showQueue" :fullscreen="true" @close="showQueue = false" />

    <!-- lyrics view overlay -->
    <LyricsView v-if="showLyrics" :fullscreen="true" @close="showLyrics = false" />
  </div>

  <div v-else class="now-playing-empty">
    <p>No track playing</p>
    <button @click="goBack">Go Back</button>
  </div>
</template>

<style scoped>
.now-playing-view {
  position: fixed;
  inset: 0;
  background-color: var(--color-background);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* blurred background */
.background-blur {
  position: absolute;
  inset: -50px;
  z-index: 0;
  overflow: hidden;
}

.background-blur img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(60px) brightness(0.4);
  transform: scale(1.2);
}

.background-blur::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.7));
}

/* close button */
.close-btn {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 10;
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.4);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-on-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.6);
}

.close-btn svg {
  width: 24px;
  height: 24px;
}

/* main content */
.content {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  gap: 32px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

/* artwork */
.artwork-section {
  flex-shrink: 0;
  perspective: 800px;
  transform-style: preserve-3d;
}

/* mode transition animations for artwork section */
.artwork-section.entering {
  animation: artwork-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.artwork-section.exiting {
  animation: artwork-exit 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes artwork-enter {
  0% {
    opacity: 0;
    transform: scale(0.6) rotateY(0deg) translateZ(-100px);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotateY(0deg) translateZ(0);
  }
}

@keyframes artwork-exit {
  0% {
    opacity: 1;
    transform: scale(1) translateZ(0);
  }
  100% {
    opacity: 0;
    transform: scale(0.85) translateZ(-50px);
  }
}

.artwork-container {
  width: 300px;
  height: 300px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  cursor: pointer;
  transition: transform 0.2s ease;
  transform-style: preserve-3d;
}

.artwork-container:hover {
  transform: scale(1.02);
}

.artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artwork-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface-variant);
}

.artwork-placeholder svg {
  width: 40%;
  height: 40%;
}

/* Cover Flow Styles - Apple-style implementation */
.cover-flow-section {
  flex-shrink: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding-bottom: 20px;
}

/* mode transition animations for cover flow section */
.cover-flow-section.entering {
  animation: coverflow-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.cover-flow-section.entering .cover-flow-item {
  animation: coverflow-item-enter 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) both;
  animation-delay: inherit;
}

/* side items start hidden and fade in to their target opacity */
.cover-flow-section.entering .cover-flow-item:not(.is-current) {
  animation-name: side-item-enter;
  animation-duration: 0.35s;
  animation-fill-mode: both;
}

.cover-flow-section.entering .cover-flow-info {
  animation: coverflow-info-enter 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) 0.2s forwards;
  opacity: 0;
}

.cover-flow-section.entering .cover-flow-nav {
  animation: coverflow-nav-enter 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) 0.3s forwards;
  opacity: 0;
}

.cover-flow-section.exiting {
  animation: coverflow-exit 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes coverflow-enter {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes coverflow-item-enter {
  0% {
    opacity: 0;
  }
  100% {
    opacity: var(--target-opacity, 1);
  }
}

@keyframes side-item-enter {
  0% {
    visibility: hidden;
    opacity: 0;
  }
  1% {
    visibility: visible;
    opacity: 0;
  }
  100% {
    visibility: visible;
    opacity: var(--target-opacity, 0.7);
  }
}

@keyframes coverflow-info-enter {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes coverflow-nav-enter {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes coverflow-exit {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.95);
  }
}

.cover-flow-container {
  width: 100%;
  height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.cover-flow-stage {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 800px;
  transform-style: preserve-3d;
  cursor: grab;
  user-select: none;
}

.cover-flow-stage.is-dragging {
  cursor: grabbing;
}

.cover-flow-stage.is-dragging .cover-flow-item {
  /* no transition during drag for immediate responsiveness */
  transition: none !important;
}

/* special entrance animation for center item - it grows from the artwork position */
.cover-flow-section.entering .cover-flow-item.is-current {
  animation: center-item-enter 0.45s cubic-bezier(0.25, 0.1, 0.25, 1) both;
}

@keyframes center-item-enter {
  0% {
    transform: rotateY(0deg) translateX(0) translateZ(-50px) scale(1.15);
    opacity: 0.8;
  }
  100% {
    transform: rotateY(0deg) translateX(0) translateZ(0) scale(1.3);
    opacity: 1;
  }
}

.cover-flow-item {
  position: absolute;
  cursor: pointer;
  transition: all 0.5s cubic-bezier(0.25, 0.1, 0.25, 1);
  transform-style: preserve-3d;
  will-change: transform, opacity;
}

/* faster transition when finishing drag */
.cover-flow-stage:not(.is-dragging) .cover-flow-item {
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.cover-flow-item:hover:not(.is-current) {
  opacity: 0.9 !important;
}

.cover-flow-artwork {
  width: 200px;
  height: 200px;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--color-surface-variant);
  box-shadow: var(--box-shadow, 0 2px 8px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.4));
  backface-visibility: hidden;
}

.cover-flow-artwork img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  backface-visibility: hidden;
}

.cover-flow-artwork .artwork-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
}

/* reflection effect - the classic apple coverflow look */
.cover-flow-reflection {
  position: absolute;
  top: 100%;
  left: 0;
  width: 200px;
  height: 200px;
  border-radius: 4px;
  overflow: hidden;
  transform: scaleY(-1);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, transparent 50%);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, transparent 50%);
  pointer-events: none;
  margin-top: 2px;
}

/* remove size scaling for reflection - now handled by parent transform */

.cover-flow-reflection img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(1px);
}

.cover-flow-reflection .artwork-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
}

/* track info displayed below the carousel */
.cover-flow-info {
  text-align: center;
  padding: 0 16px;
  max-width: 80%;
}

.cover-flow-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin-bottom: 6px;
}

.cover-flow-artist {
  font-size: 15px;
  color: var(--color-on-surface-variant);
}

.cover-flow-album {
  font-size: 13px;
  color: var(--color-on-surface-variant);
  opacity: 0.7;
  margin-top: 2px;
}

.cover-flow-nav {
  display: flex;
  gap: 24px;
  align-items: center;
  margin-top: 8px;
}

.nav-btn {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-on-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-btn svg {
  width: 24px;
  height: 24px;
}

/* track info */
.info-section {
  width: 100%;
  text-align: center;
}

.track-info {
  margin-bottom: 24px;
}

.track-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0 0 8px 0;
  cursor: pointer;
}

.track-title:hover {
  text-decoration: underline;
}

.track-artists {
  font-size: 18px;
  color: var(--color-on-surface-variant);
  margin-bottom: 4px;
}

.artist-link {
  cursor: pointer;
}

.artist-link:hover {
  color: var(--color-on-surface);
  text-decoration: underline;
}

.artist-separator {
  color: var(--color-on-surface-variant);
}

.track-album {
  font-size: 14px;
  color: var(--color-on-surface-variant);
  opacity: 0.8;
  cursor: pointer;
}

.track-album:hover {
  text-decoration: underline;
}

/* progress bar */
.progress-section {
  margin-bottom: 24px;
}

.progress-bar-container {
  height: 8px;
  cursor: pointer;
  padding: 8px 0;
}

.progress-track {
  position: relative;
  height: 4px;
  background-color: var(--color-surface-variant);
  border-radius: 2px;
}

.progress-fill {
  position: absolute;
  height: 100%;
  background-color: var(--color-on-surface);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.progress-head {
  position: absolute;
  width: 12px;
  height: 12px;
  background-color: var(--color-on-surface);
  border-radius: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.progress-bar-container:hover .progress-head {
  opacity: 1;
}

.time-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}

.time-label {
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

/* playback controls */
.playback-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 24px;
}

.control-btn {
  width: 40px;
  height: 40px;
  padding: 8px;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-on-surface);
  transition:
    background-color 0.15s ease,
    transform 0.1s ease;
}

.control-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.control-btn:active {
  transform: scale(0.95);
}

.control-btn svg {
  width: 100%;
  height: 100%;
}

.control-btn.secondary {
  opacity: 0.7;
}

.control-btn.secondary:hover {
  opacity: 1;
}

.control-btn.secondary.active {
  color: var(--color-primary);
  opacity: 1;
}

.play-btn {
  width: 64px;
  height: 64px;
  background-color: var(--color-on-surface);
  color: var(--color-surface);
}

.play-btn:hover {
  background-color: var(--color-on-surface);
  transform: scale(1.05);
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* extra controls */
.extra-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-slider {
  width: 100px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 2px;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: var(--color-on-surface);
  border-radius: 50%;
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--color-on-surface);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

/* empty state */
.now-playing-empty {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: var(--color-background);
  z-index: 200;
  gap: 16px;
}

.now-playing-empty p {
  font-size: 18px;
  color: var(--color-on-surface-variant);
}

.now-playing-empty button {
  padding: 12px 24px;
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.now-playing-empty button:hover {
  opacity: 0.9;
}

/* Mobile responsive for cover flow */
@media (max-width: 767px) {
  .cover-flow-container {
    height: 240px;
  }

  .cover-flow-artwork {
    width: 140px;
    height: 140px;
  }

  .cover-flow-reflection {
    width: 140px;
    height: 140px;
  }

  .cover-flow-title {
    font-size: 16px;
  }

  .cover-flow-artist {
    font-size: 13px;
  }

  .nav-btn {
    width: 40px;
    height: 40px;
  }

  .nav-btn svg {
    width: 20px;
    height: 20px;
  }
}

/* responsive */
@media (min-width: 768px) {
  .content {
    flex-direction: row;
    align-items: center;
    gap: 48px;
    text-align: left;
  }

  .content:has(.cover-flow-section) {
    flex-direction: column;
    text-align: center;
  }

  .artwork-container {
    width: 350px;
    height: 350px;
  }

  .info-section {
    text-align: left;
  }

  .content:has(.cover-flow-section) .info-section {
    text-align: center;
  }

  .playback-controls,
  .extra-controls {
    justify-content: flex-start;
  }

  .content:has(.cover-flow-section) .playback-controls,
  .content:has(.cover-flow-section) .extra-controls {
    justify-content: center;
  }

  .cover-flow-section {
    height: auto;
  }

  .cover-flow-container {
    height: 360px;
  }

  .cover-flow-artwork {
    width: 220px;
    height: 220px;
  }

  .cover-flow-reflection {
    width: 220px;
    height: 220px;
  }

  .cover-flow-title {
    font-size: 22px;
  }

  .cover-flow-artist {
    font-size: 16px;
  }
}

@media (min-width: 1024px) {
  .artwork-container {
    width: 400px;
    height: 400px;
  }

  .track-title {
    font-size: 32px;
  }

  .track-artists {
    font-size: 20px;
  }

  .cover-flow-container {
    height: 420px;
  }

  .cover-flow-artwork {
    width: 260px;
    height: 260px;
  }

  .cover-flow-reflection {
    width: 260px;
    height: 260px;
  }

  .cover-flow-title {
    font-size: 24px;
  }

  .cover-flow-artist {
    font-size: 17px;
  }
}
</style>
