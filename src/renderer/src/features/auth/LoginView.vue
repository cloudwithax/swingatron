<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const serverUrl = ref('')
const username = ref('')
const password = ref('')
const step = ref<'server' | 'login'>('server')
const loginMethod = ref<'password' | 'qr'>('password')

onMounted(() => {
  // Check if we already have a server configured
  if (authStore.isServerConfigured) {
    step.value = 'login'
    authStore.fetchUsers()
  }
})

async function handleServerSubmit() {
  if (!serverUrl.value.trim()) return

  const success = await authStore.validateServer(serverUrl.value)
  if (success) {
    step.value = 'login'
    await authStore.fetchUsers()
  }
}

async function handleLogin() {
  if (!username.value.trim() || !password.value.trim()) return

  try {
    await authStore.login(username.value, password.value)
    router.push('/')
  } catch {
    // Error is handled by store
  }
}

function selectUser(selectedUsername: string) {
  username.value = selectedUsername
}

function changeServer() {
  authStore.clearServer()
  step.value = 'server'
  serverUrl.value = ''
}
</script>

<template>
  <div class="login-view">
    <div class="login-card">
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
          />
        </svg>
        <h1>Swing Music</h1>
      </div>

      <!-- Server Configuration Step -->
      <template v-if="step === 'server'">
        <div class="step-content">
          <h2>Connect to Server</h2>
          <p class="description">Enter your Swing Music server URL</p>

          <form @submit.prevent="handleServerSubmit">
            <div class="input-group">
              <input
                v-model="serverUrl"
                type="text"
                placeholder="http://localhost:1970"
                class="input"
                :disabled="authStore.isLoading"
              />
            </div>

            <div v-if="authStore.error" class="error-message">
              {{ authStore.error }}
            </div>

            <button
              type="submit"
              class="btn btn-primary"
              :disabled="authStore.isLoading || !serverUrl.trim()"
            >
              <span v-if="authStore.isLoading">Connecting...</span>
              <span v-else>Connect</span>
            </button>
          </form>
        </div>
      </template>

      <!-- Login Step -->
      <template v-else>
        <div class="step-content">
          <h2>Sign In</h2>

          <div class="login-tabs">
            <button
              class="tab"
              :class="{ active: loginMethod === 'password' }"
              @click="loginMethod = 'password'"
            >
              Password
            </button>
            <button
              class="tab"
              :class="{ active: loginMethod === 'qr' }"
              @click="loginMethod = 'qr'"
            >
              QR Code
            </button>
          </div>

          <!-- Password Login -->
          <template v-if="loginMethod === 'password'">
            <!-- User selection -->
            <div v-if="authStore.users.length > 0" class="user-list">
              <button
                v-for="user in authStore.users"
                :key="user.id"
                class="user-item"
                :class="{ selected: username === user.username }"
                @click="selectUser(user.username)"
              >
                <div class="user-avatar">
                  {{ user.username.charAt(0).toUpperCase() }}
                </div>
                <span>{{ user.username }}</span>
              </button>
            </div>

            <form @submit.prevent="handleLogin">
              <div class="input-group">
                <input
                  v-model="username"
                  type="text"
                  placeholder="Username"
                  class="input"
                  :disabled="authStore.isLoading"
                />
              </div>

              <div class="input-group">
                <input
                  v-model="password"
                  type="password"
                  placeholder="Password"
                  class="input"
                  :disabled="authStore.isLoading"
                />
              </div>

              <div v-if="authStore.error" class="error-message">
                {{ authStore.error }}
              </div>

              <button
                type="submit"
                class="btn btn-primary"
                :disabled="authStore.isLoading || !username.trim() || !password.trim()"
              >
                <span v-if="authStore.isLoading">Signing in...</span>
                <span v-else>Sign In</span>
              </button>
            </form>
          </template>

          <!-- QR Code Login -->
          <template v-else>
            <div class="qr-section">
              <p class="description">
                Open Swing Music web app on another device and scan the QR code to sign in
                instantly.
              </p>
              <div class="qr-placeholder">
                <p>QR Scanner coming soon</p>
              </div>
            </div>
          </template>

          <button class="btn btn-text" @click="changeServer">Change Server</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.login-view {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: var(--color-background);
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 32px;
  background-color: var(--color-surface);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
}

.logo svg {
  width: 64px;
  height: 64px;
  color: var(--color-primary);
}

.logo h1 {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
}

.step-content h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0 0 8px;
  text-align: center;
}

.description {
  font-size: 14px;
  color: var(--color-on-surface-variant);
  text-align: center;
  margin-bottom: 24px;
}

.login-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.tab {
  flex: 1;
  padding: 10px;
  background: transparent;
  border: 1px solid var(--color-outline);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab.active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-on-primary);
}

.user-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid var(--color-outline);
  border-radius: 24px;
  font-size: 14px;
  color: var(--color-on-surface);
  cursor: pointer;
  transition: all 0.15s ease;
}

.user-item:hover {
  background-color: var(--color-surface-variant);
}

.user-item.selected {
  background-color: var(--color-primary-container);
  border-color: var(--color-primary);
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.input-group {
  margin-bottom: 16px;
}

.input {
  width: 100%;
  padding: 12px 16px;
  background-color: var(--color-surface-variant);
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-on-surface);
  outline: none;
  transition: border-color 0.15s ease;
}

.input:focus {
  border-color: var(--color-primary);
}

.input::placeholder {
  color: var(--color-on-surface-variant);
}

.error-message {
  padding: 12px;
  background-color: var(--color-error-container);
  color: var(--color-on-error-container);
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 16px;
}

.btn {
  width: 100%;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.btn-text {
  background: transparent;
  color: var(--color-primary);
  margin-top: 16px;
}

.btn-text:hover {
  text-decoration: underline;
}

.qr-section {
  text-align: center;
}

.qr-placeholder {
  width: 200px;
  height: 200px;
  margin: 24px auto;
  background-color: var(--color-surface-variant);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
}
</style>
