<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useArtistStore } from '@/stores/artists'
import { usePlayerStore } from '@/stores/player'
import { getArtistInfo } from '@/api/artists'
import type { Artist, ArtistSortOption } from '@/api/types'
import ArtistItem from '@/components/ArtistItem.vue'

const router = useRouter()
const artistStore = useArtistStore()
const playerStore = usePlayerStore()

// dropdown state for sort options
const showSortMenu = ref(false)

// all available sort options for artists
const sortOptions: { key: ArtistSortOption; label: string; reverse: boolean }[] = [
  { key: 'name', label: 'Name A-Z', reverse: false },
  { key: 'created_date', label: 'Recently Added', reverse: true },
  { key: 'albumcount', label: 'Album Count', reverse: true },
  { key: 'trackcount', label: 'Track Count', reverse: true },
  { key: 'duration', label: 'Duration', reverse: true },
  { key: 'playcount', label: 'Most Played', reverse: true },
  { key: 'playduration', label: 'Time Listened', reverse: true },
  { key: 'lastplayed', label: 'Last Played', reverse: true }
]

const currentSortLabel = computed(() => {
  const option = sortOptions.find((o) => o.key === artistStore.sortBy)
  return option?.label || 'Sort'
})

onMounted(() => {
  if (artistStore.artists.length === 0) {
    artistStore.loadArtists()
  }
})

function handleArtistClick(artist: Artist) {
  router.push(`/artist/${artist.artisthash}`)
}

async function handleArtistPlay(artist: Artist): Promise<void> {
  try {
    const artistData = await getArtistInfo(artist.artisthash)
    if (artistData?.tracks && artistData.tracks.length > 0) {
      playerStore.setQueue(artistData.tracks, 0, false, `ar:${artist.artisthash}`)
    }
  } catch {
    // failed to fetch artist tracks
  }
}

function handleScroll(event: Event) {
  const target = event.target as HTMLElement
  const { scrollTop, scrollHeight, clientHeight } = target

  if (scrollHeight - scrollTop - clientHeight < 200) {
    artistStore.loadMore()
  }
}

function selectSort(key: ArtistSortOption, reverse: boolean) {
  artistStore.setSortOption(key, reverse)
  showSortMenu.value = false
}

function toggleSortMenu() {
  showSortMenu.value = !showSortMenu.value
}

function closeSortMenu() {
  showSortMenu.value = false
}
</script>

<template>
  <div class="artists-view" @scroll="handleScroll">
    <div class="view-header">
      <h1 class="view-title">Artists</h1>

      <div class="sort-container">
        <button class="sort-button" @click="toggleSortMenu">
          <span>{{ currentSortLabel }}</span>
          <svg viewBox="0 0 24 24" fill="currentColor" class="chevron-icon">
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </button>

        <div v-if="showSortMenu" class="sort-dropdown" @mouseleave="closeSortMenu">
          <button
            v-for="option in sortOptions"
            :key="option.key"
            class="sort-option"
            :class="{ active: artistStore.sortBy === option.key }"
            @click="selectSort(option.key, option.reverse)"
          >
            {{ option.label }}
            <svg
              v-if="artistStore.sortBy === option.key"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="check-icon"
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- loading state -->
    <div v-if="artistStore.isLoading && artistStore.artists.length === 0" class="loading">
      <div class="spinner"></div>
      <p>Loading artists...</p>
    </div>

    <!-- error state -->
    <div v-else-if="artistStore.error" class="error">
      <p>{{ artistStore.error }}</p>
      <button class="btn" @click="artistStore.refresh">Retry</button>
    </div>

    <!-- artist grid -->
    <div v-else class="artist-grid">
      <ArtistItem
        v-for="artist in artistStore.artists"
        :key="artist.artisthash"
        :artist="artist"
        @click="handleArtistClick"
        @play="handleArtistPlay"
      />
    </div>

    <!-- loading more indicator -->
    <div v-if="artistStore.isLoading && artistStore.artists.length > 0" class="loading-more">
      <div class="spinner small"></div>
    </div>
  </div>
</template>

<style scoped>
.artists-view {
  padding: 16px;
  padding-bottom: 80px;
  height: 100%;
  overflow-y: auto;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
  flex-wrap: wrap;
}

.view-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
}

.sort-container {
  position: relative;
}

.sort-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background-color: var(--color-surface-variant);
  border: 1px solid var(--color-outline-variant);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-on-surface);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.sort-button:hover {
  background-color: var(--color-surface);
}

.chevron-icon {
  width: 20px;
  height: 20px;
}

.sort-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 180px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
}

.sort-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  font-size: 14px;
  color: var(--color-on-surface);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease;
}

.sort-option:hover {
  background-color: var(--color-surface-variant);
}

.sort-option.active {
  color: var(--color-primary);
  font-weight: 500;
}

.check-icon {
  width: 18px;
  height: 18px;
  color: var(--color-primary);
}

.loading,
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--color-on-surface-variant);
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
  width: 24px;
  height: 24px;
  border-width: 2px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.artist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 24px;
  padding-bottom: 24px;
}

.loading-more {
  display: flex;
  justify-content: center;
  padding: 24px;
}

.btn {
  padding: 10px 24px;
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.btn:hover {
  background-color: var(--color-outline);
}
</style>
