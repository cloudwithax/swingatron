<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFavoritesStore } from '@/stores/favorites'
import { usePlayerStore } from '@/stores/player'
import { getAlbumWithInfo } from '@/api/albums'
import { getArtistInfo } from '@/api/artists'
import type { Track, Album, Artist } from '@/api/types'
import { sortAlbumTracks } from '@/utils/tracks'
import TrackItem from '@/components/TrackItem.vue'
import AlbumItem from '@/components/AlbumItem.vue'
import ArtistItem from '@/components/ArtistItem.vue'

const router = useRouter()
const favoritesStore = useFavoritesStore()
const playerStore = usePlayerStore()

const loadingAlbumHash = ref<string | null>(null)

onMounted(() => {
  favoritesStore.loadFavorites()
})

function handleTrackPlay(track: Track): void {
  // play track with full favorites track list as queue
  const trackIndex = favoritesStore.tracks.findIndex((t) => t.trackhash === track.trackhash)
  playerStore.setQueue(favoritesStore.tracks, trackIndex >= 0 ? trackIndex : 0, false, 'favorite')
}

function handleTrackFavorite(track: Track): void {
  favoritesStore.removeTrackFavorite(track)
}

function handleAlbumClick(album: Album): void {
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

function handleArtistClick(artist: Artist): void {
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
</script>

<template>
  <div class="favorites-view">
    <div class="view-header">
      <h1 class="view-title">Favorites</h1>

      <div class="tab-options">
        <button
          class="tab-chip"
          :class="{ active: favoritesStore.activeTab === 'tracks' }"
          @click="favoritesStore.setActiveTab('tracks')"
        >
          Tracks
          <span v-if="favoritesStore.count.tracks > 0" class="count-badge">{{
            favoritesStore.count.tracks
          }}</span>
        </button>
        <button
          class="tab-chip"
          :class="{ active: favoritesStore.activeTab === 'albums' }"
          @click="favoritesStore.setActiveTab('albums')"
        >
          Albums
          <span v-if="favoritesStore.count.albums > 0" class="count-badge">{{
            favoritesStore.count.albums
          }}</span>
        </button>
        <button
          class="tab-chip"
          :class="{ active: favoritesStore.activeTab === 'artists' }"
          @click="favoritesStore.setActiveTab('artists')"
        >
          Artists
          <span v-if="favoritesStore.count.artists > 0" class="count-badge">{{
            favoritesStore.count.artists
          }}</span>
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="favoritesStore.isLoading" class="loading">
      <div class="spinner"></div>
      <p>Loading favorites...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="favoritesStore.error" class="error">
      <p>{{ favoritesStore.error }}</p>
      <button class="btn" @click="favoritesStore.refresh">Retry</button>
    </div>

    <!-- Empty state -->
    <div v-else-if="!favoritesStore.hasFavorites" class="empty-state">
      <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
      <h2>No favorites yet</h2>
      <p>Start adding tracks, albums, and artists to your favorites</p>
    </div>

    <!-- Tracks Tab -->
    <div v-else-if="favoritesStore.activeTab === 'tracks'" class="tracks-list">
      <div v-if="favoritesStore.tracks.length === 0" class="empty-tab">
        <p>No favorite tracks</p>
      </div>
      <TrackItem
        v-for="(track, index) in favoritesStore.tracks"
        :key="track.trackhash"
        :track="track"
        :index="index"
        :show-album="true"
        :show-artwork="true"
        @play="handleTrackPlay"
        @favorite="handleTrackFavorite"
      />
    </div>

    <!-- Albums Tab -->
    <div v-else-if="favoritesStore.activeTab === 'albums'" class="album-grid">
      <div v-if="favoritesStore.albums.length === 0" class="empty-tab">
        <p>No favorite albums</p>
      </div>
      <AlbumItem
        v-for="album in favoritesStore.albums"
        :key="album.albumhash"
        :album="album"
        :loading="loadingAlbumHash === album.albumhash"
        @click="handleAlbumClick"
        @play="handleAlbumPlay"
      />
    </div>

    <!-- Artists Tab -->
    <div v-else-if="favoritesStore.activeTab === 'artists'" class="artist-grid">
      <div v-if="favoritesStore.artists.length === 0" class="empty-tab">
        <p>No favorite artists</p>
      </div>
      <ArtistItem
        v-for="artist in favoritesStore.artists"
        :key="artist.artisthash"
        :artist="artist"
        @click="handleArtistClick"
        @play="handleArtistPlay"
      />
    </div>
  </div>
</template>

<style scoped>
.favorites-view {
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

.tab-options {
  display: flex;
  gap: 8px;
}

.tab-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--color-outline);
  border-radius: 16px;
  font-size: 13px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-chip:hover {
  background-color: var(--color-surface-variant);
}

.tab-chip.active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-on-primary);
}

.count-badge {
  padding: 2px 6px;
  font-size: 11px;
  background-color: var(--color-surface-variant);
  border-radius: 10px;
  color: var(--color-on-surface-variant);
}

.tab-chip.active .count-badge {
  background-color: var(--color-on-primary);
  color: var(--color-primary);
}

.loading,
.error,
.empty-state,
.empty-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--color-on-surface-variant);
}

.empty-state {
  padding: 80px 48px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h2 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 500;
  color: var(--color-on-surface);
}

.empty-state p,
.empty-tab p {
  margin: 0;
  font-size: 14px;
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

.tracks-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
