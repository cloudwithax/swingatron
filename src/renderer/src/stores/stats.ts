// stats store
// manages state for listening statistics and charts

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ChartDuration,
  ChartOrderBy,
  ChartTrack,
  ChartArtist,
  ChartAlbum,
  ChartScrobbleSummary,
  StatItem
} from '@renderer/api/types'
import { getTopTracks, getTopArtists, getTopAlbums, getStats } from '@renderer/api/stats'

export const useStatsStore = defineStore('stats', () => {
  // state
  const topTracks = ref<ChartTrack[]>([])
  const topArtists = ref<ChartArtist[]>([])
  const topAlbums = ref<ChartAlbum[]>([])
  const weeklyStats = ref<StatItem[]>([])

  const tracksScrobbles = ref<ChartScrobbleSummary | null>(null)
  const artistsScrobbles = ref<ChartScrobbleSummary | null>(null)
  const albumsScrobbles = ref<ChartScrobbleSummary | null>(null)
  const statsDates = ref<string>('')

  const isLoadingTracks = ref(false)
  const isLoadingArtists = ref(false)
  const isLoadingAlbums = ref(false)
  const isLoadingStats = ref(false)
  const error = ref<string | null>(null)

  const duration = ref<ChartDuration>('year')
  const orderBy = ref<ChartOrderBy>('playduration')
  const limit = ref(20)

  // computed
  const isLoading = computed(
    () =>
      isLoadingTracks.value ||
      isLoadingArtists.value ||
      isLoadingAlbums.value ||
      isLoadingStats.value
  )

  const hasData = computed(
    () => topTracks.value.length > 0 || topArtists.value.length > 0 || topAlbums.value.length > 0
  )

  // actions
  async function loadTopTracks(): Promise<void> {
    isLoadingTracks.value = true
    error.value = null

    try {
      const response = await getTopTracks({
        duration: duration.value,
        limit: limit.value,
        orderBy: orderBy.value
      })
      topTracks.value = response.tracks
      tracksScrobbles.value = response.scrobbles
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load top tracks'
      throw e
    } finally {
      isLoadingTracks.value = false
    }
  }

  async function loadTopArtists(): Promise<void> {
    isLoadingArtists.value = true
    error.value = null

    try {
      const response = await getTopArtists({
        duration: duration.value,
        limit: limit.value,
        orderBy: orderBy.value
      })
      topArtists.value = response.artists
      artistsScrobbles.value = response.scrobbles
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load top artists'
      throw e
    } finally {
      isLoadingArtists.value = false
    }
  }

  async function loadTopAlbums(): Promise<void> {
    isLoadingAlbums.value = true
    error.value = null

    try {
      const response = await getTopAlbums({
        duration: duration.value,
        limit: limit.value,
        orderBy: orderBy.value
      })
      topAlbums.value = response.albums
      albumsScrobbles.value = response.scrobbles
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load top albums'
      throw e
    } finally {
      isLoadingAlbums.value = false
    }
  }

  async function loadWeeklyStats(): Promise<void> {
    isLoadingStats.value = true
    error.value = null

    try {
      const response = await getStats()
      weeklyStats.value = response.stats
      statsDates.value = response.dates
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load stats'
      throw e
    } finally {
      isLoadingStats.value = false
    }
  }

  // load all chart data at once
  async function loadAllCharts(): Promise<void> {
    await Promise.all([loadTopTracks(), loadTopArtists(), loadTopAlbums()])
  }

  // load everything including weekly stats
  async function loadAll(): Promise<void> {
    await Promise.all([loadTopTracks(), loadTopArtists(), loadTopAlbums(), loadWeeklyStats()])
  }

  // update settings and reload
  function setDuration(newDuration: ChartDuration): void {
    if (duration.value !== newDuration) {
      duration.value = newDuration
      loadAllCharts()
    }
  }

  function setOrderBy(newOrderBy: ChartOrderBy): void {
    if (orderBy.value !== newOrderBy) {
      orderBy.value = newOrderBy
      loadAllCharts()
    }
  }

  function setLimit(newLimit: number): void {
    if (limit.value !== newLimit) {
      limit.value = newLimit
      loadAllCharts()
    }
  }

  function reset(): void {
    topTracks.value = []
    topArtists.value = []
    topAlbums.value = []
    weeklyStats.value = []
    tracksScrobbles.value = null
    artistsScrobbles.value = null
    albumsScrobbles.value = null
    statsDates.value = ''
    error.value = null
  }

  return {
    // state
    topTracks,
    topArtists,
    topAlbums,
    weeklyStats,
    tracksScrobbles,
    artistsScrobbles,
    albumsScrobbles,
    statsDates,
    isLoadingTracks,
    isLoadingArtists,
    isLoadingAlbums,
    isLoadingStats,
    isLoading,
    hasData,
    error,
    duration,
    orderBy,
    limit,

    // actions
    loadTopTracks,
    loadTopArtists,
    loadTopAlbums,
    loadWeeklyStats,
    loadAllCharts,
    loadAll,
    setDuration,
    setOrderBy,
    setLimit,
    reset
  }
})
