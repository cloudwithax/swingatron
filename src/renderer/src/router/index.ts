import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Lazy load routes
const LoginView = () => import('@/features/auth/LoginView.vue')
const HomeView = () => import('@/features/home/HomeView.vue')
const FoldersView = () => import('@/features/folders/FoldersView.vue')
const AlbumsView = () => import('@/features/albums/AlbumsView.vue')
const AlbumDetailView = () => import('@/features/albums/AlbumDetailView.vue')
const ArtistsView = () => import('@/features/artists/ArtistsView.vue')
const ArtistDetailView = () => import('@/features/artists/ArtistDetailView.vue')
const FavoritesView = () => import('@/features/favorites/FavoritesView.vue')
const SearchView = () => import('@/features/search/SearchView.vue')
const SettingsView = () => import('@/features/settings/SettingsView.vue')
const PlaylistsView = () => import('@/features/playlists/PlaylistsView.vue')
const PlaylistDetailView = () => import('@/features/playlists/PlaylistDetailView.vue')
const StatsView = () => import('@/features/stats/StatsView.vue')
const NowPlayingView = () => import('@/features/nowplaying/NowPlayingView.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { requiresAuth: true }
  },
  {
    path: '/folders',
    name: 'folders',
    component: FoldersView,
    meta: { requiresAuth: true }
  },
  {
    path: '/albums',
    name: 'albums',
    component: AlbumsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/album/:hash',
    name: 'album-detail',
    component: AlbumDetailView,
    meta: { requiresAuth: true }
  },
  {
    path: '/artists',
    name: 'artists',
    component: ArtistsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/artist/:hash',
    name: 'artist-detail',
    component: ArtistDetailView,
    meta: { requiresAuth: true }
  },
  {
    path: '/playlists',
    name: 'playlists',
    component: PlaylistsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/playlist/:id',
    name: 'playlist-detail',
    component: PlaylistDetailView,
    meta: { requiresAuth: true }
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: FavoritesView,
    meta: { requiresAuth: true }
  },
  {
    path: '/search',
    name: 'search',
    component: SearchView,
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/stats',
    name: 'stats',
    component: StatsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/nowplaying',
    name: 'nowplaying',
    component: NowPlayingView,
    meta: { requiresAuth: true }
  },
  // Catch-all redirect to home
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// Navigation guard
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()

  // Try to restore session on app load
  if (!authStore.isAuthenticated) {
    authStore.restoreSession()
  }

  const requiresAuth = to.meta.requiresAuth !== false

  if (requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
