import apiClient, { setTokens, setBaseUrl } from './client'
import type {
  User,
  UsersResponse,
  LoginRequest,
  LoginResponse,
  PairResponse,
  RefreshTokenResponse
} from './types'

/**
 * Decode JWT payload to extract user info
 */
function decodeJwtPayload(token: string): User | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload.sub as User
  } catch {
    return null
  }
}

/**
 * Get all users from the server
 */
export async function getUsers(): Promise<User[]> {
  const response = await apiClient.get<UsersResponse>('/auth/users')
  return response.data.users
}

/**
 * Login with username and password
 * Returns both the response and the decoded user
 */
export async function login(
  credentials: LoginRequest
): Promise<{ response: LoginResponse; user: User | null }> {
  const response = await apiClient.post<LoginResponse>('/auth/login', credentials)
  const { accesstoken, refreshtoken } = response.data
  setTokens(accesstoken, refreshtoken)
  const user = decodeJwtPayload(accesstoken)
  return { response: response.data, user }
}

/**
 * Login via QR code pairing
 */
export async function pairWithQrCode(
  code: string
): Promise<{ response: PairResponse; user: User | null }> {
  const response = await apiClient.get<PairResponse>(`/auth/pair?code=${encodeURIComponent(code)}`)
  const { accesstoken, refreshtoken } = response.data
  setTokens(accesstoken, refreshtoken)
  const user = decodeJwtPayload(accesstoken)
  return { response: response.data, user }
}

/**
 * Refresh the access token
 */
export async function refreshToken(refreshTokenValue: string): Promise<RefreshTokenResponse> {
  const response = await apiClient.post<RefreshTokenResponse>(
    '/auth/refresh',
    {},
    {
      headers: {
        Authorization: `Bearer ${refreshTokenValue}`
      }
    }
  )
  const { accesstoken, refreshtoken } = response.data
  setTokens(accesstoken, refreshtoken)
  return response.data
}

/**
 * Validate and set the server base URL
 */
export async function validateAndSetBaseUrl(url: string): Promise<boolean> {
  // Normalize URL
  let normalizedUrl = url.trim()
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `http://${normalizedUrl}`
  }
  if (!normalizedUrl.endsWith('/')) {
    normalizedUrl = `${normalizedUrl}/`
  }

  // Try to fetch users to validate the server
  const response = await apiClient.get<UsersResponse>(`${normalizedUrl}auth/users`)

  if (response.status === 200) {
    setBaseUrl(normalizedUrl)
    return true
  }
  return false
}

/**
 * Logout - clear all tokens and redirect
 */
export function logout(): void {
  localStorage.removeItem('swing_access_token')
  localStorage.removeItem('swing_refresh_token')
  localStorage.removeItem('swing_user')
  window.location.href = '/#/login'
}
