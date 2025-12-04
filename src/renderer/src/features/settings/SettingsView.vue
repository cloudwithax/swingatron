<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getBaseUrl, triggerLibraryScan } from '@/api/client'
import { fetchSettings } from '@/api/settings'
import { fetchLastfmToken, createLastfmSession, deleteLastfmSession } from '@/api/lastfm'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

// scan state
const isScanning = ref(false)

// Settings state
const serverUrl = ref('')
const theme = ref<'system' | 'light' | 'dark'>('system')
const showBitrate = ref(true)
const confirmBeforeClose = ref(true)
const lastfmApiKey = ref('')
const lastfmApiSecret = ref('')
const lastfmSessionKey = ref('')
const lastfmToken = ref('')
const lastfmIntegrationStarted = ref(false)
const isLastfmBusy = ref(false)

// Version info
const appVersion = ref('1.0.0')

// Load settings on mount
onMounted(() => {
  loadSettings()
  loadServerSettings()
})

function loadSettings(): void {
  const baseUrl = getBaseUrl()
  if (baseUrl) {
    serverUrl.value = baseUrl.replace(/\/$/, '')
  }

  // Load from localStorage
  theme.value = (localStorage.getItem('swing_theme') as typeof theme.value) || 'system'
  showBitrate.value = localStorage.getItem('swing_show_bitrate') !== 'false'
  confirmBeforeClose.value = localStorage.getItem('swing_confirm_close') !== 'false'
  applyTheme()
}

async function loadServerSettings(): Promise<void> {
  if (!serverUrl.value) {
    return
  }

  try {
    const settings = await fetchSettings()
    lastfmApiKey.value = settings.lastfmApiKey || ''
    lastfmApiSecret.value = settings.lastfmApiSecret || ''
    lastfmSessionKey.value = settings.lastfmSessionKey || ''
  } catch {
    toast.show('Failed to load server settings', { type: 'error' })
  }
}

function saveSettings(): void {
  localStorage.setItem('swing_theme', theme.value)
  localStorage.setItem('swing_show_bitrate', String(showBitrate.value))
  localStorage.setItem('swing_confirm_close', String(confirmBeforeClose.value))

  // Apply theme
  applyTheme()
}

function applyTheme(): void {
  const root = document.documentElement
  if (theme.value === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
  } else if (theme.value === 'light') {
    root.classList.remove('dark')
    root.classList.add('light')
  } else {
    root.classList.remove('dark', 'light')
    // System preference will be handled by CSS media query
  }
}

function handleLogout(): void {
  authStore.logout()
  router.push('/login')
}

function handleClearCache(): void {
  // Clear any cached data
  localStorage.removeItem('swing_albums_cache')
  localStorage.removeItem('swing_artists_cache')
  toast.show('Cache cleared successfully', { type: 'success' })
}

async function handleScanLibrary(): Promise<void> {
  if (isScanning.value) return

  isScanning.value = true
  try {
    await triggerLibraryScan()
    toast.show('Library scan triggered', { type: 'success' })
  } catch {
    toast.show('Failed to trigger library scan', { type: 'error' })
  } finally {
    isScanning.value = false
  }
}

async function startLastfmAuth(): Promise<void> {
  if (!lastfmApiKey.value || !lastfmApiSecret.value) {
    toast.show('Missing Last.fm credentials from the server', { type: 'error' })
    return
  }

  isLastfmBusy.value = true
  try {
    const token = await fetchLastfmToken(lastfmApiKey.value, lastfmApiSecret.value)
    lastfmToken.value = token
    const authUrl = `https://www.last.fm/api/auth/?api_key=${lastfmApiKey.value}&token=${token}`
    window.open(authUrl, '_blank', 'noopener')
    lastfmIntegrationStarted.value = true
    toast.show('Authorize in your browser, then click finish', { type: 'success' })
  } catch {
    toast.show('Unable to start Last.fm authorization', { type: 'error' })
  } finally {
    isLastfmBusy.value = false
  }
}

async function finishLastfmAuth(): Promise<void> {
  if (!lastfmToken.value) {
    toast.show('No pending Last.fm authorization found', { type: 'error' })
    return
  }

  isLastfmBusy.value = true
  try {
    const sessionKey = await createLastfmSession(lastfmToken.value)
    lastfmSessionKey.value = sessionKey || ''
    lastfmIntegrationStarted.value = false
    lastfmToken.value = ''
    toast.show('Last.fm connected', { type: 'success' })
  } catch {
    toast.show('Failed to finalize Last.fm connection', { type: 'error' })
  } finally {
    isLastfmBusy.value = false
  }
}

async function disconnectLastfm(): Promise<void> {
  isLastfmBusy.value = true
  try {
    await deleteLastfmSession()
    lastfmSessionKey.value = ''
    lastfmIntegrationStarted.value = false
    lastfmToken.value = ''
    toast.show('Disconnected from Last.fm', { type: 'success' })
  } catch {
    toast.show('Failed to disconnect Last.fm', { type: 'error' })
  } finally {
    isLastfmBusy.value = false
  }
}

async function handleLastfmAction(): Promise<void> {
  if (!serverUrl.value) {
    toast.show('Set your server before configuring Last.fm', { type: 'error' })
    return
  }

  if (lastfmIntegrationStarted.value) {
    await finishLastfmAuth()
    return
  }

  if (lastfmSessionKey.value) {
    await disconnectLastfm()
    return
  }

  await startLastfmAuth()
}

const isLastfmConnected = computed(() => Boolean(lastfmSessionKey.value))

const lastfmButtonText = computed(() => {
  if (lastfmIntegrationStarted.value) {
    return 'Finish'
  }
  if (isLastfmConnected.value) {
    return 'Disconnect'
  }
  return 'Connect'
})

const lastfmStatusText = computed(() => {
  if (!serverUrl.value) {
    return 'Set your server to configure Last.fm scrobbling'
  }
  if (lastfmIntegrationStarted.value) {
    return 'Authorize in the browser, then click finish'
  }
  if (isLastfmConnected.value) {
    return 'Connected to Last.fm scrobbling'
  }
  return 'Connect to scrobble plays to Last.fm'
})

function goBack(): void {
  router.back()
}
</script>

<template>
  <div class="settings-view">
    <!-- Back Button -->
    <button class="back-btn" @click="goBack">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
      </svg>
    </button>

    <h1 class="view-title">Settings</h1>

    <!-- Account Section -->
    <section class="settings-section">
      <h2 class="section-title">Account</h2>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Logged in as</div>
          <div class="settings-item-value">{{ authStore.user?.username || 'Unknown' }}</div>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Server</div>
          <div class="settings-item-value">{{ serverUrl || 'Not configured' }}</div>
        </div>
      </div>

      <button class="settings-btn danger" @click="handleLogout">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
          />
        </svg>
        Sign Out
      </button>
    </section>

    <!-- Integrations -->
    <section class="settings-section">
      <h2 class="section-title">Integrations</h2>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Last.fm</div>
          <div class="settings-item-description">{{ lastfmStatusText }}</div>
          <div v-if="lastfmIntegrationStarted" class="settings-item-helper">
            after approving in your browser click finish to save the session
          </div>
        </div>

        <button
          class="settings-btn"
          :disabled="isLastfmBusy || !lastfmApiKey"
          @click="handleLastfmAction"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.381 1.704-4.591 3.381-4.591 2.476 0 3.265 1.596 3.927 3.646l.88 2.75c.88 2.668 2.53 4.81 7.285 4.81 3.41 0 5.722-1.044 5.722-3.795 0-2.227-1.267-3.38-3.633-3.932l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.594 0-.935.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.602l1.87.44c1.402.33 1.869.825 1.869 1.68 0 1.045-1.073 1.485-3.105 1.485-3.018 0-4.278-1.58-5.02-3.742l-.905-2.75c-1.156-3.573-3.018-4.591-6.647-4.591C2.093 6.26 0 8.78 0 12.476 0 16.063 2.012 18.5 5.96 18.5c3.079 0 4.624-1.29 4.624-1.29z"
            />
          </svg>
          {{ lastfmButtonText }}
        </button>
      </div>
    </section>

    <!-- Appearance Section -->
    <section class="settings-section">
      <h2 class="section-title">Appearance</h2>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Theme</div>
          <div class="settings-item-description">Choose your preferred color scheme</div>
        </div>
        <select v-model="theme" class="settings-select" @change="saveSettings">
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Show bitrate indicator</div>
          <div class="settings-item-description">Display audio quality badge on tracks</div>
        </div>
        <label class="toggle">
          <input v-model="showBitrate" type="checkbox" @change="saveSettings" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </section>

    <!-- Application Section -->
    <section class="settings-section">
      <h2 class="section-title">Application</h2>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Confirm before closing</div>
          <div class="settings-item-description">Ask before closing the application</div>
        </div>
        <label class="toggle">
          <input v-model="confirmBeforeClose" type="checkbox" @change="saveSettings" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <button class="settings-btn" @click="handleClearCache">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
        </svg>
        Clear Cache
      </button>

      <button class="settings-btn" :disabled="isScanning" @click="handleScanLibrary">
        <svg :class="{ spinning: isScanning }" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
          />
        </svg>
        {{ isScanning ? 'Scanning...' : 'Scan Library' }}
      </button>
    </section>

    <!-- About Section -->
    <section class="settings-section">
      <h2 class="section-title">About</h2>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Swingatron</div>
          <div class="settings-item-value">Version {{ appVersion }}</div>
          <div class="settings-item-value">
            Made with ❤️ by
            <a
              href="https://github.com/cloudwithax"
              target="_blank"
              rel="noopener"
              class="settings-link-alt"
              >clxud</a
            >
          </div>
          <a
            href="https://github.com/cloudwithax/swingatron"
            target="_blank"
            rel="noopener"
            class="settings-link-alt"
            >View Source</a
          >
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-view {
  padding: 16px;
  padding-bottom: 80px;
  height: 100%;
  overflow-y: auto;
}

.back-btn {
  position: sticky;
  top: 0;
  z-index: 10;
  width: 40px;
  height: 40px;
  padding: 8px;
  background-color: var(--color-surface);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-on-surface);
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.back-btn:hover {
  background-color: var(--color-surface-variant);
}

.back-btn svg {
  width: 100%;
  height: 100%;
}

.view-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0 0 24px;
}

.settings-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 16px;
}

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-outline-variant);
}

.settings-item:last-child {
  border-bottom: none;
}

.settings-item-info {
  flex: 1;
  min-width: 0;
}

.settings-item-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--color-on-surface);
  margin-bottom: 2px;
}

.settings-item-value {
  font-size: 13px;
  color: var(--color-on-surface-variant);
}

.settings-item-description {
  font-size: 13px;
  color: var(--color-on-surface-variant);
}

.settings-item-helper {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

.settings-select {
  padding: 8px 12px;
  background-color: var(--color-surface-variant);
  border: 1px solid var(--color-outline);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-on-surface);
  cursor: pointer;
  min-width: 120px;
}

.settings-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* Toggle Switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 28px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--color-surface-variant);
  border-radius: 14px;
  transition: 0.3s;
}

.toggle-slider:before {
  position: absolute;
  content: '';
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: var(--color-on-surface-variant);
  border-radius: 50%;
  transition: 0.3s;
}

.toggle input:checked + .toggle-slider {
  background-color: var(--color-primary);
}

.toggle input:checked + .toggle-slider:before {
  transform: translateX(20px);
  background-color: var(--color-on-primary);
}

.settings-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background-color: var(--color-surface-variant);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-on-surface);
  cursor: pointer;
  transition: all 0.15s ease;
  margin-top: 16px;
}

.settings-btn:hover {
  background-color: var(--color-outline);
}

.settings-btn svg {
  width: 20px;
  height: 20px;
}

.settings-btn.danger {
  background-color: var(--color-error-container);
  color: var(--color-on-error-container);
}

.settings-btn.danger:hover {
  background-color: var(--color-error);
  color: var(--color-on-error);
}

.settings-link {
  font-size: 13px;
  color: var(--color-primary);
  text-decoration: none;
}

.settings-link-alt {
  font-size: 13px;
  color: var(--color-on-surface-variant);
  text-decoration: none;
}

.settings-link-alt:hover {
  text-decoration: underline;
}

.settings-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spinning {
  animation: spin 1s linear infinite;
}
</style>
