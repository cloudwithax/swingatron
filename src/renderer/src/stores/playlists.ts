import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Playlist, PlaylistWithTracks, Track } from '@/api/types'
import * as playlistsApi from '@/api/playlists'

export const usePlaylistStore = defineStore('playlists', () => {
  // state - list view
  const playlists = ref<Playlist[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // state - detail view
  const currentPlaylist = ref<PlaylistWithTracks | null>(null)
  const isLoadingDetail = ref(false)
  const detailError = ref<string | null>(null)

  // computed
  const pinnedPlaylists = computed(() => playlists.value.filter((p) => p.pinned))

  const unpinnedPlaylists = computed(() => playlists.value.filter((p) => !p.pinned))

  const hasPlaylists = computed(() => playlists.value.length > 0)

  const currentTracks = computed(() => currentPlaylist.value?.tracks || [])

  const currentInfo = computed(() => currentPlaylist.value?.info || null)

  // actions
  async function loadPlaylists(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      playlists.value = await playlistsApi.getAllPlaylists()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load playlists'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function loadPlaylistDetail(playlistId: number | string): Promise<void> {
    isLoadingDetail.value = true
    detailError.value = null

    try {
      currentPlaylist.value = await playlistsApi.getPlaylist(playlistId)
    } catch (e) {
      detailError.value = e instanceof Error ? e.message : 'Failed to load playlist'
      throw e
    } finally {
      isLoadingDetail.value = false
    }
  }

  async function createPlaylist(name: string): Promise<Playlist | null> {
    try {
      const playlist = await playlistsApi.createPlaylist(name)
      if (playlist) {
        // add to the beginning of the list
        playlists.value = [playlist, ...playlists.value]
      }
      return playlist
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create playlist'
      return null
    }
  }

  async function deletePlaylist(playlistId: number): Promise<boolean> {
    try {
      const success = await playlistsApi.deletePlaylist(playlistId)
      if (success) {
        playlists.value = playlists.value.filter((p) => p.id !== playlistId)
        if (currentPlaylist.value?.info.id === playlistId) {
          currentPlaylist.value = null
        }
      }
      return success
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete playlist'
      return false
    }
  }

  async function togglePin(playlistId: number): Promise<boolean> {
    try {
      const success = await playlistsApi.togglePinPlaylist(playlistId)
      if (success) {
        // update the local state
        const playlist = playlists.value.find((p) => p.id === playlistId)
        if (playlist) {
          playlist.pinned = !playlist.pinned
        }
        if (currentPlaylist.value?.info.id === playlistId) {
          currentPlaylist.value.info.pinned = !currentPlaylist.value.info.pinned
        }
      }
      return success
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to toggle pin'
      return false
    }
  }

  async function addTracksToPlaylist(playlistId: number, tracks: Track[]): Promise<boolean> {
    try {
      const success = await playlistsApi.addTracksToPlaylist(playlistId, tracks)
      // refresh playlist if it's the current one
      if (success && currentPlaylist.value?.info.id === playlistId) {
        await loadPlaylistDetail(playlistId)
      }
      return success
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to add tracks'
      return false
    }
  }

  async function removeTrackFromPlaylist(
    playlistId: number,
    track: Track,
    index: number
  ): Promise<boolean> {
    try {
      const success = await playlistsApi.removeTracksFromPlaylist(playlistId, [
        { trackhash: track.trackhash, index }
      ])
      if (success && currentPlaylist.value) {
        // remove from local state
        currentPlaylist.value.tracks = currentPlaylist.value.tracks.filter((_, i) => i !== index)
        currentPlaylist.value.info.count--
      }
      return success
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to remove track'
      return false
    }
  }

  // update track favorite status without making an api call (for cross-store sync)
  function updateTrackFavorite(trackhash: string, isFavorite: boolean): void {
    if (currentPlaylist.value) {
      const trackIndex = currentPlaylist.value.tracks.findIndex((t) => t.trackhash === trackhash)
      if (trackIndex !== -1) {
        currentPlaylist.value.tracks[trackIndex] = {
          ...currentPlaylist.value.tracks[trackIndex],
          is_favorite: isFavorite
        }
      }
    }
  }

  function clearDetail(): void {
    currentPlaylist.value = null
    detailError.value = null
  }

  function refresh(): void {
    loadPlaylists()
  }

  // update a playlist in the list after editing
  function updatePlaylistInList(updated: Playlist): void {
    const index = playlists.value.findIndex((p) => p.id === updated.id)
    if (index !== -1) {
      playlists.value[index] = updated
    }
  }

  function reset(): void {
    playlists.value = []
    isLoading.value = false
    error.value = null
    currentPlaylist.value = null
    isLoadingDetail.value = false
    detailError.value = null
  }

  return {
    // state
    playlists,
    isLoading,
    error,
    currentPlaylist,
    isLoadingDetail,
    detailError,
    // computed
    pinnedPlaylists,
    unpinnedPlaylists,
    hasPlaylists,
    currentTracks,
    currentInfo,
    // actions
    loadPlaylists,
    loadPlaylistDetail,
    createPlaylist,
    deletePlaylist,
    togglePin,
    addTracksToPlaylist,
    removeTrackFromPlaylist,
    updateTrackFavorite,
    clearDetail,
    refresh,
    updatePlaylistInList,
    reset
  }
})
