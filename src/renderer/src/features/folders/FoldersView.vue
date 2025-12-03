<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useFolderStore } from '@/stores/folders'
import { usePlayerStore } from '@/stores/player'
import type { Track, Folder } from '@/api/types'
import FolderItem from '@/components/FolderItem.vue'
import TrackItem from '@/components/TrackItem.vue'
import PathBreadcrumb from '@/components/PathBreadcrumb.vue'
import TrackContextMenu from '@/components/TrackContextMenu.vue'

const folderStore = useFolderStore()
const playerStore = usePlayerStore()
const route = useRoute()

const contextMenuTrack = ref<Track | null>(null)
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

onMounted(() => {
  loadFromRoute()
})

watch(
  () => route.query.path,
  () => {
    loadFromRoute()
  }
)

function loadFromRoute() {
  const pathParam = route.query.path
  const rawPath = typeof pathParam === 'string' ? pathParam : null

  let targetPath: string | null = null
  if (rawPath && rawPath.trim()) {
    try {
      targetPath = decodeURIComponent(rawPath)
    } catch {
      targetPath = rawPath
    }
  }

  if (targetPath && targetPath !== folderStore.currentPath) {
    folderStore.loadFolderContent(targetPath)
  } else if (!targetPath && !folderStore.isAtRoot) {
    folderStore.loadRootFolders()
  } else if (!targetPath && folderStore.isAtRoot && folderStore.rootFolders.length === 0) {
    folderStore.loadRootFolders()
  }
}

function handleFolderClick(folder: Folder) {
  folderStore.navigateToFolder(folder)
}

function handleRootFolderClick(path: string) {
  folderStore.navigateToRootFolder(path)
}

function getFolderName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] || path
}

function handleTrackPlay(track: Track) {
  const allTracks = folderStore.tracks
  const index = allTracks.findIndex((t) => t.trackhash === track.trackhash)
  // use the current folder path as the source
  const folderSource = folderStore.currentPath ? `fo:${folderStore.currentPath}` : 'folder'
  playerStore.setQueue(allTracks, index, false, folderSource)
}

function handleTrackFavorite(track: Track) {
  folderStore.toggleTrackFavorite(track)
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
  folderStore.updateTrackFavorite(track, isFavorite)
}

function handlePathNavigate(index: number) {
  folderStore.navigateToPathPart(index)
}

function handleHomeClick() {
  folderStore.loadRootFolders()
}

function playAll() {
  if (folderStore.tracks.length > 0) {
    const folderSource = folderStore.currentPath ? `fo:${folderStore.currentPath}` : 'folder'
    playerStore.setQueue(folderStore.tracks, 0, false, folderSource)
  }
}

function shuffleAll() {
  if (folderStore.tracks.length > 0) {
    // Enable shuffle mode first, then set queue with preserveShuffle
    if (!playerStore.shuffleMode) {
      playerStore.toggleShuffle()
    }
    const folderSource = folderStore.currentPath ? `fo:${folderStore.currentPath}` : 'folder'
    playerStore.setQueue(folderStore.tracks, 0, true, folderSource)
  }
}
</script>

<template>
  <div class="folders-view">
    <!-- Header with path navigation -->
    <div class="view-header">
      <PathBreadcrumb
        v-if="!folderStore.isAtRoot"
        :parts="folderStore.pathParts"
        @navigate="handlePathNavigate"
        @home="handleHomeClick"
      />
      <h1 v-else class="view-title">Folders</h1>

      <!-- Action buttons -->
      <div v-if="folderStore.tracks.length > 0" class="header-actions">
        <button class="action-btn" @click="playAll">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          Play All
        </button>
        <button class="action-btn" @click="shuffleAll">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"
            />
          </svg>
          Shuffle
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="folderStore.isLoading && folderStore.folders.length === 0" class="loading">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="folderStore.error" class="error">
      <p>{{ folderStore.error }}</p>
      <button class="btn" @click="folderStore.refresh">Retry</button>
    </div>

    <!-- Content -->
    <div v-else class="content">
      <!-- Root folders -->
      <template v-if="folderStore.isAtRoot">
        <div class="folder-list">
          <div
            v-for="rootPath in folderStore.rootFolders"
            :key="rootPath"
            class="root-folder-item"
            @click="handleRootFolderClick(rootPath)"
          >
            <div class="folder-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
                />
              </svg>
            </div>
            <div class="folder-info">
              <div class="folder-name">{{ getFolderName(rootPath) }}</div>
              <div class="folder-path">{{ rootPath }}</div>
            </div>
          </div>
        </div>
      </template>

      <!-- Folder contents -->
      <template v-else>
        <!-- Subfolders -->
        <div v-if="folderStore.folders.length > 0" class="folder-list">
          <FolderItem
            v-for="folder in folderStore.folders"
            :key="folder.path"
            :folder="folder"
            @click="handleFolderClick"
          />
        </div>

        <!-- Tracks -->
        <div v-if="folderStore.tracks.length > 0" class="track-list">
          <TrackItem
            v-for="(track, index) in folderStore.tracks"
            :key="track.trackhash"
            :track="track"
            :index="index"
            show-artwork
            @play="handleTrackPlay"
            @menu="handleTrackMenu"
            @favorite="handleTrackFavorite"
          />
        </div>

        <!-- Load more -->
        <div v-if="folderStore.hasMore" class="load-more">
          <button class="btn" :disabled="folderStore.isLoading" @click="folderStore.loadMore">
            {{ folderStore.isLoading ? 'Loading...' : 'Load More' }}
          </button>
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
.folders-view {
  padding: 16px;
  padding-bottom: 80px; /* Space for mini player */
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 16px;
}

.view-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
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
  transition: opacity 0.15s ease;
}

.action-btn:hover {
  opacity: 0.9;
}

.action-btn svg {
  width: 18px;
  height: 18px;
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

.folder-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}

.root-folder-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background-color: var(--color-surface);
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.root-folder-item:hover {
  background-color: var(--color-surface-variant);
}

.root-folder-item .folder-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary-container);
  border-radius: 12px;
  color: var(--color-on-primary-container);
}

.root-folder-item .folder-icon svg {
  width: 28px;
  height: 28px;
}

.root-folder-item .folder-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--color-on-surface);
}

.root-folder-item .folder-path {
  font-size: 13px;
  color: var(--color-on-surface-variant);
}

.track-list {
  display: flex;
  flex-direction: column;
  padding-bottom: 24px;
}

.load-more {
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
  transition: background-color 0.15s ease;
}

.btn:hover {
  background-color: var(--color-outline);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
