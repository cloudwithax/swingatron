<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAlbumWithInfo } from '@/api/albums'
import { toggleFavorite } from '@/api/favorites'
import { getThumbnailUrl } from '@/api/client'
import type { Track, Album, AlbumWithInfo } from '@/api/types'
import { usePlayerStore } from '@/stores/player'
import { sortAlbumTracks } from '@/utils/tracks'
import TrackItem from '@/components/TrackItem.vue'
import AlbumItem from '@/components/AlbumItem.vue'
import TrackContextMenu from '@/components/TrackContextMenu.vue'
import Carousel from '@/components/Carousel.vue'

const route = useRoute()
const router = useRouter()
const playerStore = usePlayerStore()

const albumData = ref<AlbumWithInfo | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const contextMenuTrack = ref<Track | null>(null)
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const loadingAlbumHash = ref<string | null>(null)
const imageLoadError = ref(false)

const albumHash = computed(() => route.params.hash as string)

const album = computed(() => albumData.value?.info)
const tracks = computed(() => albumData.value?.tracks || [])
const versions = computed<Album[]>(() => {
  const rawVersions = (albumData.value?.info.versions ?? []) as unknown[]
  return rawVersions.filter((version): version is Album => {
    return typeof version === 'object' && version !== null && 'albumhash' in version
  })
})
const artistAlbums = computed(() => [] as Album[])
const copyright = computed(() => albumData.value?.copyright)

const thumbnailUrl = computed(() => {
  return album.value?.image ? getThumbnailUrl(album.value.image, 'large') : ''
})

function handleImageError() {
  imageLoadError.value = true
}

const artistNames = computed(() => {
  return album.value?.albumartists?.map((a) => a.name).join(', ') || 'Unknown Artist'
})

const releaseYear = computed(() => {
  const date = album.value?.date
  if (typeof date === 'number') {
    return new Date(date * 1000).getFullYear().toString()
  }
  return ''
})

const totalDuration = computed(() => {
  const total = tracks.value.reduce((sum, track) => sum + track.duration, 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) {
    return `${hours} hr ${minutes} min`
  }
  return `${minutes} min`
})

// Group tracks by disc number
const tracksByDisc = computed(() => {
  const grouped = new Map<number, Track[]>()
  for (const track of tracks.value) {
    const disc = track.disc || 1
    if (!grouped.has(disc)) {
      grouped.set(disc, [])
    }
    grouped.get(disc)!.push(track)
  }
  // Sort tracks within each disc by track number
  for (const [disc, discTracks] of grouped) {
    grouped.set(
      disc,
      discTracks.sort((a, b) => (a.track || 0) - (b.track || 0))
    )
  }
  return grouped
})

const discNumbers = computed(() => {
  return Array.from(tracksByDisc.value.keys()).sort((a, b) => a - b)
})

const hasMultipleDiscs = computed(() => discNumbers.value.length > 1)

// Get all tracks in display order (sorted by disc, then track number)
const sortedTracks = computed(() => {
  const result: Track[] = []
  for (const disc of discNumbers.value) {
    const discTracks = tracksByDisc.value.get(disc)
    if (discTracks) {
      result.push(...discTracks)
    }
  }
  return result
})

async function loadAlbum() {
  if (!albumHash.value) return

  isLoading.value = true
  error.value = null

  try {
    albumData.value = await getAlbumWithInfo(albumHash.value)
  } catch {
    error.value = 'Failed to load album'
  } finally {
    isLoading.value = false
  }
}

function handlePlayAll() {
  if (sortedTracks.value.length > 0) {
    playerStore.setQueue(sortedTracks.value, 0, false, `al:${albumHash.value}`)
  }
}

function handleShufflePlay() {
  if (sortedTracks.value.length > 0) {
    playerStore.shuffleMode = true
    playerStore.setQueue(sortedTracks.value, 0, false, `al:${albumHash.value}`)
  }
}

function handleTrackPlay(track: Track) {
  const index = sortedTracks.value.findIndex((t) => t.trackhash === track.trackhash)
  playerStore.setQueue(sortedTracks.value, index >= 0 ? index : 0, false, `al:${albumHash.value}`)
}

async function handleTrackFavorite(track: Track) {
  try {
    await toggleFavorite(track.trackhash, 'track', !track.is_favorite)
    // Update local state
    const trackInList = tracks.value.find((t) => t.trackhash === track.trackhash)
    if (trackInList) {
      trackInList.is_favorite = !trackInList.is_favorite
    }
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
  const trackInList = tracks.value.find((t) => t.trackhash === track.trackhash)
  if (trackInList) {
    trackInList.is_favorite = isFavorite
  }
}

function handleVersionClick(versionAlbum: Album) {
  router.push(`/album/${versionAlbum.albumhash}`)
}

function handleAlbumClick(album: Album) {
  router.push(`/album/${album.albumhash}`)
}

async function handleAlbumPlay(targetAlbum: Album): Promise<void> {
  loadingAlbumHash.value = targetAlbum.albumhash
  try {
    const targetAlbumData = await getAlbumWithInfo(targetAlbum.albumhash)
    if (targetAlbumData?.tracks && targetAlbumData.tracks.length > 0) {
      const sortedTracks = sortAlbumTracks(targetAlbumData.tracks)
      playerStore.setQueue(sortedTracks, 0, false, `al:${targetAlbum.albumhash}`)
    }
  } catch {
    // failed to fetch album tracks
  } finally {
    loadingAlbumHash.value = null
  }
}

async function handleToggleAlbumFavorite(): Promise<void> {
  if (!album.value) return

  try {
    const newState = !album.value.is_favorite
    await toggleFavorite(album.value.albumhash, 'album', newState)
    // Update local state
    if (albumData.value?.info) {
      albumData.value.info.is_favorite = newState
    }
  } catch {
    // failed to toggle album favorite
  }
}

function handleArtistClick() {
  const artist = album.value?.albumartists?.[0]
  if (artist) {
    router.push(`/artist/${artist.artisthash}`)
  }
}

function goBack() {
  router.back()
}

onMounted(() => {
  loadAlbum()
})

watch(albumHash, () => {
  loadAlbum()
})
</script>

<template>
  <div class="album-detail-view">
    <!-- Back Button -->
    <button class="back-btn" @click="goBack">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
      </svg>
    </button>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>Loading album...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button class="btn" @click="loadAlbum">Retry</button>
    </div>

    <!-- Album Content -->
    <div v-else-if="album" class="album-content">
      <!-- Header -->
      <div class="album-header">
        <div class="album-artwork-container">
          <img
            v-if="thumbnailUrl && !imageLoadError"
            :src="thumbnailUrl"
            :alt="album.title"
            class="album-artwork"
            @error="handleImageError"
          />
          <div v-if="!thumbnailUrl || imageLoadError" class="album-artwork-placeholder">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
              />
            </svg>
          </div>
        </div>

        <div class="album-info">
          <h1 class="album-title">{{ album.title }}</h1>
          <p class="album-artist" @click="handleArtistClick">{{ artistNames }}</p>
          <p class="album-meta">
            <span v-if="releaseYear">{{ releaseYear }}</span>
            <span v-if="tracks.length">• {{ tracks.length }} tracks</span>
            <span v-if="totalDuration">• {{ totalDuration }}</span>
          </p>

          <!-- Action Buttons -->
          <div class="album-actions">
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
            <button
              class="btn btn-icon"
              :class="{ 'is-favorite': album.is_favorite }"
              :title="album.is_favorite ? 'Remove from favorites' : 'Add to favorites'"
              @click="handleToggleAlbumFavorite"
            >
              <svg v-if="album.is_favorite" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Album Versions -->
      <div v-if="versions.length > 1" class="versions-section">
        <div class="versions-list">
          <button
            v-for="version in versions"
            :key="version.albumhash"
            class="version-chip"
            :class="{ active: version.albumhash === albumHash }"
            @click="handleVersionClick(version)"
          >
            {{ version.title }}
            <span v-if="version.help_text" class="version-info">{{ version.help_text }}</span>
          </button>
        </div>
      </div>

      <!-- Track List -->
      <div class="track-list">
        <template v-for="disc in discNumbers" :key="disc">
          <div v-if="hasMultipleDiscs" class="disc-header">
            <span class="disc-number">Disc {{ disc }}</span>
          </div>
          <TrackItem
            v-for="(track, index) in tracksByDisc.get(disc)"
            :key="track.trackhash"
            :track="track"
            :index="index"
            @play="handleTrackPlay"
            @menu="handleTrackMenu"
            @favorite="handleTrackFavorite"
          />
        </template>
      </div>

      <!-- Copyright -->
      <p v-if="copyright" class="copyright">{{ copyright }}</p>

      <!-- More from Artist -->
      <div v-if="artistAlbums.length > 0" class="more-from-artist">
        <h2 class="section-title">More from {{ artistNames }}</h2>
        <Carousel :scroll-amount="3" :gap="16">
          <AlbumItem
            v-for="artistAlbum in artistAlbums"
            :key="artistAlbum.albumhash"
            :album="artistAlbum"
            :loading="loadingAlbumHash === artistAlbum.albumhash"
            size="small"
            @click="handleAlbumClick"
            @play="handleAlbumPlay"
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
.album-detail-view {
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

.album-header {
  display: flex;
  gap: 24px;
  margin-bottom: 32px;
}

.album-artwork-container {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-surface-variant);
  flex-shrink: 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
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

.album-info {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.album-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0 0 8px;
}

.album-artist {
  font-size: 16px;
  color: var(--color-primary);
  cursor: pointer;
  margin: 0 0 4px;
}

.album-artist:hover {
  text-decoration: underline;
}

.album-meta {
  font-size: 13px;
  color: var(--color-on-surface-variant);
  margin: 0 0 16px;
}

.album-meta span {
  margin-right: 4px;
}

.album-actions {
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

.btn-icon {
  width: 44px;
  height: 44px;
  padding: 10px;
  background-color: var(--color-surface-variant);
  border-radius: 50%;
}

.btn-icon:hover {
  background-color: var(--color-outline);
}

.btn-icon.is-favorite {
  color: var(--color-error);
}

.btn-icon svg {
  width: 24px;
  height: 24px;
}

.disc-header {
  padding: 16px 12px 8px;
  border-bottom: 1px solid var(--color-outline-variant);
  margin-bottom: 8px;
}

.disc-number {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.track-list {
  margin-bottom: 32px;
}

.copyright {
  font-size: 11px;
  color: var(--color-on-surface-variant);
  opacity: 0.7;
  text-align: center;
  margin: 24px 0;
}

.more-from-artist {
  margin-top: 32px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0 0 16px;
}

.versions-section {
  margin-bottom: 24px;
}

.versions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.version-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background-color: var(--color-surface-variant);
  border: 1px solid var(--color-outline);
  border-radius: 20px;
  font-size: 13px;
  color: var(--color-on-surface);
  cursor: pointer;
  transition: all 0.15s ease;
}

.version-chip:hover {
  background-color: var(--color-outline);
}

.version-chip.active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-on-primary);
}

.version-info {
  font-size: 11px;
  opacity: 0.7;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .album-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .album-artwork-container {
    width: 160px;
    height: 160px;
  }

  .album-info {
    align-items: center;
  }

  .album-title {
    font-size: 22px;
  }
}
</style>
