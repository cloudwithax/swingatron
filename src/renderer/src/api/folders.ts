import apiClient from './client'
import type { FolderContentRequest, FolderContentResponse, Track } from './types'

interface RootDirsResponse {
  root_dirs?: string[]
  dirs?: string[]
}

/**
 * Get root folders (directories)
 */
export async function getRootFolders(): Promise<string[]> {
  const response = await apiClient.get<RootDirsResponse>('/notsettings/get-root-dirs')
  return response.data.root_dirs || response.data.dirs || []
}

/**
 * Get folder content (folders and tracks)
 */
export async function getFolderContent(
  request: FolderContentRequest
): Promise<FolderContentResponse> {
  const response = await apiClient.post<FolderContentResponse>('/folder', {
    folder: request.folder,
    start: request.start,
    limit: request.limit,
    tracks_only: false
  })
  return response.data
}

/**
 * Get all tracks in a folder (for playing all)
 */
export async function getAllTracksInFolder(folderPath: string): Promise<Track[]> {
  const response = await apiClient.post<{ tracks: Track[] }>('/folder/tracks', {
    folder: folderPath
  })
  return response.data.tracks
}

/**
 * Build folder path from a given path (for "Go to folder" feature)
 */
export function buildFolderPath(fullPath: string): string[] {
  const parts = fullPath.split(/[/\\]/).filter(Boolean)
  const paths: string[] = []

  let currentPath = ''
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    paths.push(currentPath)
  }

  return paths
}

/**
 * Get parent folder path
 */
export function getParentFolder(folderPath: string): string | null {
  const normalized = folderPath.replace(/\\/g, '/')
  const lastSlash = normalized.lastIndexOf('/')

  if (lastSlash <= 0) return null
  return normalized.substring(0, lastSlash)
}
