import apiClient from './client'
import type { FavoriteRequest, FavoritesResponse, FavoritesRequestParams } from './types'

/**
 * Get all favorites (tracks, albums, artists)
 */
export async function getFavorites(
  params: FavoritesRequestParams = {}
): Promise<FavoritesResponse> {
  const response = await apiClient.get<FavoritesResponse>('/favorites', {
    params: {
      track_limit: params.track_limit ?? 50,
      album_limit: params.album_limit ?? 50,
      artist_limit: params.artist_limit ?? 50
    }
  })
  return response.data
}

/**
 * Add item to favorites
 */
export async function addFavorite(request: FavoriteRequest): Promise<void> {
  await apiClient.post('/favorites/add', request)
}

/**
 * Remove item from favorites
 */
export async function removeFavorite(request: FavoriteRequest): Promise<void> {
  await apiClient.post('/favorites/remove', request)
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(
  hash: string,
  type: 'track' | 'album' | 'artist',
  addToFavorites: boolean
): Promise<boolean> {
  if (addToFavorites) {
    await addFavorite({ hash, type })
    return true
  } else {
    await removeFavorite({ hash, type })
    return false
  }
}
