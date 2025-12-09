import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Folder, Track } from '@/api/types'
import * as foldersApi from '@/api/folders'
import { toggleFavorite } from '@/api/favorites'

export const useFolderStore = defineStore('folders', () => {
  // State
  const folders = ref<Folder[]>([])
  const tracks = ref<Track[]>([])
  const rootFolders = ref<string[]>([])
  const currentPath = ref<string>('')
  const pathHistory = ref<string[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalItems = ref(0)

  // Pagination
  const currentPage = ref(0)
  const pageSize = ref(50)
  const hasMore = computed(() => folders.value.length + tracks.value.length < totalItems.value)

  // Computed
  const pathParts = computed(() => {
    if (!currentPath.value) return []
    return currentPath.value.split(/[/\\]/).filter(Boolean)
  })

  const isAtRoot = computed(() => !currentPath.value)

  // Actions
  async function loadRootFolders(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      rootFolders.value = await foldersApi.getRootFolders()
      currentPath.value = ''
      pathHistory.value = []
      folders.value = []
      tracks.value = []
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load root folders'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function loadFolderContent(path: string, reset: boolean = true): Promise<void> {
    isLoading.value = true
    error.value = null

    if (reset) {
      currentPage.value = 0
      folders.value = []
      tracks.value = []
    }

    try {
      const response = await foldersApi.getFolderContent({
        folder: path,
        start: currentPage.value * pageSize.value,
        limit: pageSize.value
      })

      if (reset) {
        folders.value = response.folders
        tracks.value = response.tracks
      } else {
        folders.value = [...folders.value, ...response.folders]
        tracks.value = [...tracks.value, ...response.tracks]
      }

      totalItems.value = response.total
      currentPath.value = path
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load folder content'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value || isLoading.value) return
    currentPage.value++
    await loadFolderContent(currentPath.value, false)
  }

  function navigateToFolder(folder: Folder): void {
    pathHistory.value.push(currentPath.value)
    loadFolderContent(folder.path)
  }

  function navigateToRootFolder(path: string): void {
    pathHistory.value = []
    loadFolderContent(path)
  }

  function navigateBack(): void {
    if (pathHistory.value.length > 0) {
      const previousPath = pathHistory.value.pop()!
      loadFolderContent(previousPath)
    } else {
      loadRootFolders()
    }
  }

  function navigateToPathPart(index: number): void {
    const parts = pathParts.value.slice(0, index + 1)
    const newPath = parts.join('/')

    // Update history
    const historyIndex = pathHistory.value.length - (pathParts.value.length - index - 1)
    pathHistory.value = pathHistory.value.slice(0, Math.max(0, historyIndex))

    loadFolderContent(newPath)
  }

  async function toggleTrackFavorite(track: Track): Promise<void> {
    try {
      const newStatus = await toggleFavorite(track.trackhash, 'track', track.is_favorite ?? false)
      // Update the track in our list
      const trackIndex = tracks.value.findIndex((t) => t.trackhash === track.trackhash)
      if (trackIndex !== -1) {
        tracks.value[trackIndex] = { ...tracks.value[trackIndex], is_favorite: newStatus }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to toggle favorite'
    }
  }

  function updateTrackFavorite(track: Track, isFavorite: boolean): void {
    const trackIndex = tracks.value.findIndex((t) => t.trackhash === track.trackhash)
    if (trackIndex !== -1) {
      tracks.value[trackIndex] = { ...tracks.value[trackIndex], is_favorite: isFavorite }
    }
  }

  function refresh(): void {
    if (currentPath.value) {
      loadFolderContent(currentPath.value)
    } else {
      loadRootFolders()
    }
  }

  function reset(): void {
    folders.value = []
    tracks.value = []
    rootFolders.value = []
    currentPath.value = ''
    pathHistory.value = []
    isLoading.value = false
    error.value = null
    totalItems.value = 0
    currentPage.value = 0
    pageSize.value = 50
  }

  return {
    // State
    folders,
    tracks,
    rootFolders,
    currentPath,
    pathHistory,
    isLoading,
    error,
    totalItems,
    // Computed
    pathParts,
    isAtRoot,
    hasMore,
    // Actions
    loadRootFolders,
    loadFolderContent,
    loadMore,
    navigateToFolder,
    navigateToRootFolder,
    navigateBack,
    navigateToPathPart,
    toggleTrackFavorite,
    updateTrackFavorite,
    refresh,
    reset
  }
})
