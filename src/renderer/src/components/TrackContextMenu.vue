<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Track, TrackArtist, Playlist } from '@/api/types'
import { usePlayerStore } from '@/stores/player'
import { toggleFavorite } from '@/api/favorites'
import { getAllPlaylists, addTracksToPlaylist } from '@/api/playlists'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  track: Track | null
  visible: boolean
  position: { x: number; y: number }
}>()

const emit = defineEmits<{
  close: []
  favoriteToggled: [track: Track, isFavorite: boolean]
}>()

const router = useRouter()
const playerStore = usePlayerStore()
const toast = useToast()

type MenuView = 'main' | 'artists' | 'playlists'

const currentView = ref<MenuView>('main')
const menuRef = ref<HTMLElement | null>(null)
const submenuRef = ref<HTMLElement | null>(null)
const showPlaylistSubmenu = ref(false)
let hideTimeout: ReturnType<typeof setTimeout> | null = null

// playlist state
const playlists = ref<Playlist[]>([])
const isLoadingPlaylists = ref(false)

const hasMultipleArtists = computed(() => {
  return (props.track?.artists?.length || 0) > 1
})

// reset view when menu closes
watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      currentView.value = 'main'
      showPlaylistSubmenu.value = false
      playlists.value = []
      if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = null
      }
    }
  }
)

function hidePlaylistSubmenu(): void {
  hideTimeout = setTimeout(() => {
    showPlaylistSubmenu.value = false
  }, 50)
}

function cancelHidePlaylistSubmenu(): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
}

// fetch playlists on hover (lazy loading like upstream)
async function handlePlaylistHover(): Promise<void> {
  cancelHidePlaylistSubmenu()
  showPlaylistSubmenu.value = true
  if (playlists.value.length === 0 && !isLoadingPlaylists.value) {
    isLoadingPlaylists.value = true
    try {
      playlists.value = await getAllPlaylists(true)
    } catch {
      // failed to fetch playlists
    } finally {
      isLoadingPlaylists.value = false
    }
  }
}

const menuStyle = computed(() => {
  // position menu to the left of the click point, vertically centered
  // 200px is the min-width of the context menu
  // vertical centering is handled via CSS transform
  return {
    left: `${props.position.x - 200}px`,
    top: `${props.position.y}px`
  }
})

function close(): void {
  currentView.value = 'main'
  emit('close')
}

function handlePlayNext(): void {
  if (props.track) {
    playerStore.playNext(props.track)
    toast.show('Added to play next')
    close()
  }
}

function handleAddToQueue(): void {
  if (props.track) {
    playerStore.addToQueue(props.track)
    toast.show('Added to queue')
    close()
  }
}

async function handleToggleFavorite(): Promise<void> {
  if (!props.track) return

  try {
    const newState = !props.track.is_favorite
    await toggleFavorite(props.track.trackhash, 'track', newState)
    emit('favoriteToggled', props.track, newState)
    toast.show(newState ? 'Added to favorites' : 'Removed from favorites')
    close()
  } catch {
    toast.show('Failed to update favorite')
  }
}

function handleShowPlaylistDialog(): void {
  // keep main view, just toggle submenu visibility for click users
  showPlaylistSubmenu.value = true
}

async function handleAddToPlaylist(playlist: Playlist): Promise<void> {
  if (!props.track) return

  try {
    const success = await addTracksToPlaylist(playlist.id, [props.track])
    if (success) {
      toast.show(`Added to "${playlist.name}"`)
    } else {
      toast.show('Track already in playlist')
    }
    close()
  } catch {
    toast.show('Failed to add to playlist')
    close()
  }
}

function handleGoToArtist(artist?: TrackArtist): void {
  if (artist) {
    router.push(`/artist/${artist.artisthash}`)
    close()
  } else if (props.track?.artists?.length === 1) {
    router.push(`/artist/${props.track.artists[0].artisthash}`)
    close()
  } else if (hasMultipleArtists.value) {
    currentView.value = 'artists'
  }
}

function handleGoToAlbum(): void {
  if (props.track?.albumhash) {
    router.push(`/album/${props.track.albumhash}`)
    close()
  }
}

function handleGoToFolder(): void {
  if (props.track?.folder) {
    router.push(`/?path=${encodeURIComponent(props.track.folder)}`)
    close()
  }
}

function handleClickOutside(event: MouseEvent): void {
  const target = event.target as Node
  const clickedInMenu = menuRef.value && menuRef.value.contains(target)
  const clickedInSubmenu = submenuRef.value && submenuRef.value.contains(target)

  if (!clickedInMenu && !clickedInSubmenu) {
    close()
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible && track" class="context-menu-overlay">
        <!-- Main Menu -->
        <div
          v-if="currentView === 'main'"
          ref="menuRef"
          class="context-menu"
          :style="menuStyle"
          @mouseleave="hidePlaylistSubmenu"
        >
          <div class="menu-header">
            <div class="track-info">
              <div class="track-title">{{ track.title }}</div>
              <div class="track-artist">
                {{ (track.artists || []).map((a) => a.name).join(', ') || 'Unknown Artist' }}
              </div>
            </div>
          </div>

          <div class="menu-divider"></div>

          <button class="menu-item" @click="handlePlayNext" @mouseenter="hidePlaylistSubmenu">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
            <span>Play Next</span>
          </button>

          <button class="menu-item" @click="handleAddToQueue" @mouseenter="hidePlaylistSubmenu">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"
              />
            </svg>
            <span>Add to Queue</span>
          </button>

          <button
            class="menu-item"
            @mouseenter="handlePlaylistHover"
            @click="handleShowPlaylistDialog"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M14 10H3v2h11v-2zm0-4H3v2h11V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM3 16h7v-2H3v2z"
              />
            </svg>
            <span>Add to Playlist</span>
            <svg class="chevron" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </button>

          <div class="menu-divider"></div>

          <button class="menu-item" @click="handleToggleFavorite" @mouseenter="hidePlaylistSubmenu">
            <svg v-if="track.is_favorite" viewBox="0 0 24 24" fill="currentColor" class="favorite">
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"
              />
            </svg>
            <span>{{ track.is_favorite ? 'Remove from Favorites' : 'Add to Favorites' }}</span>
          </button>

          <div class="menu-divider"></div>

          <button class="menu-item" @click="handleGoToArtist()" @mouseenter="hidePlaylistSubmenu">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
              />
            </svg>
            <span>Go to Artist</span>
            <svg v-if="hasMultipleArtists" class="chevron" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </button>

          <button class="menu-item" @click="handleGoToAlbum" @mouseenter="hidePlaylistSubmenu">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"
              />
            </svg>
            <span>Go to Album</span>
          </button>

          <button class="menu-item" @click="handleGoToFolder" @mouseenter="hidePlaylistSubmenu">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
              />
            </svg>
            <span>Go to Folder</span>
          </button>

          <!-- slot for additional context-specific menu items -->
          <template v-if="$slots['extra-items']">
            <div class="menu-divider"></div>
            <slot name="extra-items"></slot>
          </template>
        </div>

        <!-- Artist Selection Dialog -->
        <div
          v-else-if="currentView === 'artists'"
          ref="menuRef"
          class="context-menu artist-dialog"
          :style="menuStyle"
        >
          <div class="menu-header">
            <button class="back-btn" @click="currentView = 'main'">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </svg>
            </button>
            <span>Select Artist</span>
          </div>

          <div class="menu-divider"></div>

          <button
            v-for="artist in track.artists"
            :key="artist.artisthash"
            class="menu-item"
            @click="handleGoToArtist(artist)"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
              />
            </svg>
            <span>{{ artist.name }}</span>
          </button>
        </div>

        <!-- Playlist Selection Dialog -->
        <div
          v-else-if="currentView === 'playlists'"
          ref="menuRef"
          class="context-menu playlist-dialog"
          :style="menuStyle"
        >
          <div class="menu-header">
            <button class="back-btn" @click="currentView = 'main'">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </svg>
            </button>
            <span>Add to Playlist</span>
          </div>

          <div class="menu-divider"></div>

          <!-- loading state -->
          <div v-if="isLoadingPlaylists" class="menu-loading">
            <span>Loading playlists...</span>
          </div>

          <!-- empty state -->
          <div v-else-if="playlists.length === 0" class="menu-empty">
            <span>No playlists available</span>
          </div>

          <!-- playlist list -->
          <template v-else>
            <button
              v-for="playlist in playlists"
              :key="playlist.id"
              class="menu-item"
              @click="handleAddToPlaylist(playlist)"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"
                />
              </svg>
              <span class="playlist-name">{{ playlist.name }}</span>
              <span v-if="playlist.pinned" class="pinned-badge">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"
                  />
                </svg>
              </span>
            </button>
          </template>
        </div>

        <!-- playlists submenu on hover - positioned outside menu hierarchy -->
        <Transition name="fade">
          <div
            v-if="showPlaylistSubmenu && currentView === 'main'"
            ref="submenuRef"
            class="context-submenu"
            :style="{
              left: `${props.position.x + 5}px`,
              top: `${props.position.y}px`
            }"
            @mouseenter="cancelHidePlaylistSubmenu"
            @mouseleave="hidePlaylistSubmenu"
          >
            <div class="menu-header">
              <span>Add to Playlist</span>
            </div>
            <div class="menu-divider"></div>
            <div v-if="isLoadingPlaylists" class="menu-loading">
              <span>Loading playlists...</span>
            </div>
            <div v-else-if="playlists.length === 0" class="menu-empty">
              <span>No playlists available</span>
            </div>
            <template v-else>
              <button
                v-for="playlist in playlists"
                :key="playlist.id"
                class="menu-item"
                @click="handleAddToPlaylist(playlist)"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"
                  />
                </svg>
                <span class="playlist-name">{{ playlist.name }}</span>
                <span v-if="playlist.pinned" class="pinned-badge">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"
                    />
                  </svg>
                </span>
              </button>
            </template>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
}

.context-menu {
  position: fixed;
  min-width: 200px;
  max-width: 260px;
  background-color: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  z-index: 301;
  transform: translateY(-50%);
}

.menu-header {
  display: flex;
  align-items: center;
  padding: 12px;
  gap: 10px;
}

.track-info {
  flex: 1;
  min-width: 0;
}

.track-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.back-btn {
  width: 32px;
  height: 32px;
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-on-surface);
}

.back-btn:hover {
  background-color: var(--color-surface-variant);
}

.back-btn svg {
  width: 100%;
  height: 100%;
}

.menu-divider {
  height: 1px;
  background-color: var(--color-outline-variant);
  margin: 4px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  text-align: left;
  font-size: 13px;
  color: var(--color-on-surface);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.menu-item:hover {
  background-color: var(--color-surface-variant);
}

.menu-item svg {
  width: 18px;
  height: 18px;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.menu-item svg.favorite {
  color: var(--color-error);
}

.menu-item span {
  flex: 1;
}

.menu-item .chevron {
  width: 16px;
  height: 16px;
}

.menu-item.danger {
  color: var(--color-error);
}

.menu-item.danger svg {
  color: var(--color-error);
}

.artist-dialog .menu-header span {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-on-surface);
}

.playlist-dialog .menu-header span {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-on-surface);
}

.playlist-dialog {
  max-height: 400px;
  overflow-y: auto;
}

.playlist-dialog .playlist-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-dialog .pinned-badge {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.playlist-dialog .pinned-badge svg {
  width: 100%;
  height: 100%;
  color: var(--color-primary);
}

.menu-loading,
.menu-empty {
  padding: 16px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--color-on-surface-variant);
}

/* hover submenu styling */
.context-submenu {
  position: fixed;
  min-width: 200px;
  max-width: 260px;
  background-color: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  z-index: 302;
  transform: translateY(-50%);
}

.context-submenu .playlist-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.context-submenu .pinned-badge {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.context-submenu .pinned-badge svg {
  width: 100%;
  height: 100%;
  color: var(--color-primary);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
