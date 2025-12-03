import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { HomeSection, HomeItem } from '@/api/types'
import * as homeApi from '@/api/home'

export const useHomeStore = defineStore('home', () => {
  // state
  const recentlyPlayed = ref<HomeSection | null>(null)
  const recentlyAdded = ref<HomeSection | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // computed
  const recentlyPlayedItems = computed<HomeItem[]>(() => {
    return recentlyPlayed.value?.items || []
  })

  const recentlyAddedItems = computed<HomeItem[]>(() => {
    return recentlyAdded.value?.items || []
  })

  const hasRecentlyPlayed = computed(() => recentlyPlayedItems.value.length > 0)
  const hasRecentlyAdded = computed(() => recentlyAddedItems.value.length > 0)

  // actions
  async function fetchHome(limit: number = 7): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await homeApi.getHome(limit)

      // parse the response array to extract sections
      for (const section of response) {
        if (section.recently_played) {
          recentlyPlayed.value = section.recently_played
        }
        if (section.recently_added) {
          recentlyAdded.value = section.recently_added
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch home data'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function clear(): void {
    recentlyPlayed.value = null
    recentlyAdded.value = null
    error.value = null
  }

  return {
    // state
    recentlyPlayed,
    recentlyAdded,
    isLoading,
    error,
    // computed
    recentlyPlayedItems,
    recentlyAddedItems,
    hasRecentlyPlayed,
    hasRecentlyAdded,
    // actions
    fetchHome,
    clear
  }
})
