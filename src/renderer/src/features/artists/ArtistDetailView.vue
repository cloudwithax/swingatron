<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getArtistInfo, getSimilarArtists } from '@/api/artists'
import { getAlbumWithInfo } from '@/api/albums'
import { getArtistImageUrl } from '@/api/client'
import type { Track, Album, ArtistInfo, SimilarArtist } from '@/api/types'
import { sortAlbumTracks } from '@/utils/tracks'
import { usePlayerStore } from '@/stores/player'
import TrackItem from '@/components/TrackItem.vue'
import AlbumItem from '@/components/AlbumItem.vue'
import ArtistItem from '@/components/ArtistItem.vue'
import TrackContextMenu from '@/components/TrackContextMenu.vue'
import Carousel from '@/components/Carousel.vue'

const route = useRoute()
const router = useRouter()
const playerStore = usePlayerStore()

const artistInfo = ref<ArtistInfo | null>(null)
const similarArtists = ref<SimilarArtist[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const activeTab = ref<'albums' | 'tracks'>('albums')
const contextMenuTrack = ref<Track | null>(null)
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const loadingAlbumHash = ref<string | null>(null)

const artistHash = computed(() => route.params.hash as string)

const artist = computed(() => artistInfo.value?.artist)
const albums = computed(() => artistInfo.value?.albums?.albums || [])
const appearances = computed(() => artistInfo.value?.albums?.appearances || [])
const singlesAndEps = computed(() => artistInfo.value?.albums?.singles_and_eps || [])
const compilations = computed(() => artistInfo.value?.albums?.compilations || [])
const tracks = computed(() => artistInfo.value?.tracks || [])

const imageUrl = computed(() => {
  return artist.value?.image ? getArtistImageUrl(artist.value.image) : ''
})

const formattedDuration = computed(() => {
  if (!artist.value?.duration) return ''
  const hours = Math.floor(artist.value.duration / 3600)
  const minutes = Math.floor((artist.value.duration % 3600) / 60)
  if (hours > 0) {
    return `${hours} hr ${minutes} min`
  }
  return `${minutes} min`
})

const allAlbums = computed(() => {
  const all: { title: string; albums: Album[] }[] = []
  if (albums.value.length > 0) {
    all.push({ title: 'Albums', albums: albums.value })
  }
  if (singlesAndEps.value.length > 0) {
    all.push({ title: 'Singles & EPs', albums: singlesAndEps.value })
  }
  if (compilations.value.length > 0) {
    all.push({ title: 'Compilations', albums: compilations.value })
  }
  if (appearances.value.length > 0) {
    all.push({ title: 'Appears On', albums: appearances.value })
  }
  return all
})

async function loadArtist() {
  if (!artistHash.value) return

  isLoading.value = true
  error.value = null

  try {
    const [info, similar] = await Promise.all([
      getArtistInfo(artistHash.value),
      getSimilarArtists(artistHash.value).catch(() => [])
    ])
    artistInfo.value = info
    similarArtists.value = similar
  } catch (err) {
    console.error('Failed to load artist:', err)
    error.value = 'Failed to load artist'
  } finally {
    isLoading.value = false
  }
}

function handlePlayAll() {
  if (tracks.value.length > 0) {
    playerStore.setQueue(tracks.value, 0, false, `ar:${artistHash.value}`)
  }
}

function handleShufflePlay() {
  if (tracks.value.length > 0) {
    playerStore.shuffleMode = true
    playerStore.setQueue(tracks.value, 0, false, `ar:${artistHash.value}`)
  }
}

function handleTrackPlay(track: Track) {
  const index = tracks.value.findIndex((t) => t.trackhash === track.trackhash)
  playerStore.setQueue(tracks.value, index >= 0 ? index : 0, false, `ar:${artistHash.value}`)
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
  const trackInList = tracks.value.find((t) => t.trackhash === track.trackhash)
  if (trackInList) {
    trackInList.is_favorite = isFavorite
  }
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

function handleArtistClick(artist: SimilarArtist) {
  router.push(`/artist/${artist.artisthash}`)
}

async function handleSimilarArtistPlay(artist: SimilarArtist): Promise<void> {
  try {
    const artistData = await getArtistInfo(artist.artisthash)
    if (artistData?.tracks && artistData.tracks.length > 0) {
      playerStore.setQueue(artistData.tracks, 0, false, `ar:${artist.artisthash}`)
    }
  } catch (err) {
    console.error('failed to fetch artist tracks:', err)
  }
}

function goBack() {
  router.back()
}

onMounted(() => {
  loadArtist()
})

watch(artistHash, () => {
  loadArtist()
})
</script>

<template>
  <div class="artist-detail-view">
    <!-- Back Button -->
    <button class="back-btn" @click="goBack">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
      </svg>
    </button>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>Loading artist...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button class="btn" @click="loadArtist">Retry</button>
    </div>

    <!-- Artist Content -->
    <div v-else-if="artist" class="artist-content">
      <!-- Header -->
      <div class="artist-header">
        <div class="artist-image-container">
          <img v-if="imageUrl" :src="imageUrl" :alt="artist.name" class="artist-image" />
          <div v-else class="artist-image-placeholder">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
              />
            </svg>
          </div>
        </div>

        <div class="artist-info">
          <h1 class="artist-name">{{ artist.name }}</h1>
          <p class="artist-meta">
            <span v-if="artist.albumcount">{{ artist.albumcount }} albums</span>
            <span v-if="artist.trackcount">• {{ artist.trackcount }} tracks</span>
            <span v-if="formattedDuration">• {{ formattedDuration }}</span>
          </p>

          <div v-if="artist.genres?.length" class="artist-genres">
            <span v-for="genre in artist.genres" :key="genre.genrehash" class="genre-tag">
              {{ genre.name }}
            </span>
          </div>

          <!-- Action Buttons -->
          <div class="artist-actions">
            <button class="btn btn-primary" @click="handlePlayAll">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </button>
            <button class="btn btn-secondary" @click="handleShufflePlay">
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

      <!-- Tab Navigation -->
      <div class="tab-nav">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'albums' }"
          @click="activeTab = 'albums'"
        >
          Albums
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'tracks' }"
          @click="activeTab = 'tracks'"
        >
          Tracks
        </button>
      </div>

      <!-- Albums Tab -->
      <div v-if="activeTab === 'albums'" class="tab-content">
        <template v-for="section in allAlbums" :key="section.title">
          <div class="album-section">
            <h2 class="section-title">{{ section.title }}</h2>
            <div class="album-grid">
              <AlbumItem
                v-for="album in section.albums"
                :key="album.albumhash"
                :album="album"
                :loading="loadingAlbumHash === album.albumhash"
                size="small"
                @click="handleAlbumClick"
                @play="handleAlbumPlay"
              />
            </div>
          </div>
        </template>
      </div>

      <!-- Tracks Tab -->
      <div v-if="activeTab === 'tracks'" class="tab-content">
        <div class="track-list">
          <TrackItem
            v-for="(track, index) in tracks"
            :key="track.trackhash"
            :track="track"
            :index="index"
            :show-artwork="true"
            :show-album="true"
            @play="handleTrackPlay"
            @menu="handleTrackMenu"
          />
        </div>
      </div>

      <!-- Similar Artists -->
      <div v-if="similarArtists.length > 0" class="similar-artists">
        <h2 class="section-title">Similar Artists</h2>
        <Carousel :scroll-amount="3" :gap="24">
          <ArtistItem
            v-for="similarArtist in similarArtists"
            :key="similarArtist.artisthash"
            :artist="similarArtist"
            size="small"
            @click="handleArtistClick"
            @play="handleSimilarArtistPlay"
          />
        </Carousel>
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
.artist-detail-view {
  padding: 16px;
  padding-bottom: 80px;
  height: 100%;
  overflow-y: auto;
}

.back-btn {
  position: sticky;
  top: 0;
  z-index: 10;
  width: 40px;
  height: 40px;
  padding: 8px;
  background-color: var(--color-surface);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-on-surface);
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.back-btn:hover {
  background-color: var(--color-surface-variant);
}

.back-btn svg {
  width: 100%;
  height: 100%;
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.artist-header {
  display: flex;
  gap: 24px;
  margin-bottom: 32px;
}

.artist-image-container {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--color-surface-variant);
  flex-shrink: 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
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
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.artist-name {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0 0 8px;
}

.artist-meta {
  font-size: 13px;
  color: var(--color-on-surface-variant);
  margin: 0 0 12px;
}

.artist-meta span {
  margin-right: 4px;
}

.artist-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.genre-tag {
  padding: 4px 12px;
  background-color: var(--color-surface-variant);
  border-radius: 16px;
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

.artist-actions {
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

.btn svg {
  width: 20px;
  height: 20px;
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
}

.btn-secondary:hover {
  background-color: var(--color-outline);
}

.tab-nav {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--color-outline-variant);
}

.tab-btn {
  padding: 12px 24px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--color-on-surface);
}

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-content {
  min-height: 200px;
}

.album-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0 0 16px;
}

.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 16px;
}

.track-list {
  margin-bottom: 32px;
}

.similar-artists {
  margin-top: 32px;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .artist-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .artist-image-container {
    width: 140px;
    height: 140px;
  }

  .artist-info {
    align-items: center;
  }

  .artist-name {
    font-size: 26px;
  }

  .artist-genres {
    justify-content: center;
  }
}
</style>
