// stats api module
// handles all logger/stats related endpoints for charts and listening statistics

import apiClient from './client'
import type {
  ChartItemsParams,
  TopTracksResponse,
  TopArtistsResponse,
  TopAlbumsResponse,
  StatsResponse
} from './types'

// fetches top tracks for a given time period
export async function getTopTracks(params?: ChartItemsParams): Promise<TopTracksResponse> {
  const response = await apiClient.get<TopTracksResponse>('/logger/top-tracks', {
    params: {
      duration: params?.duration ?? 'year',
      limit: params?.limit ?? 10,
      order_by: params?.orderBy ?? 'playduration'
    }
  })
  return response.data
}

// fetches top artists for a given time period
export async function getTopArtists(params?: ChartItemsParams): Promise<TopArtistsResponse> {
  const response = await apiClient.get<TopArtistsResponse>('/logger/top-artists', {
    params: {
      duration: params?.duration ?? 'year',
      limit: params?.limit ?? 10,
      order_by: params?.orderBy ?? 'playduration'
    }
  })
  return response.data
}

// fetches top albums for a given time period
export async function getTopAlbums(params?: ChartItemsParams): Promise<TopAlbumsResponse> {
  const response = await apiClient.get<TopAlbumsResponse>('/logger/top-albums', {
    params: {
      duration: params?.duration ?? 'year',
      limit: params?.limit ?? 10,
      order_by: params?.orderBy ?? 'playduration'
    }
  })
  return response.data
}

// fetches general listening stats for the current week
export async function getStats(): Promise<StatsResponse> {
  const response = await apiClient.get<StatsResponse>('/logger/stats')
  return response.data
}
