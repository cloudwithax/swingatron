<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<template>
  <div class="loading-state">
    <div class="spinner"></div>
    <p v-if="message" class="loading-message">{{ message }}</p>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-surface-variant);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-message {
  margin-top: 16px;
  font-size: 14px;
  color: var(--color-on-surface-variant);
}
</style>
