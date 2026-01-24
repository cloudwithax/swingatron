<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Artist } from '@/api/types'
import { getArtistImageUrl } from '@/api/client'

const props = defineProps<{
  artist: Artist
  size?: 'small' | 'medium' | 'large'
}>()

const emit = defineEmits<{
  click: [artist: Artist]
}>()

const imageLoadError = ref(false)

const imageUrl = computed(() => {
  return props.artist.image ? getArtistImageUrl(props.artist.image) : ''
})

function handleImageError() {
  imageLoadError.value = true
}

const sizeClass = computed(() => {
  return `size-${props.size || 'medium'}`
})

function handleClick() {
  emit('click', props.artist)
}
</script>

<template>
  <div class="artist-item" :class="sizeClass" @click="handleClick">
    <div class="artist-image-container">
      <img
        v-if="imageUrl && !imageLoadError"
        :src="imageUrl"
        :alt="artist.name"
        class="artist-image"
        loading="lazy"
        @error="handleImageError"
      />
      <div v-if="!imageUrl || imageLoadError" class="artist-image-placeholder">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
          />
        </svg>
      </div>
    </div>
    <div class="artist-info">
      <div class="artist-name">{{ artist.name }}</div>
      <div v-if="artist.trackcount" class="artist-tracks">{{ artist.trackcount }} tracks</div>
    </div>
  </div>
</template>

<style scoped>
.artist-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.artist-item:hover {
  background-color: var(--color-surface-hover, rgba(255, 255, 255, 0.1));
}

.artist-image-container {
  position: relative;
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--color-surface-variant);
}

.artist-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artist-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
}

.artist-image-placeholder svg {
  width: 40%;
  height: 40%;
}

.artist-info {
  text-align: center;
  width: 100%;
}

.artist-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artist-tracks {
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

/* size variants */
.size-small {
  max-width: 100px;
}

.size-small .artist-image-container {
  width: 80px;
  height: 80px;
}

.size-medium {
  max-width: 140px;
}

.size-medium .artist-image-container {
  width: 120px;
  height: 120px;
}

.size-large {
  max-width: 180px;
}

.size-large .artist-image-container {
  width: 160px;
  height: 160px;
}

.size-small .artist-name {
  font-size: 12px;
}

.size-small .artist-tracks {
  font-size: 11px;
}
</style>
