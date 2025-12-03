<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStatsStore } from '@/stores/stats'
import { usePlayerStore } from '@/stores/player'
import { getThumbnailUrl, getArtistImageUrl } from '@/api/client'
import type { ChartDuration, ChartOrderBy, ChartTrack, ChartArtist, ChartAlbum } from '@/api/types'
import LoadingState from '@/components/LoadingState.vue'
import ErrorState from '@/components/ErrorState.vue'

const router = useRouter()
const statsStore = useStatsStore()
const playerStore = usePlayerStore()

const durations: { value: ChartDuration; label: string }[] = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'alltime', label: 'All Time' }
]

const orderByOptions: { value: ChartOrderBy; label: string }[] = [
  { value: 'playduration', label: 'Time Listened' },
  { value: 'playcount', label: 'Play Count' }
]

const selectedDuration = computed({
  get: () => statsStore.duration,
  set: (val) => statsStore.setDuration(val)
})

const selectedOrderBy = computed({
  get: () => statsStore.orderBy,
  set: (val) => statsStore.setOrderBy(val)
})

onMounted(() => {
  if (!statsStore.hasData) {
    statsStore.loadAll()
  }
})

function getTrendIcon(trend: string): string {
  switch (trend) {
    case 'rising':
      return 'M7 14l5-5 5 5z'
    case 'falling':
      return 'M7 10l5 5 5-5z'
    default:
      return 'M7 12h10'
  }
}

function getTrendClass(trend: string): string {
  switch (trend) {
    case 'rising':
      return 'trend-up'
    case 'falling':
      return 'trend-down'
    default:
      return 'trend-stable'
  }
}

function playTrack(_track: ChartTrack, index: number): void {
  const tracks = statsStore.topTracks.map((t) => ({
    album: t.album,
    albumhash: t.albumhash,
    trackhash: t.trackhash,
    title: t.title,
    filepath: t.filepath,
    artists: t.artists,
    albumartists: t.albumartists,
    bitrate: t.bitrate,
    duration: t.duration,
    disc: t.disc,
    track: t.track,
    image: t.image,
    folder: t.folder,
    is_favorite: t.is_favorite
  }))
  playerStore.setQueue(tracks, index, false, `stats:${statsStore.duration}`)
}

function goToAlbum(album: ChartAlbum): void {
  router.push({ name: 'album-detail', params: { hash: album.albumhash } })
}

function goToArtist(artist: ChartArtist): void {
  router.push({ name: 'artist-detail', params: { hash: artist.artisthash } })
}

function getTrackImage(track: ChartTrack): string {
  return track.image ? getThumbnailUrl(track.image, 'small') : ''
}

function getAlbumImage(album: ChartAlbum): string {
  return album.image ? getThumbnailUrl(album.image, 'small') : ''
}

function getArtistImage(artist: ChartArtist): string {
  return artist.image ? getArtistImageUrl(artist.image) : ''
}

function isCurrentlyPlaying(track: ChartTrack): boolean {
  return playerStore.currentTrack?.trackhash === track.trackhash && playerStore.isPlaying
}
</script>

<template>
  <div class="stats-view">
    <header class="stats-header">
      <h1>Your Stats</h1>

      <div class="stats-controls">
        <div class="control-group">
          <label>Period</label>
          <select v-model="selectedDuration">
            <option v-for="d in durations" :key="d.value" :value="d.value">
              {{ d.label }}
            </option>
          </select>
        </div>

        <div class="control-group">
          <label>Order by</label>
          <select v-model="selectedOrderBy">
            <option v-for="o in orderByOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </div>
      </div>
    </header>

    <!-- weekly stats summary cards -->
    <section v-if="statsStore.weeklyStats.length > 0" class="stats-summary">
      <div v-for="stat in statsStore.weeklyStats" :key="stat.type" class="stat-card">
        <div v-if="stat.image" class="stat-image">
          <img :src="getThumbnailUrl(stat.image, 'small')" :alt="stat.value" />
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stat.value }}</span>
          <span class="stat-title">{{ stat.title }}</span>
        </div>
      </div>
    </section>

    <LoadingState v-if="statsStore.isLoading && !statsStore.hasData" message="Loading stats..." />

    <ErrorState
      v-else-if="statsStore.error && !statsStore.hasData"
      :message="statsStore.error"
      @retry="statsStore.loadAll()"
    />

    <div v-else class="charts-grid">
      <!-- top tracks -->
      <section class="chart-section">
        <div class="chart-header">
          <h2>Top Tracks</h2>
          <div v-if="statsStore.tracksScrobbles" class="scrobbles-info">
            <span>{{ statsStore.tracksScrobbles.text }}</span>
            <svg
              class="trend-icon"
              :class="getTrendClass(statsStore.tracksScrobbles.trend)"
              viewBox="0 0 24 24"
            >
              <path :d="getTrendIcon(statsStore.tracksScrobbles.trend)" fill="currentColor" />
            </svg>
          </div>
        </div>

        <div v-if="statsStore.isLoadingTracks" class="chart-loading">
          <div class="spinner"></div>
        </div>

        <div v-else-if="statsStore.topTracks.length === 0" class="chart-empty">
          No tracks played in this period
        </div>

        <ol v-else class="track-list">
          <li
            v-for="(track, index) in statsStore.topTracks"
            :key="track.trackhash"
            class="chart-track"
            :class="{ 'is-playing': isCurrentlyPlaying(track) }"
            @dblclick="playTrack(track, index)"
          >
            <span class="rank">{{ index + 1 }}</span>
            <img v-if="getTrackImage(track)" :src="getTrackImage(track)" class="track-image" />
            <div class="track-info">
              <span class="track-title">{{ track.title }}</span>
              <span class="track-artist">
                {{ track.artists?.map((a) => a.name).join(', ') || 'Unknown' }}
              </span>
            </div>
            <div class="track-meta">
              <svg class="trend-icon" :class="getTrendClass(track.trend)" viewBox="0 0 24 24">
                <path :d="getTrendIcon(track.trend)" fill="currentColor" />
              </svg>
              <span class="help-text">{{ track.help_text }}</span>
            </div>
          </li>
        </ol>
      </section>

      <!-- top albums -->
      <section class="chart-section">
        <div class="chart-header">
          <h2>Top Albums</h2>
          <div v-if="statsStore.albumsScrobbles" class="scrobbles-info">
            <span>{{ statsStore.albumsScrobbles.text }}</span>
            <svg
              class="trend-icon"
              :class="getTrendClass(statsStore.albumsScrobbles.trend)"
              viewBox="0 0 24 24"
            >
              <path :d="getTrendIcon(statsStore.albumsScrobbles.trend)" fill="currentColor" />
            </svg>
          </div>
        </div>

        <div v-if="statsStore.isLoadingAlbums" class="chart-loading">
          <div class="spinner"></div>
        </div>

        <div v-else-if="statsStore.topAlbums.length === 0" class="chart-empty">
          No albums played in this period
        </div>

        <ol v-else class="album-list">
          <li
            v-for="(album, index) in statsStore.topAlbums"
            :key="album.albumhash"
            class="chart-album"
            @click="goToAlbum(album)"
          >
            <span class="rank">{{ index + 1 }}</span>
            <img v-if="getAlbumImage(album)" :src="getAlbumImage(album)" class="album-image" />
            <div class="album-info">
              <span class="album-title">{{ album.title }}</span>
              <span class="album-artist">
                {{ album.albumartists?.map((a) => a.name).join(', ') || 'Unknown' }}
              </span>
            </div>
            <div class="album-meta">
              <svg class="trend-icon" :class="getTrendClass(album.trend)" viewBox="0 0 24 24">
                <path :d="getTrendIcon(album.trend)" fill="currentColor" />
              </svg>
              <span class="help-text">{{ album.help_text }}</span>
            </div>
          </li>
        </ol>
      </section>

      <!-- top artists -->
      <section class="chart-section">
        <div class="chart-header">
          <h2>Top Artists</h2>
          <div v-if="statsStore.artistsScrobbles" class="scrobbles-info">
            <span>{{ statsStore.artistsScrobbles.text }}</span>
            <svg
              class="trend-icon"
              :class="getTrendClass(statsStore.artistsScrobbles.trend)"
              viewBox="0 0 24 24"
            >
              <path :d="getTrendIcon(statsStore.artistsScrobbles.trend)" fill="currentColor" />
            </svg>
          </div>
        </div>

        <div v-if="statsStore.isLoadingArtists" class="chart-loading">
          <div class="spinner"></div>
        </div>

        <div v-else-if="statsStore.topArtists.length === 0" class="chart-empty">
          No artists played in this period
        </div>

        <ol v-else class="artist-list">
          <li
            v-for="(artist, index) in statsStore.topArtists"
            :key="artist.artisthash"
            class="chart-artist"
            @click="goToArtist(artist)"
          >
            <span class="rank">{{ index + 1 }}</span>
            <img v-if="getArtistImage(artist)" :src="getArtistImage(artist)" class="artist-image" />
            <div class="artist-info">
              <span class="artist-name">{{ artist.name }}</span>
            </div>
            <div class="artist-meta">
              <svg class="trend-icon" :class="getTrendClass(artist.trend)" viewBox="0 0 24 24">
                <path :d="getTrendIcon(artist.trend)" fill="currentColor" />
              </svg>
              <span class="help-text">{{ artist.help_text }}</span>
            </div>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.stats-view {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.stats-header h1 {
  font-size: 28px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
}

.stats-controls {
  display: flex;
  gap: 16px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.control-group label {
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

.control-group select {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-outline-variant);
  background-color: var(--color-surface);
  color: var(--color-on-surface);
  font-size: 14px;
  cursor: pointer;
  min-width: 140px;
}

.control-group select:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* stats summary cards */
.stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: var(--color-surface-variant);
  border-radius: 12px;
}

.stat-image {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.stat-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.stat-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-title {
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

/* charts grid */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 24px;
}

.chart-section {
  background-color: var(--color-surface);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--color-outline-variant);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-outline-variant);
}

.chart-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
}

.scrobbles-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

.chart-loading {
  display: flex;
  justify-content: center;
  padding: 32px;
}

.spinner {
  width: 32px;
  height: 32px;
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

.chart-empty {
  padding: 32px;
  text-align: center;
  color: var(--color-on-surface-variant);
  font-size: 14px;
}

/* lists */
.track-list,
.album-list,
.artist-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chart-track,
.chart-album,
.chart-artist {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.chart-track:hover,
.chart-album:hover,
.chart-artist:hover {
  background-color: var(--color-surface-variant);
}

.chart-track.is-playing {
  background-color: var(--color-primary-container);
}

.rank {
  width: 24px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.track-image,
.album-image {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.artist-image {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.track-info,
.album-info,
.artist-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.track-title,
.album-title,
.artist-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist,
.album-artist {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-meta,
.album-meta,
.artist-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.help-text {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  white-space: nowrap;
}

/* trend icons */
.trend-icon {
  width: 16px;
  height: 16px;
}

.trend-up {
  color: var(--color-success, #4caf50);
}

.trend-down {
  color: var(--color-error, #f44336);
}

.trend-stable {
  color: var(--color-on-surface-variant);
}

/* responsive */
@media (max-width: 768px) {
  .stats-view {
    padding: 16px;
  }

  .stats-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
