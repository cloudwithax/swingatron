<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isMaximized = ref(false)

async function checkMaximized(): Promise<void> {
  isMaximized.value = await window.api.isMaximized()
}

function minimize(): void {
  window.api.minimizeWindow()
}

function maximize(): void {
  window.api.maximizeWindow()
}

function close(): void {
  window.api.closeWindow()
}

onMounted(() => {
  checkMaximized()
  window.api.onMaximizedChange((maximized: boolean) => {
    isMaximized.value = maximized
  })
})
</script>

<template>
  <div class="titlebar">
    <div class="titlebar-drag-region"></div>
    <div class="titlebar-title">Swingatron</div>
    <div class="titlebar-controls">
      <button class="titlebar-button" type="button" aria-label="Minimize" @click="minimize">
        <svg viewBox="0 0 12 12" fill="currentColor">
          <rect x="2" y="5.5" width="8" height="1" />
        </svg>
      </button>
      <button
        class="titlebar-button"
        type="button"
        :aria-label="isMaximized ? 'Restore' : 'Maximize'"
        @click="maximize"
      >
        <svg v-if="isMaximized" viewBox="0 0 12 12" fill="currentColor">
          <!-- restore icon: two overlapping squares -->
          <path d="M3 1v2H1v8h8V9h2V1H3zm6 7H2V4h7v4zm1-5H4V2h6v1z" fill-rule="evenodd" />
        </svg>
        <svg v-else viewBox="0 0 12 12" fill="currentColor">
          <!-- maximize icon: single square -->
          <rect
            x="1.5"
            y="1.5"
            width="9"
            height="9"
            stroke="currentColor"
            stroke-width="1"
            fill="none"
          />
        </svg>
      </button>
      <button
        class="titlebar-button titlebar-button-close"
        type="button"
        aria-label="Close"
        @click="close"
      >
        <svg viewBox="0 0 12 12" fill="currentColor">
          <path
            d="M1.5 1.5l9 9M10.5 1.5l-9 9"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-outline-variant);
  -webkit-app-region: drag;
  user-select: none;
  flex-shrink: 0;
}

.titlebar-drag-region {
  flex: 1;
  height: 100%;
}

.titlebar-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-on-surface-variant);
  pointer-events: none;
}

.titlebar-controls {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
}

.titlebar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.titlebar-button:hover {
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
}

.titlebar-button:active {
  background-color: var(--color-outline-variant);
}

.titlebar-button-close:hover {
  background-color: #e81123;
  color: #ffffff;
}

.titlebar-button-close:active {
  background-color: #bf0f1d;
}

.titlebar-button svg {
  width: 12px;
  height: 12px;
}
</style>
