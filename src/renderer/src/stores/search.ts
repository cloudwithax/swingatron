import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Track, Album, Artist, SearchResults } from '@/api/types'
import * as searchApi from '@/api/search'
import { toggleFavorite } from '@/api/favorites'

export type SearchCategory = 'all' | 'tracks' | 'albums' | 'artists'

export const useSearchStore = defineStore('search', () => {
  // State
  const query = ref('')
  const activeCategory = ref<SearchCategory>('all')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Results
  const topResults = ref<SearchResults | null>(null)
  const tracks = ref<Track[]>([])
  const albums = ref<Album[]>([])
  const artists = ref<Artist[]>([])

  // Debounce
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null
  const debounceDelay = 500

  // Actions
  async function search(searchQuery: string): Promise<void> {
    query.value = searchQuery

    if (!searchQuery.trim()) {
      clearResults()
      return
    }

    // Debounce
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }

    debounceTimeout = setTimeout(async () => {
      isLoading.value = true
      error.value = null

      try {
        // Always fetch all results for filtering by category
        const results = await searchApi.search(searchQuery)
        topResults.value = results
        tracks.value = results.tracks
        albums.value = results.albums
        artists.value = results.artists
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Search failed'
      } finally {
        isLoading.value = false
      }
    }, debounceDelay)
  }

  async function searchImmediate(searchQuery: string): Promise<void> {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }

    query.value = searchQuery
    isLoading.value = true
    error.value = null

    try {
      // Always fetch all results for filtering by category
      const results = await searchApi.search(searchQuery)
      topResults.value = results
      tracks.value = results.tracks
      albums.value = results.albums
      artists.value = results.artists
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Search failed'
    } finally {
      isLoading.value = false
    }
  }

  function setCategory(category: SearchCategory): void {
    activeCategory.value = category
  }

  async function toggleTrackFavorite(track: Track): Promise<void> {
    try {
      const newStatus = await toggleFavorite(track.trackhash, 'track', track.is_favorite ?? false)

      // Update in top results
      if (topResults.value) {
        const index = topResults.value.tracks.findIndex((t) => t.trackhash === track.trackhash)
        if (index !== -1) {
          topResults.value.tracks[index] = {
            ...topResults.value.tracks[index],
            is_favorite: newStatus
          }
        }
      }

      // Update in tracks list
      const tracksIndex = tracks.value.findIndex((t) => t.trackhash === track.trackhash)
      if (tracksIndex !== -1) {
        tracks.value[tracksIndex] = {
          ...tracks.value[tracksIndex],
          is_favorite: newStatus
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to toggle favorite'
    }
  }

  function clearResults(): void {
    topResults.value = null
    tracks.value = []
    albums.value = []
    artists.value = []
  }

  function updateTrackFavorite(track: Track, isFavorite: boolean): void {
    // Update in top results
    if (topResults.value) {
      const index = topResults.value.tracks.findIndex((t) => t.trackhash === track.trackhash)
      if (index !== -1) {
        topResults.value.tracks[index] = {
          ...topResults.value.tracks[index],
          is_favorite: isFavorite
        }
      }
    }

    // Update in tracks list
    const tracksIndex = tracks.value.findIndex((t) => t.trackhash === track.trackhash)
    if (tracksIndex !== -1) {
      tracks.value[tracksIndex] = {
        ...tracks.value[tracksIndex],
        is_favorite: isFavorite
      }
    }
  }

  function clear(): void {
    query.value = ''
    activeCategory.value = 'all'
    clearResults()
    error.value = null
  }

  return {
    // State
    query,
    activeCategory,
    isLoading,
    error,
    topResults,
    tracks,
    albums,
    artists,
    // Actions
    search,
    searchImmediate,
    setCategory,
    toggleTrackFavorite,
    updateTrackFavorite,
    clearResults,
    clear
  }
})
