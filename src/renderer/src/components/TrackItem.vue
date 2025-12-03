<script setup lang="ts">
import { computed } from 'vue'
import type { Track } from '@/api/types'
import { getThumbnailUrl } from '@/api/client'
import { usePlayerStore } from '@/stores/player'

const props = defineProps<{
  track: Track
  index?: number
  showAlbum?: boolean
  showArtwork?: boolean
  isPlaying?: boolean
}>()

const emit = defineEmits<{
  play: [track: Track]
  menu: [track: Track, event: MouseEvent]
  favorite: [track: Track]
}>()

const playerStore = usePlayerStore()

const isCurrentTrack = computed(() => {
  return playerStore.currentTrack?.trackhash === props.track.trackhash
})

const thumbnailUrl = computed(() => {
  return props.track.image ? getThumbnailUrl(props.track.image, 'small') : ''
})

const artistNames = computed(() => {
  const artists = props.track.artists || []
  return artists.map((a) => a.name).join(', ') || 'Unknown Artist'
})

const formattedDuration = computed(() => {
  const totalSeconds = Math.floor(props.track.duration)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

const qualityClass = computed(() => {
  const bitrate = props.track.bitrate
  if (bitrate >= 1024) return 'quality-lossless'
  if (bitrate >= 321) return 'quality-hires'
  return ''
})

const isFavorite = computed(() => {
  return props.track.is_favorite ?? false
})

function handleClick() {
  emit('play', props.track)
}

function handleHoverClick() {
  if (isCurrentTrack.value) {
    // Toggle play/pause when hovering current track
    playerStore.playPause()
  } else {
    emit('play', props.track)
  }
}

function handleContextMenu(event: MouseEvent) {
  event.preventDefault()
  emit('menu', props.track, event)
}

function handleFavorite(event: MouseEvent) {
  event.stopPropagation()
  emit('favorite', props.track)
}
</script>

<template>
  <div
    class="track-item"
    :class="{ 'is-current': isCurrentTrack, 'is-playing': isCurrentTrack && playerStore.isPlaying }"
    @dblclick="handleClick"
    @contextmenu="handleContextMenu"
  >
    <!-- Track Number or Artwork -->
    <div class="track-index">
      <button class="hover-play" aria-label="Play/Pause" @click.stop="handleHoverClick">
        <div v-if="isCurrentTrack && playerStore.isLoading" class="spinner small"></div>
        <svg
          v-else-if="!(isCurrentTrack && playerStore.isPlaying)"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      </button>
      <template v-if="showArtwork && thumbnailUrl">
        <img :src="thumbnailUrl" :alt="track.title" class="track-artwork" />
      </template>
      <template v-else-if="index !== undefined">
        <div v-if="isCurrentTrack && playerStore.isLoading" class="spinner small"></div>
        <span v-else-if="!isCurrentTrack" class="track-number">{{ index + 1 }}</span>
        <span v-else class="playing-indicator">
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </span>
      </template>
    </div>

    <!-- Track Info -->
    <div class="track-info">
      <div class="track-title" :class="qualityClass">{{ track.title }}</div>
      <div class="track-meta">
        <span class="track-artist">{{ artistNames }}</span>
        <template v-if="showAlbum && track.album">
          <span class="meta-separator">•</span>
          <span class="track-album">{{ track.album }}</span>
        </template>
      </div>
    </div>

    <!-- Actions -->
    <div class="track-actions">
      <button
        class="favorite-btn"
        :class="{ 'is-favorite': isFavorite }"
        :title="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
        @click="handleFavorite"
      >
        <svg v-if="isFavorite" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>
      </button>
      <span class="track-duration">{{ formattedDuration }}</span>
      <button class="menu-btn" @click.stop="handleContextMenu">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.track-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.track-item:hover {
  background-color: var(--color-surface-variant);
}

.track-item.is-current {
  background-color: var(--color-primary-container);
}

.track-index {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
}

.track-number {
  color: var(--color-on-surface-variant);
  font-size: 14px;
  position: relative;
  z-index: 1;
}

.track-artwork {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
}

.hover-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.35);
  color: #fff;
  border: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none; /* non-interactive until visible */
  cursor: pointer;
  z-index: 2; /* above number/artwork */
}

.hover-play svg {
  width: 20px;
  height: 20px;
}

.track-item:hover .hover-play {
  opacity: 1;
  pointer-events: auto; /* interactive when visible */
}

/* Hide the number when hovering so only the play icon shows */
.track-item:hover .track-number {
  opacity: 0;
}

/* Hide equalizer bars on hover so the play affordance is clear */
.track-item:hover .playing-indicator {
  opacity: 0;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-surface-variant);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner.small {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.playing-indicator {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 16px;
  justify-content: center;
}

.playing-indicator .bar {
  width: 3px;
  border-radius: 3px;
  background-color: var(--color-primary);
  transform-origin: bottom;
}

.track-item.is-playing .playing-indicator .bar:nth-child(1) {
  height: 12px;
  animation: eqBar1 0.9s ease-in-out infinite;
}

.track-item.is-playing .playing-indicator .bar:nth-child(2) {
  height: 16px;
  animation: eqBar2 0.85s ease-in-out infinite;
}

.track-item.is-playing .playing-indicator .bar:nth-child(3) {
  height: 10px;
  animation: eqBar3 1s ease-in-out infinite;
}

@keyframes eqBar1 {
  0% {
    transform: scaleY(0.4);
  }
  20% {
    transform: scaleY(0.9);
  }
  40% {
    transform: scaleY(0.6);
  }
  60% {
    transform: scaleY(1);
  }
  80% {
    transform: scaleY(0.5);
  }
  100% {
    transform: scaleY(0.7);
  }
}

@keyframes eqBar2 {
  0% {
    transform: scaleY(0.8);
  }
  15% {
    transform: scaleY(0.5);
  }
  35% {
    transform: scaleY(1);
  }
  55% {
    transform: scaleY(0.6);
  }
  75% {
    transform: scaleY(0.9);
  }
  100% {
    transform: scaleY(0.7);
  }
}

@keyframes eqBar3 {
  0% {
    transform: scaleY(0.5);
  }
  25% {
    transform: scaleY(0.8);
  }
  50% {
    transform: scaleY(0.6);
  }
  75% {
    transform: scaleY(1);
  }
  100% {
    transform: scaleY(0.4);
  }
}

.track-info {
  flex: 1;
  min-width: 0;
}

.track-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-title.quality-hires {
  color: var(--color-quality-hires);
}

.track-title.quality-lossless {
  color: var(--color-quality-lossless);
}

.track-meta {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-separator {
  margin: 0 4px;
}

.track-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.favorite-btn,
.menu-btn {
  width: 32px;
  height: 32px;
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-on-surface-variant);
  opacity: 0;
  transition:
    opacity 0.15s ease,
    background-color 0.15s ease;
}

.track-item:hover .favorite-btn,
.track-item:hover .menu-btn,
.favorite-btn.is-favorite {
  opacity: 1;
}

.favorite-btn:hover,
.menu-btn:hover {
  background-color: var(--color-surface-variant);
}

.favorite-btn.is-favorite {
  color: var(--color-error);
}

.favorite-btn svg,
.menu-btn svg {
  width: 100%;
  height: 100%;
}

.track-duration {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  min-width: 40px;
  text-align: right;
}
</style>
