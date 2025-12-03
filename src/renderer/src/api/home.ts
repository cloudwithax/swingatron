import apiClient from './client'
import type { HomeResponse } from './types'

/**
 * fetch home page data including recently played and recently added sections
 */
export async function getHome(limit: number = 7): Promise<HomeResponse[]> {
  const response = await apiClient.get<HomeResponse[]>('/nothome/', {
    params: { limit }
  })
  return response.data
}
