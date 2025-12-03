<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlists'
import { usePlayerStore } from '@/stores/player'
import { getPlaylist } from '@/api/playlists'
import type { Playlist } from '@/api/types'
import PlaylistItem from '@/components/PlaylistItem.vue'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()
const toast = useToast()

const searchQuery = ref('')
const showCreateModal = ref(false)
const newPlaylistName = ref('')
const isCreating = ref(false)
const loadingPlaylistId = ref<number | null>(null)

onMounted(() => {
  if (!playlistStore.hasPlaylists) {
    playlistStore.loadPlaylists()
  }
})

const filteredPlaylists = computed(() => {
  if (!searchQuery.value.trim()) {
    return playlistStore.unpinnedPlaylists
  }
  const query = searchQuery.value.toLowerCase()
  return playlistStore.playlists.filter((p) => p.name.toLowerCase().includes(query))
})

function handlePlaylistClick(playlist: Playlist): void {
  router.push(`/playlist/${playlist.id}`)
}

async function handlePlaylistPlay(playlist: Playlist): Promise<void> {
  loadingPlaylistId.value = playlist.id
  try {
    const playlistData = await getPlaylist(playlist.id, false, 0, 1000)
    if (playlistData?.tracks && playlistData.tracks.length > 0) {
      playerStore.setQueue(playlistData.tracks, 0, false, `pl:${playlist.id}`)
    }
  } catch (err) {
    console.error('failed to fetch playlist tracks:', err)
  } finally {
    loadingPlaylistId.value = null
  }
}

function openCreateModal(): void {
  newPlaylistName.value = ''
  showCreateModal.value = true
}

function closeCreateModal(): void {
  showCreateModal.value = false
  newPlaylistName.value = ''
}

async function handleCreatePlaylist(): Promise<void> {
  const name = newPlaylistName.value.trim()
  if (!name) {
    toast.show('Playlist name cannot be empty', { type: 'error' })
    return
  }

  isCreating.value = true
  try {
    const playlist = await playlistStore.createPlaylist(name)
    if (playlist) {
      toast.show('Playlist created', { type: 'success' })
      closeCreateModal()
      // navigate to the new playlist
      router.push(`/playlist/${playlist.id}`)
    } else {
      toast.show('Failed to create playlist', { type: 'error' })
    }
  } catch {
    toast.show('Failed to create playlist', { type: 'error' })
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div class="playlists-view">
    <div class="view-header">
      <div class="header-top">
        <h1 class="view-title">Playlists</h1>
        <button class="create-btn" @click="openCreateModal">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          <span>New Playlist</span>
        </button>
      </div>

      <form class="search-form" @submit.prevent>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search playlists"
          class="search-input"
        />
      </form>
    </div>

    <!-- Loading state -->
    <div v-if="playlistStore.isLoading && !playlistStore.hasPlaylists" class="loading">
      <div class="spinner"></div>
      <p>Loading playlists...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="playlistStore.error" class="error">
      <p>{{ playlistStore.error }}</p>
      <button class="btn" @click="playlistStore.refresh">Retry</button>
    </div>

    <!-- Empty state -->
    <div v-else-if="!playlistStore.hasPlaylists" class="empty-state">
      <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
        <path
          d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"
        />
      </svg>
      <h2>No playlists yet</h2>
      <p>Create a playlist to organize your music</p>
      <button class="btn primary" @click="openCreateModal">Create Playlist</button>
    </div>

    <template v-else>
      <!-- Pinned playlists section -->
      <section
        v-if="!searchQuery && playlistStore.pinnedPlaylists.length > 0"
        class="playlist-section"
      >
        <h2 class="section-title">Pinned</h2>
        <div class="playlist-grid">
          <PlaylistItem
            v-for="playlist in playlistStore.pinnedPlaylists"
            :key="playlist.id"
            :playlist="playlist"
            :loading="loadingPlaylistId === playlist.id"
            @click="handlePlaylistClick"
            @play="handlePlaylistPlay"
          />
        </div>
      </section>

      <!-- All/Other playlists section -->
      <section v-if="filteredPlaylists.length > 0" class="playlist-section">
        <h2 class="section-title">
          {{
            searchQuery
              ? 'Search Results'
              : playlistStore.pinnedPlaylists.length > 0
                ? 'Other Playlists'
                : 'All Playlists'
          }}
        </h2>
        <div class="playlist-grid">
          <PlaylistItem
            v-for="playlist in filteredPlaylists"
            :key="playlist.id"
            :playlist="playlist"
            :loading="loadingPlaylistId === playlist.id"
            @click="handlePlaylistClick"
            @play="handlePlaylistPlay"
          />
        </div>
      </section>

      <!-- No search results -->
      <div v-if="searchQuery && filteredPlaylists.length === 0" class="no-results">
        <p>No playlists matching "{{ searchQuery }}"</p>
      </div>
    </template>

    <!-- Create playlist modal -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
        <div class="modal">
          <h2 class="modal-title">New Playlist</h2>
          <form @submit.prevent="handleCreatePlaylist">
            <label for="playlist-name" class="input-label">Playlist name</label>
            <input
              id="playlist-name"
              v-model="newPlaylistName"
              type="text"
              placeholder="Enter playlist name"
              class="modal-input"
              autofocus
            />
            <div class="modal-actions">
              <button type="button" class="btn" @click="closeCreateModal">Cancel</button>
              <button type="submit" class="btn primary" :disabled="isCreating">
                {{ isCreating ? 'Creating...' : 'Create' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.playlists-view {
  padding: 16px;
  padding-bottom: 80px;
  height: 100%;
  overflow-y: auto;
}

.view-header {
  margin-bottom: 24px;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.view-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.create-btn:hover {
  background-color: var(--color-primary-variant);
}

.create-btn svg {
  width: 18px;
  height: 18px;
}

.search-form {
  max-width: 300px;
}

.search-input {
  width: 100%;
  padding: 10px 16px;
  background-color: var(--color-surface-variant);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-on-surface);
  outline: none;
}

.search-input::placeholder {
  color: var(--color-on-surface-variant);
}

.search-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.loading,
.error,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--color-on-surface-variant);
  text-align: center;
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

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h2 {
  font-size: 18px;
  color: var(--color-on-surface);
  margin: 0 0 8px;
}

.empty-state p {
  margin: 0 0 24px;
}

.playlist-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0 0 16px;
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 24px;
}

.no-results {
  text-align: center;
  padding: 48px;
  color: var(--color-on-surface-variant);
}

.btn {
  padding: 10px 24px;
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.btn:hover {
  background-color: var(--color-outline);
}

.btn.primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.btn.primary:hover {
  background-color: var(--color-primary-variant);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background-color: var(--color-surface);
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0 0 20px;
}

.input-label {
  display: block;
  font-size: 14px;
  color: var(--color-on-surface-variant);
  margin-bottom: 8px;
}

.modal-input {
  width: 100%;
  padding: 12px 16px;
  background-color: var(--color-surface-variant);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-on-surface);
  outline: none;
  margin-bottom: 24px;
}

.modal-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
