import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Artist, ArtistInfo, SimilarArtist, ArtistSortOption } from '@/api/types'
import * as artistsApi from '@/api/artists'
import { toggleFavorite } from '@/api/favorites'

export const useArtistStore = defineStore('artists', () => {
  // State - List View
  const artists = ref<Artist[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalArtists = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(50)
  const sortBy = ref<ArtistSortOption>('name')
  const sortReverse = ref(false)

  // State - Detail View
  const currentArtist = ref<ArtistInfo | null>(null)
  const similarArtists = ref<SimilarArtist[]>([])
  const isLoadingDetail = ref(false)
  const detailError = ref<string | null>(null)

  // Artist navigation stack (for "similar artists" drilling)
  const artistStack = ref<string[]>([])

  // Computed
  const hasMore = computed(() => artists.value.length < totalArtists.value)
  const canGoBack = computed(() => artistStack.value.length > 0)

  // Actions
  async function loadArtists(reset: boolean = true): Promise<void> {
    isLoading.value = true
    error.value = null

    if (reset) {
      currentPage.value = 0
      artists.value = []
    }

    try {
      const response = await artistsApi.getArtists({
        start: currentPage.value * pageSize.value,
        limit: pageSize.value,
        sortBy: sortBy.value,
        reverse: sortReverse.value
      })

      if (reset) {
        artists.value = response.artists
      } else {
        artists.value = [...artists.value, ...response.artists]
      }
      totalArtists.value = response.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load artists'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value || isLoading.value) return
    currentPage.value++
    await loadArtists(false)
  }

  async function loadArtistDetail(artistHash: string, addToStack: boolean = false): Promise<void> {
    isLoadingDetail.value = true
    detailError.value = null

    // Add current artist to stack if navigating to a new one
    if (addToStack && currentArtist.value) {
      artistStack.value.push(currentArtist.value.artist.artisthash)
    }

    try {
      const [info, similar] = await Promise.all([
        artistsApi.getArtistInfo(artistHash),
        artistsApi.getSimilarArtists(artistHash)
      ])

      currentArtist.value = info
      similarArtists.value = similar
    } catch (e) {
      detailError.value = e instanceof Error ? e.message : 'Failed to load artist'
      throw e
    } finally {
      isLoadingDetail.value = false
    }
  }

  async function navigateToSimilarArtist(artistHash: string): Promise<void> {
    await loadArtistDetail(artistHash, true)
  }

  async function navigateBack(): Promise<void> {
    if (artistStack.value.length === 0) return

    const previousHash = artistStack.value.pop()!
    await loadArtistDetail(previousHash, false)
  }

  function setSortOption(option: ArtistSortOption, reverse: boolean = false): void {
    sortBy.value = option
    sortReverse.value = reverse
    loadArtists(true)
  }

  async function toggleArtistFavorite(artist: Artist): Promise<void> {
    try {
      await toggleFavorite(artist.artisthash, 'artist', false)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to toggle favorite'
    }
  }

  function clearDetail(): void {
    currentArtist.value = null
    similarArtists.value = []
    artistStack.value = []
    detailError.value = null
  }

  function refresh(): void {
    loadArtists(true)
  }

  function reset(): void {
    artists.value = []
    isLoading.value = false
    error.value = null
    totalArtists.value = 0
    currentPage.value = 0
    pageSize.value = 50
    sortBy.value = 'name'
    sortReverse.value = false
    currentArtist.value = null
    similarArtists.value = []
    isLoadingDetail.value = false
    detailError.value = null
    artistStack.value = []
  }

  return {
    // State
    artists,
    isLoading,
    error,
    totalArtists,
    sortBy,
    sortReverse,
    currentArtist,
    similarArtists,
    isLoadingDetail,
    detailError,
    artistStack,
    // Computed
    hasMore,
    canGoBack,
    // Actions
    loadArtists,
    loadMore,
    loadArtistDetail,
    navigateToSimilarArtist,
    navigateBack,
    setSortOption,
    toggleArtistFavorite,
    clearDetail,
    refresh,
    reset
  }
})
