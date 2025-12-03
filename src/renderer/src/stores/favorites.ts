import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Track, Album, Artist, FavoritesCount, RecentFavoriteItem } from '@/api/types'
import { getFavorites, toggleFavorite } from '@/api/favorites'

export const useFavoritesStore = defineStore('favorites', () => {
  // state
  const tracks = ref<Track[]>([])
  const albums = ref<Album[]>([])
  const artists = ref<Artist[]>([])
  const recents = ref<RecentFavoriteItem[]>([])
  const count = ref<FavoritesCount>({ tracks: 0, albums: 0, artists: 0 })
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // active tab for the view
  const activeTab = ref<'tracks' | 'albums' | 'artists' | 'recents'>('tracks')

  // computed
  const totalFavorites = computed(
    () => count.value.tracks + count.value.albums + count.value.artists
  )
  const hasFavorites = computed(() => totalFavorites.value > 0)

  // actions
  async function loadFavorites(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await getFavorites({
        track_limit: 100,
        album_limit: 100,
        artist_limit: 100
      })

      tracks.value = response.tracks
      albums.value = response.albums
      artists.value = response.artists
      recents.value = response.recents
      count.value = response.count
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load favorites'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function removeTrackFavorite(track: Track): Promise<void> {
    try {
      await toggleFavorite(track.trackhash, 'track', false)

      // remove from local state
      tracks.value = tracks.value.filter((t) => t.trackhash !== track.trackhash)
      recents.value = recents.value.filter(
        (r) => !(r.type === 'track' && r.item.trackhash === track.trackhash)
      )
      count.value.tracks = Math.max(0, count.value.tracks - 1)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to remove favorite'
    }
  }

  async function removeAlbumFavorite(album: Album): Promise<void> {
    try {
      await toggleFavorite(album.albumhash, 'album', false)

      // remove from local state
      albums.value = albums.value.filter((a) => a.albumhash !== album.albumhash)
      count.value.albums = Math.max(0, count.value.albums - 1)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to remove favorite'
    }
  }

  async function removeArtistFavorite(artist: Artist): Promise<void> {
    try {
      await toggleFavorite(artist.artisthash, 'artist', false)

      // remove from local state
      artists.value = artists.value.filter((a) => a.artisthash !== artist.artisthash)
      count.value.artists = Math.max(0, count.value.artists - 1)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to remove favorite'
    }
  }

  function setActiveTab(tab: 'tracks' | 'albums' | 'artists' | 'recents'): void {
    activeTab.value = tab
  }

  function refresh(): void {
    loadFavorites()
  }

  function clear(): void {
    tracks.value = []
    albums.value = []
    artists.value = []
    recents.value = []
    count.value = { tracks: 0, albums: 0, artists: 0 }
    error.value = null
  }

  return {
    // state
    tracks,
    albums,
    artists,
    recents,
    count,
    isLoading,
    error,
    activeTab,
    // computed
    totalFavorites,
    hasFavorites,
    // actions
    loadFavorites,
    removeTrackFavorite,
    removeAlbumFavorite,
    removeArtistFavorite,
    setActiveTab,
    refresh,
    clear
  }
})
