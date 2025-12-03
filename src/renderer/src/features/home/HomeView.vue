<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useHomeStore } from '@/stores/home'
import { useAuthStore } from '@/stores/auth'
import RecentlyPlayedItem from '@/components/RecentlyPlayedItem.vue'
import LoadingState from '@/components/LoadingState.vue'
import ErrorState from '@/components/ErrorState.vue'
import Carousel from '@/components/Carousel.vue'

const router = useRouter()
const homeStore = useHomeStore()
const authStore = useAuthStore()

const getMorningMessage = (name: string) => {
  const messages = [
    `Good morning, ${name}! Let the music play! `,
    `Ready for coffee and a beat, ${name}?`,
    `${name} likes their mornings with a side of tunes.`,
    `Don't let your fire music choice get ahead of the morning rush, ${name}`,
    `Tune in for a great day, ${name}`
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const getAfternoonMessage = (name: string) => {
  const messages = [
    `Good afternoon, ${name}!`,
    `Dont let the slump get you down, ${name}.`,
    `Sometimes life needs a soundtrack.`,
    `Let the rhythm of the afternoon move you.`,
    `Take a moment to enjoy some music. You deserve it!`
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const getEveningMessage = (name: string) => {
  const messages = [
    `Gooooood evening, ${name}!`,
    `Finally, it's time to unwind.`,
    `Kicking your feet up and laying back after a long day — with music, of course.`,
    `Evenings are better with your favorite tracks.`,
    `Ah yes, ${name} and their favorite tunes. The perfect end to a long day.`
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const greeting = computed(() => {
  const hour = new Date().getHours()
  const name = authStore.user?.username || 'there'

  if (hour < 12) {
    return getMorningMessage(name)
  } else if (hour < 18) {
    return getAfternoonMessage(name)
  } else {
    return getEveningMessage(name)
  }
})

const navItems = [
  { icon: 'folder', label: 'Folders', route: '/folders' },
  { icon: 'album', label: 'Albums', route: '/albums' },
  { icon: 'person', label: 'Artists', route: '/artists' },
  { icon: 'playlist', label: 'Playlists', route: '/playlists' },
  { icon: 'favorite', label: 'Favorites', route: '/favorites' }
]

function navigateTo(route: string): void {
  router.push(route)
}

onMounted(() => {
  homeStore.fetchHome(7)
})
</script>

<template>
  <div class="home-view">
    <header class="home-header">
      <h1>Home</h1>
      <p class="greeting">{{ greeting }}</p>
    </header>

    <section class="browse-section">
      <h2 class="section-title">Browse Library</h2>
      <div class="nav-grid">
        <button
          v-for="item in navItems"
          :key="item.route"
          class="nav-button"
          @click="navigateTo(item.route)"
        >
          <span class="nav-icon" :class="`icon-${item.icon}`">
            <!-- folder icon -->
            <svg v-if="item.icon === 'folder'" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
              />
            </svg>
            <!-- album icon -->
            <svg v-else-if="item.icon === 'album'" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"
              />
            </svg>
            <!-- person icon -->
            <svg v-else-if="item.icon === 'person'" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
              />
            </svg>
            <!-- playlist icon -->
            <svg v-else-if="item.icon === 'playlist'" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 10h11v2H3v-2zm0-4h11v2H3V6zm0 8h7v2H3v-2zm13-1v8l6-4-6-4z" />
            </svg>
            <!-- favorite icon -->
            <svg v-else-if="item.icon === 'favorite'" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              />
            </svg>
            <!-- favorite-track icon -->
            <svg v-else-if="item.icon === 'favorite-track'" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              />
            </svg>
            <!-- favorite-artist icon -->
            <svg
              v-else-if="item.icon === 'favorite-artist'"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
              />
            </svg>
            <!-- favorite-album icon -->
            <svg v-else-if="item.icon === 'favorite-album'" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"
              />
            </svg>
            <!-- stats icon -->
            <svg v-else viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"
              />
            </svg>
          </span>
          <span class="nav-label">{{ item.label }}</span>
        </button>
      </div>
    </section>

    <LoadingState v-if="homeStore.isLoading" />
    <ErrorState v-else-if="homeStore.error" :message="homeStore.error" />
    <template v-else>
      <section v-if="homeStore.hasRecentlyPlayed" class="recently-played-section">
        <h2 class="section-title">Recently played</h2>
        <Carousel :scroll-amount="3" :gap="16">
          <RecentlyPlayedItem
            v-for="(item, index) in homeStore.recentlyPlayedItems"
            :key="index"
            :item="item"
          />
        </Carousel>
      </section>

      <section v-if="homeStore.hasRecentlyAdded" class="recently-added-section">
        <h2 class="section-title">Recently added</h2>
        <Carousel :scroll-amount="3" :gap="16">
          <RecentlyPlayedItem
            v-for="(item, index) in homeStore.recentlyAddedItems"
            :key="index"
            :item="item"
          />
        </Carousel>
      </section>
    </template>
  </div>
</template>

<style scoped>
.home-view {
  padding: 24px;
  overflow-y: auto;
  height: calc(100% - 48px);
}

.home-header {
  margin-bottom: 32px;
}

.home-header h1 {
  font-size: 48px;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
}

.greeting {
  font-size: 16px;
  color: var(--color-on-surface-variant);
  margin-top: 4px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0 0 16px 0;
}

.browse-section {
  margin-bottom: 32px;
}

.nav-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.nav-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: var(--color-surface-variant);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.nav-button:hover {
  background-color: var(--color-surface-container-high);
}

.nav-icon {
  width: 20px;
  height: 20px;
  color: var(--color-on-surface-variant);
}

.nav-icon svg {
  width: 100%;
  height: 100%;
}

.nav-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-on-surface);
}

.recently-played-section,
.recently-added-section {
  margin-bottom: 32px;
}
</style>
