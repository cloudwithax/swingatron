<script setup lang="ts">
defineProps<{
  parts: string[]
}>()

const emit = defineEmits<{
  navigate: [index: number]
  home: []
}>()

function handlePartClick(index: number) {
  emit('navigate', index)
}

function handleHomeClick() {
  emit('home')
}
</script>

<template>
  <div class="path-breadcrumb">
    <button class="breadcrumb-item home" @click="handleHomeClick">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    </button>
    <template v-for="(part, index) in parts" :key="index">
      <span class="separator">/</span>
      <button
        class="breadcrumb-item"
        :class="{ 'is-current': index === parts.length - 1 }"
        @click="handlePartClick(index)"
      >
        {{ part }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.path-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.path-breadcrumb::-webkit-scrollbar {
  display: none;
}

.breadcrumb-item {
  background: transparent;
  border: none;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 13px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.breadcrumb-item:hover {
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
}

.breadcrumb-item.is-current {
  color: var(--color-primary);
  font-weight: 500;
}

.breadcrumb-item.home {
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.breadcrumb-item.home svg {
  width: 20px;
  height: 20px;
}

.separator {
  color: var(--color-outline);
  font-size: 13px;
}
</style>
