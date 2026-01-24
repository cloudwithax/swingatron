<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFavoritesStore } from '@/stores/favorites'
import { usePlayerStore } from '@/stores/player'
import { getAlbumWithInfo } from '@/api/albums'
import { getArtistInfo } from '@/api/artists'
import { toggleFavorite } from '@/api/favorites'
import type { Track, Album, Artist } from '@/api/types'
import { sortAlbumTracks } from '@/utils/tracks'
import TrackItem from '@/components/TrackItem.vue'
import AlbumItem from '@/components/AlbumItem.vue'
import ArtistItem from '@/components/ArtistItem.vue'
import CollageImage from '@/components/CollageImage.vue'
import TrackContextMenu from '@/components/TrackContextMenu.vue'

const router = useRouter()
const favoritesStore = useFavoritesStore()
const playerStore = usePlayerStore()

const loadingAlbumHash = ref<string | null>(null)
const contextMenuTrack = ref<Track | null>(null)
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

onMounted(() => {
  favoritesStore.loadFavorites()
})

// extract unique images from tracks for the collage
const collageImages = computed(() => {
  const seenImages = new Set<string>()
  const images: string[] = []

  for (const track of favoritesStore.tracks) {
    if (track.image && !seenImages.has(track.image)) {
      seenImages.add(track.image)
      images.push(track.image)
      if (images.length >= 4) break
    }
  }
  return images
})

const totalDuration = computed(() => {
  const total = favoritesStore.tracks.reduce((sum, track) => sum + track.duration, 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) {
    return `${hours} hr ${minutes} min`
  }
  return `${minutes} min`
})

function handlePlayAll(): void {
  if (favoritesStore.tracks.length > 0) {
    playerStore.setQueue(favoritesStore.tracks, 0, false, 'favorite')
  }
}

function handleShufflePlay(): void {
  if (favoritesStore.tracks.length > 0) {
    playerStore.setQueue(favoritesStore.tracks, 0, true, 'favorite')
  }
}

function handleTrackPlay(track: Track): void {
  const trackIndex = favoritesStore.tracks.findIndex((t) => t.trackhash === track.trackhash)
  playerStore.setQueue(favoritesStore.tracks, trackIndex >= 0 ? trackIndex : 0, false, 'favorite')
}

async function handleTrackFavorite(track: Track): Promise<void> {
  try {
    await toggleFavorite(track.trackhash, 'track', false)
    favoritesStore.updateTrackFavorite(track.trackhash, false)
  } catch {
    // failed to toggle favorite
  }
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
  if (!isFavorite) {
    favoritesStore.updateTrackFavorite(track.trackhash, false)
  }
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
  } catch {
    // failed to fetch album tracks
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
  } catch {
    // failed to fetch artist tracks
  }
}
</script>

<template>
  <div class="favorites-view">
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

    <!-- Favorites content -->
    <div v-else class="favorites-content">
      <!-- Header -->
      <div class="favorites-header">
        <div class="artwork-container">
          <CollageImage :images="collageImages" size="large" />
        </div>

        <div class="favorites-info">
          <h1 class="favorites-title">Favorites</h1>
          <p class="favorites-meta">
            <span v-if="favoritesStore.count.tracks">{{ favoritesStore.count.tracks }} tracks</span>
            <span v-if="favoritesStore.count.tracks && totalDuration"> • {{ totalDuration }} </span>
          </p>

          <!-- Action buttons -->
          <div class="favorites-actions">
            <button
              class="btn btn-primary"
              :disabled="favoritesStore.tracks.length === 0"
              @click="handlePlayAll"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </button>
            <button
              class="btn btn-secondary"
              :disabled="favoritesStore.tracks.length === 0"
              @click="handleShufflePlay"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"
                />
              </svg>
              Shuffle
            </button>
          </div>
        </div>
      </div>

      <!-- Tab selector -->
      <div class="tab-options">
        <button
          class="tab-chip"
          :class="{ active: favoritesStore.activeTab === 'tracks' }"
          @click="favoritesStore.setActiveTab('tracks')"
        >
          Tracks
          <span v-if="favoritesStore.count.tracks > 0" class="count-badge">
            {{ favoritesStore.count.tracks }}
          </span>
        </button>
        <button
          class="tab-chip"
          :class="{ active: favoritesStore.activeTab === 'albums' }"
          @click="favoritesStore.setActiveTab('albums')"
        >
          Albums
          <span v-if="favoritesStore.count.albums > 0" class="count-badge">
            {{ favoritesStore.count.albums }}
          </span>
        </button>
        <button
          class="tab-chip"
          :class="{ active: favoritesStore.activeTab === 'artists' }"
          @click="favoritesStore.setActiveTab('artists')"
        >
          Artists
          <span v-if="favoritesStore.count.artists > 0" class="count-badge">
            {{ favoritesStore.count.artists }}
          </span>
        </button>
      </div>

      <!-- Tracks Tab -->
      <div v-if="favoritesStore.activeTab === 'tracks'" class="track-list">
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
          @menu="handleTrackMenu"
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
.favorites-view {
  padding: 16px;
  padding-bottom: 80px;
  height: 100%;
  overflow-y: auto;
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

.favorites-header {
  display: flex;
  gap: 24px;
  margin-bottom: 32px;
}

.artwork-container {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-surface-variant);
  flex-shrink: 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.favorites-info {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.favorites-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0 0 8px;
}

.favorites-meta {
  font-size: 13px;
  color: var(--color-on-surface-variant);
  margin: 0 0 16px;
}

.favorites-meta span {
  margin-right: 4px;
}

.favorites-actions {
  display: flex;
  gap: 12px;
}

.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn svg {
  width: 20px;
  height: 20px;
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-secondary {
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-outline);
}

.tab-options {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
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

.track-list {
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

/* responsive adjustments */
@media (max-width: 600px) {
  .favorites-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .artwork-container {
    width: 160px;
    height: 160px;
  }

  .favorites-info {
    align-items: center;
  }

  .favorites-title {
    font-size: 22px;
  }
}
</style>
