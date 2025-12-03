<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import MiniPlayer from '@/components/MiniPlayer.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import TitleBar from '@/components/TitleBar.vue'

const route = useRoute()
const authStore = useAuthStore()
const playerStore = usePlayerStore()

const showNavigation = computed(() => {
  return authStore.isAuthenticated && route.path !== '/login'
})

const showMiniPlayer = computed(() => {
  return !!playerStore.currentTrack
})

const isSidebarCollapsed = ref(false)

function toggleSidebar(): void {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}
</script>

<template>
  <div id="app-container">
    <!-- Custom Titlebar -->
    <TitleBar />

    <!-- Main App Content -->
    <div class="app-content">
      <!-- Sidebar Navigation -->
      <aside v-if="showNavigation" class="sidebar" :class="{ 'is-collapsed': isSidebarCollapsed }">
        <div class="sidebar-header">
          <button
            class="collapse-toggle"
            type="button"
            :aria-label="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="toggleSidebar"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>
          <span class="logo-text">Swing</span>
        </div>

        <nav class="nav-section">
          <router-link to="/" class="nav-item" :class="{ active: route.path === '/' }">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            <span>Home</span>
          </router-link>
          <router-link
            to="/folders"
            class="nav-item"
            :class="{ active: route.path === '/folders' }"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
              />
            </svg>
            <span>Folders</span>
          </router-link>
          <router-link
            to="/albums"
            class="nav-item"
            :class="{ active: route.path.startsWith('/album') }"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"
              />
            </svg>
            <span>Albums</span>
          </router-link>
          <router-link
            to="/artists"
            class="nav-item"
            :class="{ active: route.path.startsWith('/artist') }"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
              />
            </svg>
            <span>Artists</span>
          </router-link>
          <router-link
            to="/playlists"
            class="nav-item"
            :class="{ active: route.path.startsWith('/playlist') }"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"
              />
            </svg>
            <span>Playlists</span>
          </router-link>
          <router-link
            to="/favorites"
            class="nav-item"
            :class="{ active: route.path === '/favorites' }"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              />
            </svg>
            <span>Favorites</span>
          </router-link>
          <router-link to="/search" class="nav-item" :class="{ active: route.path === '/search' }">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
              />
            </svg>
            <span>Search</span>
          </router-link>
          <router-link to="/stats" class="nav-item" :class="{ active: route.path === '/stats' }">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"
              />
            </svg>
            <span>Stats</span>
          </router-link>
          <router-link
            to="/settings"
            class="nav-item"
            :class="{ active: route.path === '/settings' }"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
              />
            </svg>
            <span>Settings</span>
          </router-link>
        </nav>
      </aside>

      <!-- Main Content Area -->
      <div class="content-wrapper">
        <main class="main-content">
          <router-view v-slot="{ Component, route: currentRoute }">
            <transition name="fade" mode="out-in">
              <component :is="Component" :key="currentRoute.path" />
            </transition>
          </router-view>
        </main>

        <!-- Mini Player -->
        <MiniPlayer v-if="showMiniPlayer" />
      </div>
    </div>

    <!-- Toast Notifications -->
    <ToastContainer />
  </div>
</template>

<style scoped>
#app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: var(--color-background);
}

/* app content below titlebar */
.app-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* sidebar styles */
.sidebar {
  width: 240px;
  min-width: 240px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface);
  border-right: 1px solid var(--color-outline-variant);
}

.sidebar-header {
  padding: 20px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.collapse-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 16px;
  border: none;
  background: transparent;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  padding: 0;
}

.collapse-toggle:hover {
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
}

.collapse-toggle svg {
  width: 20px;
  height: 20px;
}

.logo-text {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.5px;
}

.sidebar.is-collapsed {
  width: 72px;
  min-width: 72px;
}

.sidebar.is-collapsed .logo-text {
  display: none;
}

.nav-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--color-on-surface-variant);
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.nav-item:hover {
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
}

.nav-item.active {
  background-color: var(--color-primary-container);
  color: var(--color-on-primary-container);
}

.nav-item svg {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.nav-item span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar.is-collapsed .nav-item {
  justify-content: center;
}

.sidebar.is-collapsed .nav-item span {
  display: none;
}

.sidebar.is-collapsed .collapse-toggle svg {
  transform: rotate(180deg);
}

/* content wrapper for main + player */
.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
