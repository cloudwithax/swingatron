import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Token storage keys
const ACCESS_TOKEN_KEY = 'swing_access_token'
const REFRESH_TOKEN_KEY = 'swing_refresh_token'
const BASE_URL_KEY = 'swing_base_url'

// ============================================
// Token Management
// ============================================

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

/**
 * Set a cookie for the access token so that browser media requests (audio/video)
 * can authenticate without custom headers
 */
function setAccessTokenCookie(token: string): void {
  // Set cookie for the current domain, allowing it to be sent with requests
  document.cookie = `access_token_cookie=${token}; path=/; SameSite=Lax`
}

/**
 * Clear the access token cookie
 */
function clearAccessTokenCookie(): void {
  document.cookie = 'access_token_cookie=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  // Also set cookie for media requests
  setAccessTokenCookie(accessToken)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  clearAccessTokenCookie()
}

export function getBaseUrl(): string | null {
  return localStorage.getItem(BASE_URL_KEY)
}

export function setBaseUrl(url: string): void {
  // Ensure URL ends with /
  const normalizedUrl = url.endsWith('/') ? url : `${url}/`
  localStorage.setItem(BASE_URL_KEY, normalizedUrl)
  apiClient.defaults.baseURL = normalizedUrl
}

export function clearBaseUrl(): void {
  localStorage.removeItem(BASE_URL_KEY)
  apiClient.defaults.baseURL = undefined
}

// ============================================
// Request Interceptor - Add Auth Header
// ============================================

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Set base URL if available
    const baseUrl = getBaseUrl()
    if (baseUrl && !config.baseURL) {
      config.baseURL = baseUrl
    }

    // Add auth token if available
    const token = getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// ============================================
// Response Interceptor - Handle Token Refresh
// ============================================

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // If 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request while refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        clearTokens()
        processQueue(error, null)
        isRefreshing = false
        // Redirect to login
        window.location.href = '/#/login'
        return Promise.reject(error)
      }

      try {
        const response = await axios.post(
          `${getBaseUrl()}auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshToken}`
            }
          }
        )

        const { accesstoken, refreshtoken: newRefreshToken } = response.data
        setTokens(accesstoken, newRefreshToken)

        processQueue(null, accesstoken)
        isRefreshing = false

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accesstoken}`
        }
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null)
        isRefreshing = false
        clearTokens()
        // Redirect to login
        window.location.href = '/#/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

// ============================================
// URL Helpers
// ============================================

/**
 * Get the streaming URL for a track
 */
export function getTrackStreamUrl(trackHash: string, filepath: string): string {
  const baseUrl = getBaseUrl() || ''
  const encodedPath = encodeURIComponent(filepath)
  return `${baseUrl}file/${trackHash}/legacy?filepath=${encodedPath}`
}

/**
 * Fetch an authenticated audio stream and return a blob URL
 * This is needed because HTMLAudioElement can't send custom Authorization headers
 */
export async function fetchAuthenticatedAudioUrl(
  trackHash: string,
  filepath: string,
  signal?: AbortSignal
): Promise<string> {
  const url = getTrackStreamUrl(trackHash, filepath)
  const token = getAccessToken()

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`)
  }

  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

/**
 * Get the thumbnail URL for an image
 */
export function getThumbnailUrl(
  image: string,
  size: 'xsmall' | 'small' | 'medium' | 'large' = 'medium'
): string {
  const baseUrl = getBaseUrl() || ''
  if (!image) return ''

  // server endpoints:
  // /img/thumbnail/<img> = large (512px)
  // /img/thumbnail/medium/<img> = medium (256px)
  // /img/thumbnail/small/<img> = small (96px)
  // /img/thumbnail/xsmall/<img> = xsmall (64px)
  if (size === 'large') {
    return `${baseUrl}img/thumbnail/${image}`
  }
  return `${baseUrl}img/thumbnail/${size}/${image}`
}

/**
 * Get the artist image URL
 */
export function getArtistImageUrl(image: string): string {
  const baseUrl = getBaseUrl() || ''
  if (!image) return ''
  return `${baseUrl}img/artist/${image}`
}

/**
 * Get the playlist image URL
 */
export function getPlaylistImageUrl(image: string | null | undefined): string {
  const baseUrl = getBaseUrl() || ''
  // handle null, undefined, empty string, or python's "None" string
  if (!image || image === 'None') return ''
  return `${baseUrl}img/playlist/${image}`
}

/**
 * Fetch lyrics for a track
 */
export async function fetchLyrics(
  trackhash: string,
  filepath: string
): Promise<{
  lyrics: Array<{ time: number; text: string }> | string[]
  synced: boolean
  copyright?: string
} | null> {
  try {
    const response = await apiClient.post('/lyrics', { trackhash, filepath })
    return response.data
  } catch {
    return null
  }
}

/**
 * Search and download lyrics from online sources (Musixmatch plugin)
 */
export async function searchAndDownloadLyrics(
  trackhash: string,
  title: string,
  artist: string,
  album: string,
  filepath: string
): Promise<{
  trackhash: string
  lyrics: Array<{ time: number; text: string }> | string | null
} | null> {
  try {
    const response = await apiClient.post('/plugins/lyrics/search', {
      trackhash,
      title,
      artist,
      album,
      filepath
    })
    return response.data
  } catch {
    return null
  }
}

/**
 * Trigger a library scan on the server
 */
export async function triggerLibraryScan(): Promise<void> {
  await apiClient.get('/notsettings/trigger-scan')
}

export default apiClient
