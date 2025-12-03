import apiClient from './client'
import type { Artist, ArtistInfo, PaginatedRequest, SimilarArtist, Track } from './types'

interface ArtistsResponse {
  items: Artist[] // API uses 'items' not 'artists'
  total: number
}

/**
 * Get paginated artists
 */
export async function getArtists(
  params: PaginatedRequest
): Promise<{ artists: Artist[]; total: number }> {
  const response = await apiClient.get<ArtistsResponse>('/getall/artists', {
    params: {
      start: params.start,
      limit: params.limit,
      sortby: params.sortBy || 'name',
      reverse: params.reverse ?? false
    }
  })
  // Transform items to artists for internal use
  return {
    artists: response.data.items || [],
    total: response.data.total
  }
}

/**
 * Get artist info with albums and tracks
 */
export async function getArtistInfo(
  artistHash: string,
  trackLimit: number = -1
): Promise<ArtistInfo> {
  const response = await apiClient.get<ArtistInfo>(`/artist/${artistHash}`, {
    params: {
      tracklimit: trackLimit,
      all: true
    }
  })
  return response.data
}

/**
 * Get similar artists
 */
export async function getSimilarArtists(artistHash: string): Promise<SimilarArtist[]> {
  const response = await apiClient.get<SimilarArtist[]>(`/artist/${artistHash}/similar`)
  return response.data
}

/**
 * Get artist tracks
 */
export async function getArtistTracks(artistHash: string): Promise<Track[]> {
  const response = await apiClient.get<Track[]>(`/artist/${artistHash}/tracks`)
  return response.data
}
