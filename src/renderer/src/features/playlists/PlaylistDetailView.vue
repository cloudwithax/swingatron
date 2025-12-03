<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlists'
import { usePlayerStore } from '@/stores/player'
import { getThumbnailUrl, getPlaylistImageUrl } from '@/api/client'
import type { Track } from '@/api/types'
import TrackItem from '@/components/TrackItem.vue'
import TrackContextMenu from '@/components/TrackContextMenu.vue'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()
const toast = useToast()

const contextMenuTrack = ref<Track | null>(null)
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuIndex = ref(-1)

const playlistId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? parseInt(id, 10) : Number(id)
})

const playlist = computed(() => playlistStore.currentInfo)
const tracks = computed(() => playlistStore.currentTracks)
const isLoading = computed(() => playlistStore.isLoadingDetail)
const error = computed(() => playlistStore.detailError)

const thumbnailUrl = computed(() => {
  if (!playlist.value) return ''
  return getPlaylistImageUrl(playlist.value.thumb)
})

// show grid of album art if no custom image
const showImageGrid = computed(() => {
  return (
    playlist.value &&
    !playlist.value.has_image &&
    playlist.value.images &&
    playlist.value.images.length >= 4
  )
})

const gridImages = computed(() => {
  if (!playlist.value?.images) return []
  return playlist.value.images.slice(0, 4).map((img) => getThumbnailUrl(img.image, 'small'))
})

const totalDuration = computed(() => {
  if (!playlist.value) return ''
  const total = playlist.value.duration
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) {
    return `${hours} hr ${minutes} min`
  }
  return `${minutes} min`
})

const lastUpdated = computed(() => playlist.value?._last_updated || '')

async function loadPlaylist(): Promise<void> {
  if (!playlistId.value || isNaN(playlistId.value)) return
  await playlistStore.loadPlaylistDetail(playlistId.value)
}

function handlePlayAll(): void {
  if (tracks.value.length > 0) {
    playerStore.setQueue(tracks.value, 0, false, `pl:${playlistId.value}`)
  }
}

function handleShufflePlay(): void {
  if (tracks.value.length > 0) {
    playerStore.shuffleMode = true
    playerStore.setQueue(tracks.value, 0, false, `pl:${playlistId.value}`)
  }
}

function handleTrackPlay(track: Track): void {
  const index = tracks.value.findIndex((t) => t.trackhash === track.trackhash)
  playerStore.setQueue(tracks.value, index >= 0 ? index : 0, false, `pl:${playlistId.value}`)
}

function handleTrackMenu(track: Track, event: MouseEvent): void {
  const index = tracks.value.findIndex((t) => t.trackhash === track.trackhash)
  contextMenuTrack.value = track
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuIndex.value = index
  contextMenuVisible.value = true
}

function handleContextMenuClose(): void {
  contextMenuVisible.value = false
  contextMenuTrack.value = null
  contextMenuIndex.value = -1
}

function handleFavoriteToggled(track: Track, isFavorite: boolean): void {
  const trackInList = tracks.value.find((t) => t.trackhash === track.trackhash)
  if (trackInList) {
    trackInList.is_favorite = isFavorite
  }
}

async function handleRemoveTrack(): Promise<void> {
  if (!contextMenuTrack.value || contextMenuIndex.value < 0) return

  const success = await playlistStore.removeTrackFromPlaylist(
    playlistId.value,
    contextMenuTrack.value,
    contextMenuIndex.value
  )

  if (success) {
    toast.show('Track removed from playlist', { type: 'success' })
  } else {
    toast.show('Failed to remove track', { type: 'error' })
  }

  handleContextMenuClose()
}

async function handleTogglePin(): Promise<void> {
  if (!playlist.value) return

  const success = await playlistStore.togglePin(playlistId.value)
  if (success) {
    toast.show(playlist.value.pinned ? 'Playlist pinned' : 'Playlist unpinned', { type: 'success' })
  } else {
    toast.show('Failed to update playlist', { type: 'error' })
  }
}

async function handleDeletePlaylist(): Promise<void> {
  if (!playlist.value) return

  // confirm deletion
  if (!window.confirm(`Are you sure you want to delete "${playlist.value.name}"?`)) {
    return
  }

  const success = await playlistStore.deletePlaylist(playlistId.value)
  if (success) {
    toast.show('Playlist deleted', { type: 'success' })
    router.push('/playlists')
  } else {
    toast.show('Failed to delete playlist', { type: 'error' })
  }
}

function goBack(): void {
  router.back()
}

onMounted(() => {
  loadPlaylist()
})

watch(playlistId, () => {
  loadPlaylist()
})

onUnmounted(() => {
  playlistStore.clearDetail()
})
</script>

<template>
  <div class="playlist-detail-view">
    <!-- Back Button -->
    <button class="back-btn" @click="goBack">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
      </svg>
    </button>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>Loading playlist...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button class="btn" @click="loadPlaylist">Retry</button>
    </div>

    <!-- Playlist Content -->
    <div v-else-if="playlist" class="playlist-content">
      <!-- Header -->
      <div class="playlist-header">
        <div class="playlist-artwork-container">
          <!-- grid layout for playlists without custom images -->
          <div v-if="showImageGrid" class="playlist-image-grid">
            <img
              v-for="(img, index) in gridImages"
              :key="index"
              :src="img"
              :alt="`${playlist.name} artwork ${index + 1}`"
              class="grid-image"
              loading="lazy"
            />
          </div>
          <img
            v-else-if="thumbnailUrl"
            :src="thumbnailUrl"
            :alt="playlist.name"
            class="playlist-artwork"
          />
          <div v-else class="playlist-artwork-placeholder">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"
              />
            </svg>
          </div>
        </div>

        <div class="playlist-info">
          <span class="playlist-type">Playlist</span>
          <h1 class="playlist-name">{{ playlist.name }}</h1>
          <p class="playlist-meta">
            <span
              >{{ playlist.count.toLocaleString() }} track{{
                playlist.count === 1 ? '' : 's'
              }}</span
            >
            <span v-if="totalDuration">• {{ totalDuration }}</span>
          </p>
          <p v-if="lastUpdated" class="playlist-updated">Last updated {{ lastUpdated }}</p>

          <!-- Action Buttons -->
          <div class="playlist-actions">
            <button class="btn btn-primary" :disabled="tracks.length === 0" @click="handlePlayAll">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </button>
            <button
              class="btn btn-secondary"
              :disabled="tracks.length === 0"
              @click="handleShufflePlay"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"
                />
              </svg>
              Shuffle
            </button>
            <button
              class="btn btn-icon"
              :class="{ 'is-pinned': playlist.pinned }"
              :title="playlist.pinned ? 'Unpin playlist' : 'Pin playlist'"
              @click="handleTogglePin"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"
                />
              </svg>
            </button>
            <button
              class="btn btn-icon btn-delete"
              title="Delete playlist"
              @click="handleDeletePlaylist"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="tracks.length === 0" class="empty-tracks">
        <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
          <path
            d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"
          />
        </svg>
        <p>No tracks in this playlist</p>
        <p class="empty-hint">
          Add tracks by right-clicking on a track and selecting "Add to playlist"
        </p>
      </div>

      <!-- Track List -->
      <div v-else class="track-list">
        <TrackItem
          v-for="(track, index) in tracks"
          :key="`${track.trackhash}-${index}`"
          :track="track"
          :index="index"
          @play="handleTrackPlay"
          @menu="handleTrackMenu"
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
    >
      <!-- additional playlist-specific menu item -->
      <template #extra-items>
        <button class="menu-item danger" @click="handleRemoveTrack">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
            />
          </svg>
          <span>Remove from playlist</span>
        </button>
      </template>
    </TrackContextMenu>
  </div>
</template>

<style scoped>
.playlist-detail-view {
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

.playlist-header {
  display: flex;
  gap: 24px;
  margin-bottom: 32px;
}

.playlist-artwork-container {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-surface-variant);
  flex-shrink: 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.playlist-artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-image-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  width: 100%;
  height: 100%;
}

.grid-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-artwork-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
}

.playlist-artwork-placeholder svg {
  width: 40%;
  height: 40%;
}

.playlist-info {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.playlist-type {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.playlist-name {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 4px 0 8px;
}

.playlist-meta {
  font-size: 14px;
  color: var(--color-on-surface-variant);
  margin: 0 0 4px;
}

.playlist-meta span {
  margin-right: 4px;
}

.playlist-updated {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  opacity: 0.7;
  margin: 0 0 16px;
}

.playlist-actions {
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

.btn-icon.is-pinned {
  color: var(--color-primary);
}

.btn-delete:hover {
  background-color: var(--color-error);
  color: var(--color-on-error);
}

.btn-icon svg {
  width: 24px;
  height: 24px;
}

.empty-tracks {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  text-align: center;
  color: var(--color-on-surface-variant);
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-hint {
  font-size: 13px;
  opacity: 0.7;
  margin-top: 8px;
}

.track-list {
  margin-bottom: 32px;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .playlist-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .playlist-artwork-container {
    width: 160px;
    height: 160px;
  }

  .playlist-info {
    align-items: center;
  }

  .playlist-name {
    font-size: 22px;
  }
}
</style>
