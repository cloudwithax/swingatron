<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { getThumbnailUrl } from '@/api/client'

const playerStore = usePlayerStore()

// Accept fullscreen prop to adjust styling
defineProps<{
  fullscreen?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// Get upcoming tracks (after current)
const upcomingTracks = computed(() => {
  const currentIdx = playerStore.currentIndex
  return playerStore.queue.slice(currentIdx + 1)
})

// Get previous tracks (before current)
const previousTracks = computed(() => {
  const currentIdx = playerStore.currentIndex
  return playerStore.queue.slice(0, currentIdx)
})

function playTrackAtIndex(index: number) {
  playerStore.skipTo(index)
}

function removeFromQueue(index: number) {
  playerStore.removeFromQueue(index)
}

function clearQueue() {
  playerStore.clearQueue()
  emit('close')
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="queue-panel" :class="{ fullscreen: $props.fullscreen }">
    <div class="queue-backdrop" @click="$emit('close')"></div>
    <div class="queue-content">
      <!-- Header -->
      <header class="queue-header">
        <h2>Queue</h2>
        <div class="header-actions">
          <button v-if="playerStore.queue.length > 1" class="clear-btn" @click="clearQueue">
            Clear
          </button>
          <button class="close-btn" @click="$emit('close')">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
          </button>
        </div>
      </header>

      <!-- Queue List -->
      <div class="queue-list">
        <!-- Now Playing -->
        <div v-if="playerStore.currentTrack" class="queue-section">
          <h3 class="section-title">Now Playing</h3>
          <div class="queue-item now-playing">
            <div class="item-artwork">
              <img
                v-if="playerStore.currentTrack.image"
                :src="getThumbnailUrl(playerStore.currentTrack.image, 'small')"
                :alt="playerStore.currentTrack.title"
              />
              <div v-else class="artwork-placeholder">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                  />
                </svg>
              </div>
              <div class="playing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <div class="item-info">
              <span class="item-title">{{ playerStore.currentTrack.title }}</span>
              <span class="item-artist">
                {{ playerStore.currentTrack.artists?.map((a) => a.name).join(', ') }}
              </span>
            </div>
            <span class="item-duration">
              {{ formatDuration(playerStore.currentTrack.duration * 1000) }}
            </span>
          </div>
        </div>

        <!-- Next Up -->
        <div v-if="upcomingTracks.length > 0" class="queue-section">
          <h3 class="section-title">Next Up</h3>
          <div
            v-for="(track, idx) in upcomingTracks"
            :key="track.trackhash + '-' + idx"
            class="queue-item"
            @click="playTrackAtIndex(playerStore.currentIndex + 1 + idx)"
          >
            <div class="item-index">{{ idx + 1 }}</div>
            <div class="item-artwork">
              <img
                v-if="track.image"
                :src="getThumbnailUrl(track.image, 'small')"
                :alt="track.title"
              />
              <div v-else class="artwork-placeholder">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                  />
                </svg>
              </div>
            </div>
            <div class="item-info">
              <span class="item-title">{{ track.title }}</span>
              <span class="item-artist">
                {{ track.artists?.map((a) => a.name).join(', ') }}
              </span>
            </div>
            <span class="item-duration">
              {{ formatDuration(track.duration * 1000) }}
            </span>
            <button
              class="remove-btn"
              title="Remove from queue"
              @click.stop="removeFromQueue(playerStore.currentIndex + 1 + idx)"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Previously Played -->
        <div v-if="previousTracks.length > 0" class="queue-section">
          <h3 class="section-title">Previously Played</h3>
          <div
            v-for="(track, idx) in previousTracks"
            :key="track.trackhash + '-prev-' + idx"
            class="queue-item previous"
            @click="playTrackAtIndex(idx)"
          >
            <div class="item-index">{{ idx + 1 }}</div>
            <div class="item-artwork">
              <img
                v-if="track.image"
                :src="getThumbnailUrl(track.image, 'small')"
                :alt="track.title"
              />
              <div v-else class="artwork-placeholder">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                  />
                </svg>
              </div>
            </div>
            <div class="item-info">
              <span class="item-title">{{ track.title }}</span>
              <span class="item-artist">
                {{ track.artists?.map((a) => a.name).join(', ') }}
              </span>
            </div>
            <span class="item-duration">
              {{ formatDuration(track.duration * 1000) }}
            </span>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="playerStore.queue.length === 0" class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"
            />
          </svg>
          <span>Your queue is empty</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.queue-panel {
  position: fixed;
  top: 32px;
  left: 0;
  right: 0;
  bottom: 90px;
  z-index: 150;
  display: flex;
  justify-content: flex-end;
}

.queue-panel.fullscreen {
  top: 0;
  bottom: 0;
  /* fullscreen covers everything including titlebar */
}

.queue-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.queue-content {
  position: relative;
  width: 400px;
  max-width: 100%;
  height: 100%;
  background: var(--color-surface);
  border-left: 1px solid var(--color-outline-variant);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-outline-variant);
  flex-shrink: 0;
}

.queue-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.clear-btn {
  background: transparent;
  border: none;
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.clear-btn:hover {
  background: var(--color-surface-variant);
}

.close-btn {
  background: transparent;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-on-surface-variant);
  transition: background-color 0.15s;
}

.close-btn:hover {
  background: var(--color-surface-variant);
}

.close-btn svg {
  width: 20px;
  height: 20px;
}

.queue-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.queue-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 20px;
  margin: 0;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.queue-item:hover {
  background: var(--color-surface-variant);
}

.queue-item.now-playing {
  background: var(--color-primary-container);
  cursor: default;
}

.queue-item.previous {
  opacity: 0.6;
}

.item-index {
  width: 24px;
  text-align: center;
  font-size: 14px;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.item-artwork {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.item-artwork img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artwork-placeholder {
  width: 100%;
  height: 100%;
  background: var(--color-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
}

.artwork-placeholder svg {
  width: 20px;
  height: 20px;
  color: var(--color-on-surface-variant);
  opacity: 0.5;
}

.playing-indicator {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}

.playing-indicator span {
  width: 3px;
  background: var(--color-primary);
  border-radius: 1px;
  animation: soundbar 0.5s ease-in-out infinite alternate;
}

.playing-indicator span:nth-child(1) {
  height: 4px;
  animation-delay: 0s;
}

.playing-indicator span:nth-child(2) {
  height: 8px;
  animation-delay: 0.15s;
}

.playing-indicator span:nth-child(3) {
  height: 6px;
  animation-delay: 0.3s;
}

@keyframes soundbar {
  0% {
    transform: scaleY(0.5);
  }
  100% {
    transform: scaleY(1);
  }
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.now-playing .item-title {
  color: var(--color-primary);
}

.item-artist {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-duration {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.remove-btn {
  background: transparent;
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-on-surface-variant);
  opacity: 0;
  transition:
    opacity 0.15s,
    background-color 0.15s;
  flex-shrink: 0;
}

.queue-item:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: var(--color-error-container);
  color: var(--color-error);
}

.remove-btn svg {
  width: 16px;
  height: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 20px;
  color: var(--color-on-surface-variant);
}

.empty-state svg {
  width: 48px;
  height: 48px;
  opacity: 0.5;
}

.empty-state span {
  font-size: 14px;
}

/* Responsive */
@media (max-width: 480px) {
  .queue-content {
    width: 100%;
  }
}
</style>
