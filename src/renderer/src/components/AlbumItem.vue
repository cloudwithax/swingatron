<script setup lang="ts">
import { computed, ref, type ComputedRef } from 'vue'
import type { Album } from '@/api/types'
import { getThumbnailUrl } from '@/api/client'
import { usePlayerStore } from '@/stores/player'

const props = defineProps<{
  album: Album
  size?: 'small' | 'medium' | 'large'
  loading?: boolean
}>()

const emit = defineEmits<{
  click: [album: Album]
  play: [album: Album]
  pause: []
}>()

const playerStore = usePlayerStore()
const imageLoadError = ref(false)

const thumbnailUrl: ComputedRef<string> = computed(() => {
  return props.album.image ? getThumbnailUrl(props.album.image) : ''
})

function handleImageError() {
  imageLoadError.value = true
}

const artistNames: ComputedRef<string> = computed(() => {
  return props.album.albumartists?.map((a) => a.name).join(', ') || 'Unknown Artist'
})

const releaseYear: ComputedRef<number | null> = computed(() => {
  const d = props.album.date
  if (!d) return null
  const ms = d < 1e11 ? d * 1000 : d
  const year = new Date(ms).getFullYear()
  return Number.isNaN(year) ? null : year
})

const sizeClass: ComputedRef<string> = computed(() => {
  return `size-${props.size || 'medium'}`
})

// check if this album is the current playback source
const isCurrentSource = computed(() => {
  return playerStore.playbackSource === `al:${props.album.albumhash}`
})

const isPlaying = computed(() => {
  return isCurrentSource.value && playerStore.isPlaying
})

function handleClick(): void {
  emit('click', props.album)
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
    emit('play', props.album)
  }
}
</script>

<template>
  <div class="album-item" :class="sizeClass" @click="handleClick">
    <div class="album-artwork-container">
      <img
        v-if="thumbnailUrl && !imageLoadError"
        :src="thumbnailUrl"
        :alt="album.title"
        class="album-artwork"
        loading="lazy"
        @error="handleImageError"
      />
      <div v-if="!thumbnailUrl || imageLoadError" class="album-artwork-placeholder">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
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
    <div class="album-info">
      <div class="album-title">{{ album.title }}</div>
      <div class="album-artist">{{ artistNames }}</div>
      <div v-if="releaseYear" class="album-year">{{ releaseYear }}</div>
    </div>
  </div>
</template>

<style scoped>
.album-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.album-item:hover {
  background-color: var(--color-surface-hover, rgba(255, 255, 255, 0.1));
}

.album-artwork-container {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-surface-variant);
}

.album-artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-artwork-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
}

.album-artwork-placeholder svg {
  width: 40%;
  height: 40%;
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
.album-item:hover .play-button {
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

.album-info {
  padding: 0 4px;
}

.album-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.album-artist {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.album-year {
  font-size: 11px;
  color: var(--color-on-surface-variant);
  opacity: 0.7;
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

.size-small .album-title {
  font-size: 12px;
}

.size-small .album-artist {
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
