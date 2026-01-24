<script setup lang="ts">
import { computed, ref, type ComputedRef } from 'vue'
import type { Playlist } from '@/api/types'
import { getThumbnailUrl, getPlaylistImageUrl } from '@/api/client'
import { usePlayerStore } from '@/stores/player'
import { getPlaceholderDataUrl } from '@/utils/images'

const props = defineProps<{
  playlist: Playlist
  size?: 'small' | 'medium' | 'large'
  loading?: boolean
}>()

const emit = defineEmits<{
  click: [playlist: Playlist]
  play: [playlist: Playlist]
  pause: []
}>()

const playerStore = usePlayerStore()
const imageLoadErrors = ref<Set<number>>(new Set())

// playlist images come from a different path than regular thumbnails
const thumbnailUrl: ComputedRef<string> = computed(() => {
  // try custom playlist image first
  const playlistImg = getPlaylistImageUrl(props.playlist.thumb)
  if (playlistImg) {
    return playlistImg
  }
  // fallback to first image in the images array if available
  if (props.playlist.images && props.playlist.images.length > 0) {
    return getThumbnailUrl(props.playlist.images[0].image, 'small')
  }
  return ''
})

// show grid of album art if no custom image
const showImageGrid: ComputedRef<boolean> = computed(() => {
  return !props.playlist.has_image && !!props.playlist.images && props.playlist.images.length >= 4
})

const gridImages: ComputedRef<string[]> = computed(() => {
  if (!props.playlist.images) return []
  return props.playlist.images.slice(0, 4).map((img) => getThumbnailUrl(img.image, 'small'))
})

const displayGridImages: ComputedRef<string[]> = computed(() => {
  return gridImages.value.map((url, index) => {
    if (imageLoadErrors.value.has(index)) {
      return getPlaceholderDataUrl('album')
    }
    return url
  })
})

const displayThumbnailUrl: ComputedRef<string> = computed(() => {
  if (imageLoadErrors.value.has(-1)) {
    return getPlaceholderDataUrl('album')
  }
  return thumbnailUrl.value
})

const trackCount: ComputedRef<string> = computed(() => {
  const count = props.playlist.count
  return `${count.toLocaleString()} track${count === 1 ? '' : 's'}`
})

const sizeClass: ComputedRef<string> = computed(() => {
  return `size-${props.size || 'medium'}`
})

// check if this playlist is the current playback source
const isCurrentSource = computed(() => {
  return playerStore.playbackSource === `pl:${props.playlist.id}`
})

const isPlaying = computed(() => {
  return isCurrentSource.value && playerStore.isPlaying
})

function handleClick(): void {
  emit('click', props.playlist)
}

function handlePlayPause(event: MouseEvent): void {
  event.stopPropagation()
  if (isPlaying.value) {
    playerStore.pause()
    emit('pause')
  } else if (isCurrentSource.value) {
    // same source but paused, resume
    playerStore.play()
  } else {
    emit('play', props.playlist)
  }
}

function handleImageError(index: number = -1) {
  imageLoadErrors.value.add(index)
}
</script>

<template>
  <div class="playlist-item" :class="sizeClass" @click="handleClick">
    <div class="playlist-artwork-container">
      <!-- grid layout for playlists without custom images -->
      <div v-if="showImageGrid" class="playlist-image-grid">
        <img
          v-for="(_, index) in gridImages"
          :key="index"
          :src="displayGridImages[index]"
          :alt="`${playlist.name} artwork ${index + 1}`"
          class="grid-image"
          loading="lazy"
          @error="() => handleImageError(index)"
        />
      </div>
      <!-- single image for playlists with custom images -->
      <img
        v-else-if="thumbnailUrl"
        :src="displayThumbnailUrl"
        :alt="playlist.name"
        class="playlist-artwork"
        loading="lazy"
        @error="() => handleImageError(-1)"
      />
      <!-- placeholder when no images available -->
      <div v-else class="playlist-artwork-placeholder">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"
          />
        </svg>
      </div>
      <!-- pin indicator -->
      <div v-if="playlist.pinned" class="pin-indicator">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"
          />
        </svg>
      </div>
      <button
        class="play-button"
        :class="{ visible: isCurrentSource || loading }"
        :disabled="loading"
        @click="handlePlayPause"
      >
        <svg v-if="loading" class="spinner" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25" />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
          />
        </svg>
        <svg v-else-if="isPlaying" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    </div>
    <div class="playlist-info">
      <div class="playlist-name">{{ playlist.name }}</div>
      <div class="playlist-count">{{ trackCount }}</div>
    </div>
  </div>
</template>

<style scoped>
.playlist-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.playlist-item:hover {
  background-color: var(--color-surface-hover, rgba(255, 255, 255, 0.1));
}

.playlist-artwork-container {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-surface-variant);
}

.playlist-artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-image-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  width: 100%;
  height: 100%;
}

.grid-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-artwork-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
}

.playlist-artwork-placeholder svg {
  width: 40%;
  height: 40%;
}

.pin-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background-color: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pin-indicator svg {
  width: 14px;
  height: 14px;
  color: var(--color-on-primary);
}

.play-button {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    background-color 0.15s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.play-button.visible,
.playlist-item:hover .play-button {
  opacity: 1;
  transform: translateY(0);
}

.play-button:hover {
  background-color: var(--color-primary-variant, var(--color-primary));
  transform: scale(1.05);
}

.play-button:active {
  transform: scale(0.95);
}

.play-button svg {
  width: 20px;
  height: 20px;
  color: var(--color-on-primary);
}

.play-button .spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.play-button:disabled {
  cursor: wait;
}

.playlist-info {
  padding: 0 4px;
}

.playlist-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-count {
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

/* size variants */
.size-small {
  max-width: 120px;
}

.size-medium {
  max-width: 160px;
}

.size-large {
  max-width: 200px;
}

.size-small .playlist-name {
  font-size: 12px;
}

.size-small .playlist-count {
  font-size: 11px;
}

.size-small .play-button {
  width: 32px;
  height: 32px;
  bottom: 6px;
  right: 6px;
}

.size-small .play-button svg {
  width: 16px;
  height: 16px;
}
</style>
