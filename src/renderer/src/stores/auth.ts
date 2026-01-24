import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { AxiosError } from 'axios'
import type { User } from '@/api/types'
import * as authApi from '@/api/auth'
import apiClient, { getAccessToken, getBaseUrl, clearTokens, clearBaseUrl } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const users = ref<User[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const serverUrl = ref<string | null>(getBaseUrl())
  const hasToken = ref<boolean>(!!getAccessToken())

  // Computed
  const isAuthenticated = computed(() => hasToken.value && !!user.value)
  const isServerConfigured = computed(() => !!serverUrl.value)

  // Actions
  async function fetchUsers(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      users.value = await authApi.getUsers()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch users'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function login(username: string, password: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const { user: loggedInUser } = await authApi.login({ username, password })
      user.value = loggedInUser
      hasToken.value = true
      localStorage.setItem('swing_user', JSON.stringify(loggedInUser))
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Login failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function loginWithQrCode(code: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const { user: loggedInUser } = await authApi.pairWithQrCode(code)
      user.value = loggedInUser
      hasToken.value = true
      localStorage.setItem('swing_user', JSON.stringify(loggedInUser))
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'QR code login failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function validateServer(url: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      const isValid = await authApi.validateAndSetBaseUrl(url)
      if (isValid) {
        serverUrl.value = getBaseUrl()
      } else {
        error.value = 'Could not connect to server'
      }
      return isValid
    } catch (e: unknown) {
      // Provide more specific error messages
      const axiosError = e as AxiosError
      if (axiosError.code === 'ERR_NETWORK' || axiosError.code === 'ERR_NAME_NOT_RESOLVED') {
        error.value = 'Cannot reach server. Check the URL and your network connection.'
      } else if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
        error.value = 'Connection timed out. Server may be unreachable.'
      } else if (axiosError.response?.status === 404) {
        error.value = 'Not a Swing Music server (endpoint not found)'
      } else if (axiosError.response?.status) {
        error.value = `Server error: ${axiosError.response.status}`
      } else if (e instanceof Error) {
        error.value = `Connection failed: ${e.message}`
      } else {
        error.value = 'Failed to connect to server'
      }
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function logout(): Promise<void> {
    await reset({ preserveServer: true })
  }

  async function clearServer(): Promise<void> {
    await reset()
  }

  async function reset(options?: { preserveServer?: boolean }): Promise<void> {
    const preserveServer = options?.preserveServer ?? false
    const existingBaseUrl = getBaseUrl()

    user.value = null
    users.value = []
    isLoading.value = false
    error.value = null
    hasToken.value = false
    serverUrl.value = preserveServer ? existingBaseUrl : null

    if (preserveServer && existingBaseUrl) {
      // keep the base url applied to axios defaults
      // ensures the next login reuses the same server without revalidating
      apiClient.defaults.baseURL = existingBaseUrl
    } else {
      clearBaseUrl()
    }

    clearTokens()
    localStorage.removeItem('swing_user')

    // clear electron's internal cookie store via IPC
    if (window.api?.clearSessionCookies) {
      await window.api.clearSessionCookies()
    }

    // clear any cached data that might be stale
    localStorage.removeItem('player_queue')
    localStorage.removeItem('swing_albums_cache')
    localStorage.removeItem('swing_artists_cache')

    if (!preserveServer) {
      localStorage.removeItem('swing_base_url')
    }
  }

  function restoreSession(): boolean {
    const storedUser = localStorage.getItem('swing_user')
    const token = getAccessToken()
    serverUrl.value = getBaseUrl()
    hasToken.value = !!token

    if (storedUser && token) {
      try {
        user.value = JSON.parse(storedUser)
        return true
      } catch {
        return false
      }
    }
    return false
  }

  // validates the stored session against the server
  // if the token is invalid or expired, clears all stale state
  async function validateSession(): Promise<boolean> {
    const token = getAccessToken()
    const baseUrl = getBaseUrl()

    // no token or server configured, nothing to validate
    if (!token || !baseUrl) {
      return false
    }

    try {
      // make a lightweight authenticated request to check token validity
      // using the users endpoint which requires auth
      await apiClient.get('/auth/users')
      return true
    } catch (e) {
      const axiosError = e as import('axios').AxiosError

      // 401 means the token is invalid/expired and refresh also failed
      // (the interceptor already tried to refresh)
      if (axiosError.response?.status === 401) {
        await clearStaleSession()
        return false
      }

      // network errors might just mean server is down, not that session is invalid
      // only clear session for auth-specific failures
      if (axiosError.response?.status === 403) {
        await clearStaleSession()
        return false
      }

      // for other errors (network, timeout), keep the session intact
      // the user might just be offline temporarily
      return false
    }
  }

  // clears all stale session data including cookies
  async function clearStaleSession(): Promise<void> {
    // clear tokens from localStorage (also clears document.cookie)
    clearTokens()

    // clear electron's internal cookie store via IPC
    if (window.api?.clearSessionCookies) {
      await window.api.clearSessionCookies()
    }

    // clear user data
    localStorage.removeItem('swing_user')

    // clear any cached data that might be stale
    localStorage.removeItem('player_queue')
    localStorage.removeItem('swing_albums_cache')
    localStorage.removeItem('swing_artists_cache')

    // reset store state but preserve server url so user can re-login
    user.value = null
    users.value = []
    hasToken.value = false
    error.value = null
  }

  return {
    // State
    user,
    users,
    isLoading,
    error,
    serverUrl,
    hasToken,
    // Computed
    isAuthenticated,
    isServerConfigured,
    // Actions
    fetchUsers,
    login,
    loginWithQrCode,
    validateServer,
    validateSession,
    logout,
    clearServer,
    reset,
    restoreSession
  }
})
