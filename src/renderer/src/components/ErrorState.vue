<script setup lang="ts">
defineProps<{
  message?: string
  retryable?: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()

function handleRetry(): void {
  emit('retry')
}
</script>

<template>
  <div class="error-state">
    <div class="error-icon">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
        />
      </svg>
    </div>
    <p class="error-message">{{ message || 'Something went wrong' }}</p>
    <button v-if="retryable" class="retry-btn" @click="handleRetry">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
        />
      </svg>
      Retry
    </button>
  </div>
</template>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.error-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  color: var(--color-error);
  opacity: 0.7;
}

.error-icon svg {
  width: 100%;
  height: 100%;
}

.error-message {
  font-size: 14px;
  color: var(--color-on-surface-variant);
  margin: 0 0 24px;
  max-width: 300px;
}

.retry-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.retry-btn:hover {
  background-color: var(--color-outline);
}

.retry-btn svg {
  width: 18px;
  height: 18px;
}
</style>
