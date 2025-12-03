<script setup lang="ts">
import type { Folder } from '@/api/types'

defineProps<{
  folder: Folder
}>()

const emit = defineEmits<{
  click: [folder: Folder]
}>()

function handleClick(folder: Folder) {
  emit('click', folder)
}
</script>

<template>
  <div class="folder-item" @click="handleClick(folder)">
    <div class="folder-icon">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
        />
      </svg>
    </div>
    <div class="folder-info">
      <div class="folder-name">{{ folder.name }}</div>
      <div class="folder-meta">
        <span v-if="folder.folderCount > 0">{{ folder.folderCount }} folders</span>
        <span v-if="folder.folderCount > 0 && folder.trackCount > 0"> • </span>
        <span v-if="folder.trackCount > 0">{{ folder.trackCount }} tracks</span>
      </div>
    </div>
    <div class="folder-arrow">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.folder-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.folder-item:hover {
  background-color: var(--color-surface-variant);
}

.folder-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary-container);
  border-radius: 8px;
  color: var(--color-on-primary-container);
  flex-shrink: 0;
}

.folder-icon svg {
  width: 24px;
  height: 24px;
}

.folder-info {
  flex: 1;
  min-width: 0;
}

.folder-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-meta {
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

.folder-arrow {
  width: 24px;
  height: 24px;
  color: var(--color-on-surface-variant);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.folder-item:hover .folder-arrow {
  opacity: 1;
}

.folder-arrow svg {
  width: 100%;
  height: 100%;
}
</style>
