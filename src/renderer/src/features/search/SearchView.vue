<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSearchStore, type SearchCategory } from '@/stores/search'
import { usePlayerStore } from '@/stores/player'
import { getAlbumWithInfo } from '@/api/albums'
import { getArtistInfo } from '@/api/artists'
import type { Track, Album, Artist } from '@/api/types'
import { sortAlbumTracks } from '@/utils/tracks'
import TrackItem from '@/components/TrackItem.vue'
import AlbumItem from '@/components/AlbumItem.vue'
import ArtistItem from '@/components/ArtistItem.vue'
import TrackContextMenu from '@/components/TrackContextMenu.vue'
import Carousel from '@/components/Carousel.vue'

const router = useRouter()
const searchStore = useSearchStore()
const playerStore = usePlayerStore()

const searchInput = ref('')
const contextMenuTrack = ref<Track | null>(null)
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const loadingAlbumHash = ref<string | null>(null)

watch(searchInput, (value) => {
  searchStore.search(value)
})

function handleTrackPlay(track: Track) {
  const tracks =
    searchStore.activeCategory === 'all' ? searchStore.topResults?.tracks || [] : searchStore.tracks
  const index = tracks.findIndex((t) => t.trackhash === track.trackhash)
  // use track hash as source for search results since theres no specific container
  playerStore.setQueue(tracks, index >= 0 ? index : 0, false, `tr:${track.trackhash}`)
}

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
  } catch (err) {
    console.error('failed to fetch album tracks:', err)
  } finally {
    loadingAlbumHash.value = null
  }
}

function handleArtistClick(artist: Artist) {
  router.push(`/artist/${artist.artisthash}`)
}

async function handleArtistPlay(artist: Artist): Promise<void> {
  try {
    const artistData = await getArtistInfo(artist.artisthash)
    if (artistData?.tracks && artistData.tracks.length > 0) {
      playerStore.setQueue(artistData.tracks, 0, false, `ar:${artist.artisthash}`)
    }
  } catch (err) {
    console.error('failed to fetch artist tracks:', err)
  }
}

function setCategory(category: SearchCategory) {
  searchStore.setCategory(category)
}

function clearSearch() {
  searchInput.value = ''
  searchStore.clear()
}

function handleTrackMenu(track: Track, event: MouseEvent): void {
  contextMenuTrack.value = track
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
}

function handleContextMenuClose(): void {
  contextMenuVisible.value = false
  contextMenuTrack.value = null
}

function handleFavoriteToggled(track: Track, isFavorite: boolean): void {
  searchStore.updateTrackFavorite(track, isFavorite)
}
</script>

<template>
  <div class="search-view">
    <!-- Search Header -->
    <div class="search-header">
      <div class="search-input-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
          />
        </svg>
        <input
          v-model="searchInput"
          type="text"
          placeholder="Search songs, albums, artists..."
          class="search-input"
          autofocus
        />
        <button v-if="searchInput" class="clear-btn" @click="clearSearch">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      </div>

      <!-- Category Tabs -->
      <div v-if="searchInput" class="category-tabs">
        <button
          class="tab"
          :class="{ active: searchStore.activeCategory === 'all' }"
          @click="setCategory('all')"
        >
          All
        </button>
        <button
          class="tab"
          :class="{ active: searchStore.activeCategory === 'tracks' }"
          @click="setCategory('tracks')"
        >
          Songs
        </button>
        <button
          class="tab"
          :class="{ active: searchStore.activeCategory === 'albums' }"
          @click="setCategory('albums')"
        >
          Albums
        </button>
        <button
          class="tab"
          :class="{ active: searchStore.activeCategory === 'artists' }"
          @click="setCategory('artists')"
        >
          Artists
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="searchStore.isLoading" class="loading">
      <div class="spinner"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!searchInput" class="empty-state">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
        />
      </svg>
      <p>Search for your favorite music</p>
    </div>

    <!-- Results -->
    <div v-else class="results">
      <!-- Top Results (All category) -->
      <template v-if="searchStore.activeCategory === 'all' && searchStore.topResults">
        <!-- Top Tracks -->
        <div v-if="searchStore.topResults.tracks.length > 0" class="result-section">
          <div class="section-header">
            <h2>Songs</h2>
            <button class="see-all" @click="setCategory('tracks')">See All</button>
          </div>
          <div class="track-list">
            <TrackItem
              v-for="track in searchStore.topResults.tracks.slice(0, 5)"
              :key="track.trackhash"
              :track="track"
              show-artwork
              show-album
              @play="handleTrackPlay"
              @menu="handleTrackMenu"
              @favorite="searchStore.toggleTrackFavorite"
            />
          </div>
        </div>

        <!-- Top Albums -->
        <div v-if="searchStore.topResults.albums.length > 0" class="result-section">
          <div class="section-header">
            <h2>Albums</h2>
            <button class="see-all" @click="setCategory('albums')">See All</button>
          </div>
          <Carousel :scroll-amount="3" :gap="16">
            <AlbumItem
              v-for="album in searchStore.topResults.albums.slice(0, 5)"
              :key="album.albumhash"
              :album="album"
              :loading="loadingAlbumHash === album.albumhash"
              size="small"
              @click="handleAlbumClick"
              @play="handleAlbumPlay"
            />
          </Carousel>
        </div>

        <!-- Top Artists -->
        <div v-if="searchStore.topResults.artists.length > 0" class="result-section">
          <div class="section-header">
            <h2>Artists</h2>
            <button class="see-all" @click="setCategory('artists')">See All</button>
          </div>
          <Carousel :scroll-amount="3" :gap="16">
            <ArtistItem
              v-for="artist in searchStore.topResults.artists.slice(0, 5)"
              :key="artist.artisthash"
              :artist="artist"
              size="small"
              @click="handleArtistClick"
              @play="handleArtistPlay"
            />
          </Carousel>
        </div>
      </template>

      <!-- Tracks List -->
      <template v-if="searchStore.activeCategory === 'tracks'">
        <div class="track-list">
          <TrackItem
            v-for="track in searchStore.tracks"
            :key="track.trackhash"
            :track="track"
            show-artwork
            show-album
            @play="handleTrackPlay"
            @menu="handleTrackMenu"
            @favorite="searchStore.toggleTrackFavorite"
          />
        </div>
      </template>

      <!-- Albums Grid -->
      <template v-if="searchStore.activeCategory === 'albums'">
        <div class="album-grid">
          <AlbumItem
            v-for="album in searchStore.albums"
            :key="album.albumhash"
            :album="album"
            :loading="loadingAlbumHash === album.albumhash"
            @click="handleAlbumClick"
            @play="handleAlbumPlay"
          />
        </div>
      </template>

      <!-- Artists Grid -->
      <template v-if="searchStore.activeCategory === 'artists'">
        <div class="artist-grid">
          <ArtistItem
            v-for="artist in searchStore.artists"
            :key="artist.artisthash"
            :artist="artist"
            @click="handleArtistClick"
            @play="handleArtistPlay"
          />
        </div>
      </template>
    </div>

    <!-- Context Menu -->
    <TrackContextMenu
      :track="contextMenuTrack"
      :visible="contextMenuVisible"
      :position="contextMenuPosition"
      @close="handleContextMenuClose"
      @favorite-toggled="handleFavoriteToggled"
    />
  </div>
</template>

<style scoped>
.search-view {
  padding: 16px;
  padding-bottom: 80px;
}

.search-header {
  margin-bottom: 24px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 16px;
  width: 20px;
  height: 20px;
  color: var(--color-on-surface-variant);
}

.search-input {
  width: 100%;
  padding: 14px 48px;
  background-color: var(--color-surface-variant);
  border: none;
  border-radius: 28px;
  font-size: 16px;
  color: var(--color-on-surface);
  outline: none;
}

.search-input::placeholder {
  color: var(--color-on-surface-variant);
}

.clear-btn {
  position: absolute;
  right: 12px;
  width: 32px;
  height: 32px;
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-on-surface-variant);
}

.clear-btn:hover {
  background-color: var(--color-surface);
}

.category-tabs {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.tab {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--color-outline);
  border-radius: 20px;
  font-size: 14px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab.active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-on-primary);
}

.loading {
  display: flex;
  justify-content: center;
  padding: 48px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-surface-variant);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px;
  color: var(--color-on-surface-variant);
}

.empty-state svg {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.result-section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
}

.see-all {
  background: transparent;
  border: none;
  font-size: 14px;
  color: var(--color-primary);
  cursor: pointer;
}

.see-all:hover {
  text-decoration: underline;
}

.track-list {
  display: flex;
  flex-direction: column;
}

.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 24px;
}

.artist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 24px;
}
</style>
