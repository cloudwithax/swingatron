<script setup lang="ts">
import { computed, ref } from 'vue'
import { getThumbnailUrl } from '@/api/client'
import { getPlaceholderDataUrl } from '@/utils/images'

interface Props {
  images: string[]
  size?: 'small' | 'medium' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'large'
})

const imageLoadErrors = ref<Set<number>>(new Set())

// fill grid slots with images, repeating if necessary
const gridImages = computed(() => {
  if (props.images.length === 0) {
    return []
  }

  const slots: string[] = []
  for (let i = 0; i < 4; i++) {
    const imageIndex = i % props.images.length
    slots.push(getThumbnailUrl(props.images[imageIndex], props.size))
  }
  return slots
})

const displayImages = computed(() => {
  return gridImages.value.map((url, index) => {
    if (imageLoadErrors.value.has(index)) {
      return getPlaceholderDataUrl('album')
    }
    return url
  })
})

const hasImages = computed(() => props.images.length > 0)

function handleImageError(index: number) {
  imageLoadErrors.value.add(index)
}
</script>

<template>
  <div class="collage-container">
    <div v-if="hasImages" class="collage-grid">
      <img
        v-for="(_, index) in gridImages"
        :key="index"
        :src="displayImages[index]"
        :alt="`Collage image ${index + 1}`"
        class="collage-image"
        @error="() => handleImageError(index)"
      />
    </div>
    <div v-else class="collage-placeholder">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.collage-container {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-surface-variant);
}

.collage-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  width: 100%;
  height: 100%;
}

.collage-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.collage-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
}

.collage-placeholder svg {
  width: 40%;
  height: 40%;
}
</style>
