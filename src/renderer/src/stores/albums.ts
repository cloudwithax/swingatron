import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Album, AlbumWithInfo, Track, AlbumSortOption } from '@/api/types'
import * as albumsApi from '@/api/albums'
import { toggleFavorite } from '@/api/favorites'

export const useAlbumStore = defineStore('albums', () => {
  // State - List View
  const albums = ref<Album[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalAlbums = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(50)
  const sortBy = ref<AlbumSortOption>('created_date')
  const sortReverse = ref(true)

  // State - Detail View
  const currentAlbum = ref<AlbumWithInfo | null>(null)
  const isLoadingDetail = ref(false)
  const detailError = ref<string | null>(null)

  // Computed
  const hasMore = computed(() => albums.value.length < totalAlbums.value)

  const groupedTracks = computed(() => {
    if (!currentAlbum.value) return new Map<number, Track[]>()

    const groups = new Map<number, Track[]>()
    for (const track of currentAlbum.value.tracks) {
      const disc = track.disc || 1
      if (!groups.has(disc)) {
        groups.set(disc, [])
      }
      groups.get(disc)!.push(track)
    }

    // Sort tracks within each disc by track number
    for (const [disc, tracks] of groups) {
      groups.set(
        disc,
        tracks.sort((a, b) => (a.track || 0) - (b.track || 0))
      )
    }

    return groups
  })

  const hasMultipleDiscs = computed(() => groupedTracks.value.size > 1)

  // Actions
  async function loadAlbums(reset: boolean = true): Promise<void> {
    isLoading.value = true
    error.value = null

    if (reset) {
      currentPage.value = 0
      albums.value = []
    }

    try {
      const response = await albumsApi.getAlbums({
        start: currentPage.value * pageSize.value,
        limit: pageSize.value,
        sortBy: sortBy.value,
        reverse: sortReverse.value
      })

      if (reset) {
        albums.value = response.albums
      } else {
        albums.value = [...albums.value, ...response.albums]
      }
      totalAlbums.value = response.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load albums'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value || isLoading.value) return
    currentPage.value++
    await loadAlbums(false)
  }

  async function loadAlbumDetail(albumHash: string): Promise<void> {
    isLoadingDetail.value = true
    detailError.value = null

    try {
      currentAlbum.value = await albumsApi.getAlbumWithInfo(albumHash)
    } catch (e) {
      detailError.value = e instanceof Error ? e.message : 'Failed to load album'
      throw e
    } finally {
      isLoadingDetail.value = false
    }
  }

  function setSortOption(option: AlbumSortOption, reverse: boolean = true): void {
    sortBy.value = option
    sortReverse.value = reverse
    loadAlbums(true)
  }

  async function toggleAlbumFavorite(album: Album): Promise<void> {
    // Note: Albums don't have isFavorite in the base type
    // This would need to be extended based on API response
    try {
      await toggleFavorite(album.albumhash, 'album', false)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to toggle favorite'
    }
  }

  async function toggleTrackFavorite(track: Track): Promise<void> {
    try {
      const newStatus = await toggleFavorite(track.trackhash, 'track', track.is_favorite ?? false)

      // Update in current album
      if (currentAlbum.value) {
        const trackIndex = currentAlbum.value.tracks.findIndex(
          (t) => t.trackhash === track.trackhash
        )
        if (trackIndex !== -1) {
          currentAlbum.value.tracks[trackIndex] = {
            ...currentAlbum.value.tracks[trackIndex],
            is_favorite: newStatus
          }
        }
      }
    } catch (e) {
      detailError.value = e instanceof Error ? e.message : 'Failed to toggle favorite'
    }
  }

  function clearDetail(): void {
    currentAlbum.value = null
    detailError.value = null
  }

  function refresh(): void {
    loadAlbums(true)
  }

  return {
    // State
    albums,
    isLoading,
    error,
    totalAlbums,
    sortBy,
    sortReverse,
    currentAlbum,
    isLoadingDetail,
    detailError,
    // Computed
    hasMore,
    groupedTracks,
    hasMultipleDiscs,
    // Actions
    loadAlbums,
    loadMore,
    loadAlbumDetail,
    setSortOption,
    toggleAlbumFavorite,
    toggleTrackFavorite,
    clearDetail,
    refresh
  }
})
