import './styles/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// clear caches and player state on startup
// keeps auth tokens, settings, and user preferences intact
function clearStartupCaches(): void {
  localStorage.removeItem('player_queue')
  localStorage.removeItem('swing_albums_cache')
  localStorage.removeItem('swing_artists_cache')
}

clearStartupCaches()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
