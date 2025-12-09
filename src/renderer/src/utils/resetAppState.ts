// resets all app state and persistence before returning to setup
import {
  useAlbumStore,
  useArtistStore,
  useAuthStore,
  useFavoritesStore,
  useFolderStore,
  useHomeStore,
  usePlayerStore,
  usePlaylistStore,
  useSearchStore,
  useStatsStore
} from '@/stores'

interface ResetOptions {
  preserveServer?: boolean
}

export function resetAppState(options?: ResetOptions): void {
  const preserveServer = options?.preserveServer ?? false

  const authStore = useAuthStore()
  const playerStore = usePlayerStore()
  const homeStore = useHomeStore()
  const favoritesStore = useFavoritesStore()
  const searchStore = useSearchStore()
  const statsStore = useStatsStore()
  const albumStore = useAlbumStore()
  const artistStore = useArtistStore()
  const playlistStore = usePlaylistStore()
  const folderStore = useFolderStore()

  playerStore.reset()
  albumStore.reset()
  artistStore.reset()
  playlistStore.reset()
  folderStore.reset()
  homeStore.clear()
  favoritesStore.clear()
  searchStore.clear()
  statsStore.reset()
  authStore.reset({ preserveServer })

  const keysToClear = [
    'player_queue',
    'swing_albums_cache',
    'swing_artists_cache',
    'swing_access_token',
    'swing_refresh_token',
    'swing_user'
  ]

  if (!preserveServer) {
    keysToClear.push('swing_base_url')
  }

  for (const key of keysToClear) {
    localStorage.removeItem(key)
  }
}
