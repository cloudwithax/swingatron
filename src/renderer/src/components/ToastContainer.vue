<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

const dismissToast = (toast, id: number) => {
  toast.action?.handler()
  dismiss(id)
}
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-container">
      <div v-for="toast in toasts" :key="toast.id" class="toast" :class="[`toast--${toast.type}`]">
        <div class="toast-content">
          <svg
            v-if="toast.type === 'success'"
            class="toast-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          <svg
            v-else-if="toast.type === 'error'"
            class="toast-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
            />
          </svg>
          <svg v-else class="toast-icon" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
            />
          </svg>
          <span class="toast-message">{{ toast.message }}</span>
        </div>
        <div class="toast-actions">
          <button v-if="toast.action" class="toast-action" @click="dismissToast(toast, toast.id)">
            {{ toast.action.label }}
          </button>
          <button class="toast-dismiss" @click="dismiss(toast.id)">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
          </button>
        </div>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 400;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background-color: var(--color-inverse-surface);
  color: var(--color-inverse-on-surface);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
  min-width: 280px;
  max-width: 400px;
}

.toast--success {
  background-color: var(--color-primary-container);
  color: var(--color-on-primary-container);
}

.toast--error {
  background-color: var(--color-error-container);
  color: var(--color-on-error-container);
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.toast-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.toast-message {
  font-size: 14px;
  line-height: 1.4;
}

.toast-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toast-action {
  padding: 6px 12px;
  background: transparent;
  border: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.toast-action:hover {
  background-color: rgba(var(--color-primary-rgb), 0.1);
}

.toast-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  border-radius: 50%;
}

.toast-dismiss:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1);
}

.toast-dismiss svg {
  width: 16px;
  height: 16px;
}

/* Toast transitions */
.toast-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.toast-move {
  transition: transform 0.2s ease;
}
</style>
