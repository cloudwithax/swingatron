<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { HomeItem, HomeTrackItem, HomeAlbumItem, HomeArtistItem, Track } from '@/api/types'
import { getThumbnailUrl, getArtistImageUrl } from '@/api/client'
import { usePlayerStore } from '@/stores/player'
import { getAlbumWithInfo } from '@/api/albums'
import { sortAlbumTracks } from '@/utils/tracks'

const isLoadingPlay = ref(false)

const props = defineProps<{
  item: HomeItem
}>()

const router = useRouter()
const playerStore = usePlayerStore()

const itemData = computed(() => props.item.item)
const itemType = computed(() => props.item.type)

const imageUrl = computed(() => {
  if (itemType.value === 'artist') {
    const artist = itemData.value as HomeArtistItem
    return artist.image ? getArtistImageUrl(artist.image) : ''
  }
  const data = itemData.value as HomeTrackItem | HomeAlbumItem
  return data.image ? getThumbnailUrl(data.image) : ''
})

const title = computed(() => {
  if (itemType.value === 'artist') {
    return (itemData.value as HomeArtistItem).name
  }
  return (itemData.value as HomeTrackItem | HomeAlbumItem).title
})

const subtitle = computed(() => {
  if (itemType.value === 'artist') {
    return (itemData.value as HomeArtistItem).help_text || ''
  }
  if (itemType.value === 'track') {
    const track = itemData.value as HomeTrackItem
    return track.artists?.map((a) => a.name).join(', ') || ''
  }
  // album
  const album = itemData.value as HomeAlbumItem
  return album.albumartists?.map((a) => a.name).join(', ') || ''
})

const typeLabel = computed(() => {
  return itemType.value.toUpperCase()
})

const isArtist = computed(() => itemType.value === 'artist')

// build the playback source string based on item type (only for tracks and albums)
const playbackSourceId = computed(() => {
  if (itemType.value === 'track') {
    const track = itemData.value as HomeTrackItem
    return `tr:${track.trackhash}`
  } else if (itemType.value === 'album') {
    const album = itemData.value as HomeAlbumItem
    return `al:${album.albumhash}`
  }
  return ''
})

// check if this item is the current playback source
const isCurrentSource = computed(() => {
  return playerStore.playbackSource === playbackSourceId.value
})

const isPlaying = computed(() => {
  return isCurrentSource.value && playerStore.isPlaying
})

function handleClick(): void {
  if (itemType.value === 'track') {
    // play track immediately on click
    handlePlayPause()
  } else if (itemType.value === 'album') {
    const album = itemData.value as HomeAlbumItem
    router.push({ name: 'album-detail', params: { hash: album.albumhash } })
  } else if (itemType.value === 'artist') {
    const artist = itemData.value as HomeArtistItem
    router.push({ name: 'artist-detail', params: { hash: artist.artisthash } })
  }
}

async function handlePlayPause(event?: MouseEvent): Promise<void> {
  if (event) {
    event.stopPropagation()
  }

  // if currently playing this source, pause
  if (isPlaying.value) {
    playerStore.pause()
    return
  }

  // if same source but paused, resume
  if (isCurrentSource.value) {
    playerStore.play()
    return
  }

  if (itemType.value === 'track') {
    // convert to track and play it
    const trackData = itemData.value as HomeTrackItem
    const track: Track = {
      album: trackData.album,
      albumhash: trackData.albumhash,
      trackhash: trackData.trackhash,
      title: trackData.title,
      filepath: trackData.filepath,
      artists: trackData.artists,
      albumartists: trackData.albumartists,
      bitrate: trackData.bitrate,
      duration: trackData.duration,
      image: trackData.image,
      folder: trackData.folder,
      is_favorite: trackData.is_favorite
    }
    playerStore.setQueue([track], 0, false, `tr:${trackData.trackhash}`)
  } else if (itemType.value === 'album') {
    // fetch album tracks and play
    const album = itemData.value as HomeAlbumItem
    isLoadingPlay.value = true
    try {
      const albumData = await getAlbumWithInfo(album.albumhash)
      if (albumData?.tracks && albumData.tracks.length > 0) {
        const sortedTracks = sortAlbumTracks(albumData.tracks)
        playerStore.setQueue(sortedTracks, 0, false, `al:${album.albumhash}`)
      }
    } catch (err) {
      console.error('failed to fetch album tracks:', err)
    } finally {
      isLoadingPlay.value = false
    }
  }
}
</script>

<template>
  <div class="recently-played-item" @click="handleClick">
    <div class="item-artwork-container" :class="{ 'is-artist': isArtist }">
      <img v-if="imageUrl" :src="imageUrl" :alt="title" class="item-artwork" loading="lazy" />
      <div v-else class="item-artwork-placeholder">
        <svg v-if="isArtist" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
          />
        </svg>
      </div>
      <button
        v-if="!isArtist"
        class="play-button"
        :class="{ visible: isCurrentSource || isLoadingPlay }"
        :disabled="isLoadingPlay"
        @click="handlePlayPause"
      >
        <svg v-if="isLoadingPlay" class="spinner" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25" />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
          />
        </svg>
        <svg v-else-if="isPlaying" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    </div>
    <div class="item-info">
      <div class="item-type" :class="`type-${itemType}`">{{ typeLabel }}</div>
      <div class="item-title">{{ title }}</div>
      <div v-if="subtitle" class="item-subtitle">{{ subtitle }}</div>
    </div>
  </div>
</template>

<style scoped>
.recently-played-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  width: 160px;
  flex-shrink: 0;
  transition: background-color 0.2s ease;
}

.recently-played-item:hover {
  background-color: var(--color-surface-hover, rgba(255, 255, 255, 0.1));
}

.item-artwork-container {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-surface-variant);
}

.item-artwork-container.is-artist {
  border-radius: 50%;
}

.item-artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-artwork-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
}

.item-artwork-placeholder svg {
  width: 40%;
  height: 40%;
}

.play-button {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    background-color 0.15s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.play-button.visible,
.recently-played-item:hover .play-button {
  opacity: 1;
  transform: translateY(0);
}

.play-button:hover {
  background-color: var(--color-primary-variant, var(--color-primary));
  transform: scale(1.05);
}

.play-button:active {
  transform: scale(0.95);
}

.play-button svg {
  width: 20px;
  height: 20px;
  color: var(--color-on-primary);
}

.play-button .spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.play-button:disabled {
  cursor: wait;
}

.item-info {
  padding: 0 4px;
}

.item-type {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.item-type.type-track {
  color: var(--color-primary);
}

.item-type.type-album {
  color: var(--color-secondary, #888);
}

.item-type.type-artist {
  color: var(--color-tertiary, #666);
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-subtitle {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
