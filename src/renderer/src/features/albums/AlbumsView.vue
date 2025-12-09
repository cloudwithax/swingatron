<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAlbumStore } from '@/stores/albums'
import { usePlayerStore } from '@/stores/player'
import { getAlbumWithInfo } from '@/api/albums'
import type { Album, AlbumSortOption } from '@/api/types'
import AlbumItem from '@/components/AlbumItem.vue'
import { sortAlbumTracks } from '@/utils/tracks'

const router = useRouter()
const albumStore = useAlbumStore()
const playerStore = usePlayerStore()

const loadingAlbumHash = ref<string | null>(null)

// dropdown state for more sort options
const showSortMenu = ref(false)

// all available sort options for albums
const sortOptions: { key: AlbumSortOption; label: string; reverse: boolean }[] = [
  { key: 'created_date', label: 'Recently Added', reverse: true },
  { key: 'title', label: 'Title A-Z', reverse: false },
  { key: 'date', label: 'Release Date', reverse: true },
  { key: 'albumartists', label: 'Artist A-Z', reverse: false },
  { key: 'duration', label: 'Duration', reverse: true },
  { key: 'trackcount', label: 'Track Count', reverse: true },
  { key: 'playcount', label: 'Most Played', reverse: true },
  { key: 'playduration', label: 'Time Listened', reverse: true },
  { key: 'lastplayed', label: 'Last Played', reverse: true }
]

const currentSortLabel = computed(() => {
  const option = sortOptions.find((o) => o.key === albumStore.sortBy)
  return option?.label || 'Sort'
})

onMounted(() => {
  if (albumStore.albums.length === 0) {
    albumStore.loadAlbums()
  }
})

function handleAlbumClick(album: Album) {
  router.push(`/album/${album.albumhash}`)
}

async function handleAlbumPlay(album: Album): Promise<void> {
  loadingAlbumHash.value = album.albumhash
  try {
    const albumData = await getAlbumWithInfo(album.albumhash)
    if (albumData?.tracks && albumData.tracks.length > 0) {
      const sortedTracks = sortAlbumTracks(albumData.tracks)
      playerStore.setQueue(sortedTracks, 0, false, `al:${album.albumhash}`)
    }
  } catch {
    // failed to fetch album tracks
  } finally {
    loadingAlbumHash.value = null
  }
}

function handleScroll(event: Event) {
  const target = event.target as HTMLElement
  const { scrollTop, scrollHeight, clientHeight } = target

  // load more when near bottom
  if (scrollHeight - scrollTop - clientHeight < 200) {
    albumStore.loadMore()
  }
}

function selectSort(key: AlbumSortOption, reverse: boolean) {
  albumStore.setSortOption(key, reverse)
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
  <div class="albums-view" @scroll="handleScroll">
    <div class="view-header">
      <h1 class="view-title">Albums</h1>

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
            :class="{ active: albumStore.sortBy === option.key }"
            @click="selectSort(option.key, option.reverse)"
          >
            {{ option.label }}
            <svg
              v-if="albumStore.sortBy === option.key"
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
    <div v-if="albumStore.isLoading && albumStore.albums.length === 0" class="loading">
      <div class="spinner"></div>
      <p>Loading albums...</p>
    </div>

    <!-- error state -->
    <div v-else-if="albumStore.error" class="error">
      <p>{{ albumStore.error }}</p>
      <button class="btn" @click="albumStore.refresh">Retry</button>
    </div>

    <!-- album grid -->
    <div v-else class="album-grid">
      <AlbumItem
        v-for="album in albumStore.albums"
        :key="album.albumhash"
        :album="album"
        :loading="loadingAlbumHash === album.albumhash"
        @click="handleAlbumClick"
        @play="handleAlbumPlay"
      />
    </div>

    <!-- loading more indicator -->
    <div v-if="albumStore.isLoading && albumStore.albums.length > 0" class="loading-more">
      <div class="spinner small"></div>
    </div>
  </div>
</template>

<style scoped>
.albums-view {
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

.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
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
