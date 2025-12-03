<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { fetchLyrics, searchAndDownloadLyrics, getThumbnailUrl } from '@/api/client'
import { decodeHtmlEntities } from '@/utils/text'

interface SyncedLine {
  time: number
  text: string
}

// decodes html entities in lyrics data (handles both synced and unsynced formats)
function decodeLyrics(lyricsData: SyncedLine[] | string[]): SyncedLine[] | string[] {
  if (!lyricsData || !Array.isArray(lyricsData)) return lyricsData

  // check if synced lyrics (objects with time and text)
  if (lyricsData.length > 0 && typeof lyricsData[0] === 'object') {
    return (lyricsData as SyncedLine[]).map((line) => ({
      ...line,
      text: decodeHtmlEntities(line.text)
    }))
  }

  // unsynced lyrics (array of strings)
  return (lyricsData as string[]).map((line) => decodeHtmlEntities(line))
}

const playerStore = usePlayerStore()

const lyrics = ref<SyncedLine[] | string[] | null>(null)
const isSynced = ref(false)
const copyright = ref<string | null>(null)
const isLoading = ref(false)
const isFetching = ref(false) // For online search
const error = ref<string | null>(null)
const currentLineIndex = ref(-1)
const lyricsContainer = ref<HTMLElement | null>(null)

// Accept fullscreen prop to adjust styling
defineProps<{
  fullscreen?: boolean
}>()

// Emit event to close the view
const emit = defineEmits<{
  close: []
}>()

// Track thumbnail
const thumbnailUrl = computed(() => {
  return playerStore.currentTrack?.image
    ? getThumbnailUrl(playerStore.currentTrack.image, 'large')
    : ''
})

// Auto-fetch lyrics from online if not found locally
async function fetchOnlineLyrics() {
  const track = playerStore.currentTrack
  if (!track) return

  isFetching.value = true
  error.value = null

  try {
    const artistName = track.artists?.[0]?.name || ''
    const response = await searchAndDownloadLyrics(
      track.trackhash,
      track.title,
      artistName,
      track.album || '',
      track.filepath
    )

    if (response?.lyrics) {
      // If lyrics were found and downloaded, re-fetch from local
      const localResponse = await fetchLyrics(track.trackhash, track.filepath)
      if (localResponse) {
        lyrics.value = decodeLyrics(localResponse.lyrics)
        isSynced.value = localResponse.synced
        copyright.value = localResponse.copyright || null
      } else if (Array.isArray(response.lyrics)) {
        // Use the response directly if it's already formatted
        lyrics.value = decodeLyrics(response.lyrics as SyncedLine[])
        isSynced.value = true
      }
    } else {
      error.value = 'No lyrics found online'
    }
  } catch {
    error.value = 'Failed to fetch lyrics online'
  } finally {
    isFetching.value = false
  }
}

// Load lyrics when track changes
watch(
  () => playerStore.currentTrack?.trackhash,
  async (newHash) => {
    if (!newHash || !playerStore.currentTrack) {
      lyrics.value = null
      isSynced.value = false
      copyright.value = null
      return
    }

    isLoading.value = true
    error.value = null
    currentLineIndex.value = -1

    try {
      const response = await fetchLyrics(
        playerStore.currentTrack.trackhash,
        playerStore.currentTrack.filepath
      )

      if (response && response.lyrics && response.lyrics.length > 0) {
        lyrics.value = decodeLyrics(response.lyrics)
        isSynced.value = response.synced
        copyright.value = response.copyright || null
      } else {
        // No local lyrics found, auto-fetch from online
        lyrics.value = null
        isLoading.value = false
        await fetchOnlineLyrics()
        return
      }
    } catch {
      // Error fetching local lyrics, try online
      lyrics.value = null
      isLoading.value = false
      await fetchOnlineLyrics()
      return
    } finally {
      isLoading.value = false
    }
  },
  { immediate: true }
)

// Update current line based on playback position (for synced lyrics)
watch(
  () => playerStore.currentPosition,
  (position) => {
    if (!isSynced.value || !lyrics.value || !Array.isArray(lyrics.value)) return

    const syncedLyrics = lyrics.value as SyncedLine[]
    let newIndex = -1

    // Find the current line (last line whose time is <= current position)
    for (let i = 0; i < syncedLyrics.length; i++) {
      if (syncedLyrics[i].time <= position) {
        newIndex = i
      } else {
        break
      }
    }

    if (newIndex !== currentLineIndex.value) {
      currentLineIndex.value = newIndex
      scrollToCurrentLine()
    }
  }
)

// Scroll to keep current line centered
function scrollToCurrentLine() {
  nextTick(() => {
    const activeElement = document.querySelector('.lyrics-line.active') as HTMLElement
    if (activeElement && lyricsContainer.value) {
      const container = lyricsContainer.value
      const containerHeight = container.clientHeight
      const lineTop = activeElement.offsetTop
      const lineHeight = activeElement.offsetHeight

      // Scroll to center the active line
      const scrollTarget = lineTop - containerHeight / 2 + lineHeight / 2
      container.scrollTo({
        top: scrollTarget,
        behavior: 'smooth'
      })
    }
  })
}

// Click on a lyric line to seek to that position
function seekToLine(index: number) {
  if (!isSynced.value || !lyrics.value) return
  const syncedLyrics = lyrics.value as SyncedLine[]
  if (syncedLyrics[index]) {
    playerStore.seekTo(syncedLyrics[index].time)
  }
}

// Handle keyboard
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="lyrics-view" :class="{ fullscreen: $props.fullscreen }">
    <!-- Background with blur -->
    <div class="background">
      <img v-if="thumbnailUrl" :src="thumbnailUrl" class="background-image" />
      <div class="background-overlay"></div>
    </div>

    <button class="close-btn" title="Close" @click="$emit('close')">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        />
      </svg>
    </button>

    <!-- Content -->
    <div class="content">
      <!-- Track Info -->

      <!-- Lyrics Container -->
      <div ref="lyricsContainer" class="lyrics-container">
        <!-- Loading -->
        <div v-if="isLoading" class="lyrics-loading">
          <div class="spinner"></div>
          <span>Loading lyrics...</span>
        </div>

        <!-- Fetching from online -->
        <div v-else-if="isFetching" class="lyrics-loading">
          <div class="spinner"></div>
          <span>Searching for lyrics online...</span>
        </div>

        <!-- Error / No lyrics -->
        <div v-else-if="error || !lyrics" class="lyrics-error">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
            />
          </svg>
          <span>{{ error || 'No lyrics available' }}</span>
        </div>

        <!-- Synced Lyrics -->
        <div v-else-if="isSynced" class="lyrics-synced">
          <div
            v-for="(line, index) in lyrics as SyncedLine[]"
            :key="index"
            class="lyrics-line"
            :class="{
              active: index === currentLineIndex,
              past: index < currentLineIndex,
              future: index > currentLineIndex
            }"
            @click="seekToLine(index)"
          >
            {{ line.text || '♪' }}
          </div>
        </div>

        <!-- Unsynced Lyrics -->
        <div v-else class="lyrics-unsynced">
          <div v-for="(line, index) in lyrics as string[]" :key="index" class="lyrics-line">
            {{ line || '' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lyrics-view {
  position: fixed;
  top: 32px;
  left: 0;
  right: 0;
  bottom: 90px;
  /* space for mini player, top offset accounts for titlebar */
  z-index: 200;
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface);
  overflow: hidden;
}

.lyrics-view.fullscreen {
  top: 0;
  bottom: 0;
  /* fullscreen covers everything including titlebar */
}

/* Background with album art blur */
.background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  overflow: hidden;
}

.background-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(80px) saturate(1.5);
  transform: scale(1.5);
  opacity: 0.4;
}

.background-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.5) 0%,
    rgba(0, 0, 0, 0.7) 50%,
    rgba(0, 0, 0, 0.9) 100%
  );
}

/* Header */
.header {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: flex-end;
  padding: 16px 24px;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 24px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.close-btn svg {
  width: 24px;
  height: 24px;
  color: white;
}

/* Content */
.content {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Track Info */
.track-info {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 32px;
  flex-shrink: 0;
}

.artwork-container {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artwork-placeholder {
  width: 100%;
  height: 100%;
  background: var(--color-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
}

.artwork-placeholder svg {
  width: 40px;
  height: 40px;
  color: var(--color-on-surface-variant);
  opacity: 0.5;
}

.track-details {
  flex: 1;
  min-width: 0;
}

.track-title {
  font-size: 24px;
  font-weight: 700;
  color: white;
  margin: 0 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Lyrics Container */
.lyrics-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 40px 0 0;
  scroll-behavior: smooth;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.lyrics-container::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

/* Loading */
.lyrics-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  color: rgba(255, 255, 255, 0.6);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Error */
.lyrics-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  color: rgba(255, 255, 255, 0.4);
}

.lyrics-error svg {
  width: 64px;
  height: 64px;
  opacity: 0.5;
}

/* Synced Lyrics */
.lyrics-synced {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 2vh 4rem;
}

.lyrics-synced .lyrics-line {
  font-size: 28px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition:
    color 0.3s,
    transform 0.3s,
    font-size 0.3s;
  line-height: 1.4;
  padding: 4px 0;
}

.lyrics-synced .lyrics-line:hover {
  color: rgba(255, 255, 255, 0.5);
}

.lyrics-synced .lyrics-line.active {
  color: white;
  font-size: 32px;
  transform: scale(1.02);
}

.lyrics-synced .lyrics-line.past {
  color: rgba(255, 255, 255, 0.4);
}

.lyrics-synced .lyrics-line.future {
  color: rgba(255, 255, 255, 0.3);
}

/* Unsynced Lyrics */
.lyrics-unsynced {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 4rem;
}

.lyrics-unsynced .lyrics-line {
  font-size: 20px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.6;
}

/* Copyright */
.copyright {
  text-align: center;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  padding: 16px 0 24px;
}

/* Responsive */
@media (max-width: 768px) {
  .lyrics-view {
    bottom: 72px;
  }

  .lyrics-view.fullscreen {
    bottom: 0;
  }

  .track-info {
    gap: 16px;
    margin-bottom: 24px;
  }

  .artwork-container {
    width: 64px;
    height: 64px;
  }

  .track-title {
    font-size: 20px;
  }

  .track-artist {
    font-size: 14px;
  }

  .lyrics-synced .lyrics-line {
    font-size: 22px;
  }

  .lyrics-synced .lyrics-line.active {
    font-size: 26px;
  }

  .lyrics-unsynced .lyrics-line {
    font-size: 18px;
  }
}
</style>
