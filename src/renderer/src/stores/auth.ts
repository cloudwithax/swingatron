import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { AxiosError } from 'axios'
import type { User } from '@/api/types'
import * as authApi from '@/api/auth'
import { getAccessToken, getBaseUrl, clearTokens, clearBaseUrl } from '@/api/client'

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

  function logout(): void {
    user.value = null
    hasToken.value = false
    clearTokens()
    localStorage.removeItem('swing_user')
  }

  function clearServer(): void {
    serverUrl.value = null
    clearBaseUrl()
    logout()
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
    logout,
    clearServer,
    restoreSession
  }
})
