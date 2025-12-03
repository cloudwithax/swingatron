<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { getThumbnailUrl } from '@/api/client'
import { usePlayerStore } from '@/stores/player'
import LyricsView from './LyricsView.vue'
import QueuePanel from './QueuePanel.vue'

const router = useRouter()
const playerStore = usePlayerStore()

// debounce for next/previous buttons to prevent loading tracks the user is skipping past
const SKIP_DEBOUNCE_MS = 100
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

// Marquee overflow detection
const titleWrapperRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const isOverflowing = ref(false)

function checkOverflow() {
  nextTick(() => {
    if (titleWrapperRef.value && titleRef.value) {
      const wrapperWidth = titleWrapperRef.value.offsetWidth
      const firstSpan = titleRef.value.querySelector('span') as HTMLElement
      if (firstSpan) {
        const textWidth = firstSpan.offsetWidth
        isOverflowing.value = textWidth > wrapperWidth
      }
    }
  })
}

watch(() => playerStore.currentTrack?.title, checkOverflow)

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  checkOverflow()
  resizeObserver = new ResizeObserver(checkOverflow)
  if (titleWrapperRef.value) {
    resizeObserver.observe(titleWrapperRef.value)
  }

  // listen for fullscreen changes
  document.addEventListener('fullscreenchange', updateFullscreenState)
  updateFullscreenState()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('fullscreenchange', updateFullscreenState)
  if (skipTimeout) clearTimeout(skipTimeout)
})

// UI toggles
const showLyrics = ref(false)
const showQueue = ref(false)
const isFullscreen = ref(false)

// track fullscreen state
function updateFullscreenState() {
  isFullscreen.value = !!document.fullscreenElement
}

const thumbnailUrl = computed(() => {
  return playerStore.currentTrack?.image
    ? getThumbnailUrl(playerStore.currentTrack.image, 'small')
    : ''
})

const artists = computed(() => {
  const track = playerStore.currentTrack
  if (!track) return []
  return track.artists || []
})

function goToAlbum() {
  const track = playerStore.currentTrack
  if (track?.albumhash) {
    // dismiss any open panels before navigating
    showQueue.value = false
    showLyrics.value = false
    router.push(`/album/${track.albumhash}`)
  }
}

function goToNowPlaying() {
  // dismiss lyrics view first if it's open
  if (showLyrics.value) {
    showLyrics.value = false
  }

  // enter native fullscreen mode
  enterFullscreen()

  router.push('/nowplaying')
}

async function enterFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    }
  } catch (error) {
    console.warn('Failed to enter fullscreen:', error)
  }
}

function goToArtist(artisthash: string) {
  // dismiss any open panels before navigating
  showQueue.value = false
  showLyrics.value = false
  router.push(`/artist/${artisthash}`)
}

// Seek functionality
const isDragging = ref(false)
const dragProgress = ref(0)

function handleProgressClick(event: MouseEvent) {
  const bar = event.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const percent = (event.clientX - rect.left) / rect.width
  const position = percent * playerStore.duration
  playerStore.seekTo(position)
}

function handleProgressMouseDown(event: MouseEvent) {
  isDragging.value = true
  updateDragProgress(event)
  document.addEventListener('mousemove', handleProgressMouseMove)
  document.addEventListener('mouseup', handleProgressMouseUp)
}

function handleProgressMouseMove(event: MouseEvent) {
  if (!isDragging.value) return
  updateDragProgress(event)
}

function handleProgressMouseUp(event: MouseEvent) {
  if (!isDragging.value) return
  updateDragProgress(event)
  const position = (dragProgress.value / 100) * playerStore.duration
  playerStore.seekTo(position)
  isDragging.value = false
  document.removeEventListener('mousemove', handleProgressMouseMove)
  document.removeEventListener('mouseup', handleProgressMouseUp)
}

function updateDragProgress(event: MouseEvent) {
  const bar = document.querySelector('.progress-bar-container') as HTMLElement
  if (!bar) return
  const rect = bar.getBoundingClientRect()
  const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))
  dragProgress.value = percent
}

const displayProgress = computed(() => {
  return isDragging.value ? dragProgress.value : playerStore.progress
})

// Volume control
function handleVolumeChange(event: Event) {
  const target = event.target as HTMLInputElement
  playerStore.setVolume(parseFloat(target.value))
}
</script>

<template>
  <div v-if="playerStore.currentTrack" class="mini-player">
    <!-- Left: Track Info -->
    <div class="left-section">
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
      <div class="track-info">
        <div ref="titleWrapperRef" class="track-title-wrapper" @click="goToAlbum">
          <div ref="titleRef" class="track-title" :class="{ 'is-overflowing': isOverflowing }">
            <span>{{ playerStore.currentTrack.title }}</span>
            <span v-if="isOverflowing" aria-hidden="true">{{
              playerStore.currentTrack.title
            }}</span>
          </div>
        </div>
        <div class="track-artists">
          <template v-for="(artist, index) in artists" :key="artist.artisthash">
            <span class="artist-link" @click="goToArtist(artist.artisthash)">{{
              artist.name
            }}</span>
            <span v-if="index < artists.length - 1" class="artist-separator">, </span>
          </template>
          <span v-if="artists.length === 0" class="artist-link">Unknown Artist</span>
        </div>
      </div>
    </div>

    <!-- Center: Playback Controls -->
    <div class="center-section">
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
      <div class="progress-row">
        <span class="time-label">{{ playerStore.formattedPosition }}</span>
        <div
          class="progress-bar-container"
          @click.stop="handleProgressClick"
          @mousedown.stop="handleProgressMouseDown"
        >
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${displayProgress}%` }"></div>
            <div class="progress-head" :style="{ left: `${displayProgress}%` }"></div>
          </div>
        </div>
        <span class="time-label">{{ playerStore.formattedDuration }}</span>
      </div>
    </div>

    <!-- Right: Volume & Extra Controls -->
    <div class="right-section">
      <button
        class="control-btn secondary"
        :class="{ active: isFullscreen }"
        :title="isFullscreen ? 'Exit Full Screen' : 'Full Screen'"
        @click="goToNowPlaying"
      >
        <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
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
      <div class="volume-slider-container">
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

  <!-- Queue Panel -->
  <QueuePanel v-if="showQueue" @close="showQueue = false" />

  <!-- Lyrics View Overlay -->
  <LyricsView v-if="showLyrics" @close="showLyrics = false" />
</template>

<style scoped>
.mini-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 90px;
  background-color: var(--color-surface);
  border-top: 1px solid var(--color-outline-variant);
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  align-items: center;
  padding: 0 16px;
  z-index: 100;
}

/* Left Section - Track Info */
.left-section {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  height: 100%;
}

.artwork-container {
  width: 56px;
  height: 56px;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--color-surface-variant);
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: transform 0.15s ease;
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
  color: var(--color-on-surface-variant);
}

.artwork-placeholder svg {
  width: 24px;
  height: 24px;
}

.track-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.track-title-wrapper {
  cursor: pointer;
  transition: color 0.15s ease;
  overflow: hidden;
  width: 100%;
  margin-bottom: 2px;
}

.track-title-wrapper:hover {
  color: var(--color-primary);
}

.track-title-wrapper:hover .track-title span {
  text-decoration: underline;
}

.track-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-on-surface);
  line-height: 1.2;
  margin-bottom: -3px;
  display: inline-block;
  white-space: nowrap;
}

.track-title.is-overflowing {
  animation: marquee 16s linear infinite;
}

.track-title-wrapper:hover .track-title.is-overflowing {
  animation-play-state: paused;
}

.track-title.is-overflowing span:last-child {
  padding-left: 2em;
}

.track-title:not(.is-overflowing) {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

@keyframes marquee {
  0% {
    transform: translateX(0);
  }
  59.99% {
    transform: translateX(-52.5%);
  }
  60%,
  100% {
    transform: translateX(0);
  }
}

.track-title-wrapper:hover {
  text-decoration: underline;
  color: var(--color-primary);
}

.track-artists {
  font-size: 11px;
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.artist-link {
  cursor: pointer;
  transition: color 0.15s ease;
}

.artist-link:hover {
  text-decoration: underline;
  color: var(--color-on-surface);
}

.artist-separator {
  color: var(--color-on-surface-variant);
}

/* Center Section - Playback Controls */
.center-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  max-width: 722px;
  margin: 0 auto;
  width: 100%;
  height: 100%;
}

.playback-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-on-surface-variant);
  transition: all 0.15s ease;
}

.control-btn:hover {
  color: var(--color-on-surface);
  transform: scale(1.05);
}

.control-btn.secondary {
  width: 32px;
  height: 32px;
  padding: 6px;
}

.control-btn.secondary.active {
  color: var(--color-primary);
}

.control-btn svg {
  width: 100%;
  height: 100%;
}

.play-btn {
  width: 36px;
  height: 36px;
  padding: 8px;
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.play-btn:hover {
  transform: scale(1.08);
  background-color: var(--color-primary);
  filter: brightness(1.1);
}

.play-btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Progress Row */
.progress-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.time-label {
  font-size: 11px;
  color: var(--color-on-surface-variant);
  min-width: 40px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.progress-bar-container {
  flex: 1;
  height: 16px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.progress-track {
  position: relative;
  width: 100%;
  height: 4px;
  background-color: var(--color-surface-variant);
  border-radius: 2px;
}

.progress-bar-container:hover .progress-track {
  background-color: var(--color-outline);
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: var(--color-on-surface-variant);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.progress-bar-container:hover .progress-fill {
  background-color: var(--color-primary);
}

.progress-head {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background-color: var(--color-on-surface);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.15s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.progress-bar-container:hover .progress-head {
  opacity: 1;
  background-color: var(--color-primary);
}

/* Right Section - Volume & Extra */
.right-section {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  height: 100%;
}

.volume-slider-container {
  width: 100px;
  display: flex;
  align-items: center;
}

.volume-slider {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background-color: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background-color: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

/* Responsive */
@media (max-width: 900px) {
  .mini-player {
    grid-template-columns: 1fr 1fr;
    height: 72px;
    padding: 0 12px;
  }

  .center-section {
    order: -1;
    grid-column: 1 / -1;
    display: none;
  }

  .right-section {
    display: none;
  }

  .left-section {
    flex: 1;
  }

  .playback-controls {
    position: absolute;
    right: 12px;
  }

  .mini-player {
    display: flex;
    justify-content: space-between;
  }
}
</style>
