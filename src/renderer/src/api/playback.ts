import apiClient from './client'

export interface LogTrackRequest {
  trackhash: string
  duration: number
  source: string
  timestamp: number
}

/**
 * Log a track playback to the server
 * @param trackHash The hash of the track that was played
 * @param duration The duration in seconds that the track was played
 * @param source The source of the playback (e.g., 'electron', 'queue', 'search')
 */
export async function logTrackPlayback(
  trackHash: string,
  duration: number,
  source: string = 'electron'
): Promise<void> {
  const request: LogTrackRequest = {
    trackhash: trackHash,
    duration: Math.floor(duration),
    source,
    timestamp: Math.floor(Date.now() / 1000) // Unix timestamp in seconds
  }

  await apiClient.post('/logger/track/log', request)
}
