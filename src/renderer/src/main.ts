import './styles/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { usePlayerStore } from './stores/player'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Initialize player state from localStorage
const playerStore = usePlayerStore(pinia)
playerStore.loadState()

app.mount('#app')
