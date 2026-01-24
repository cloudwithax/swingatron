// utility functions for handling missing or failed images

// get appropriate placeholder svg for different content types
export function getPlaceholderSvg(type: 'album' | 'artist' | 'track'): string {
  // use a neutral gray color that works in both light and dark themes
  // currentcolor cant work in standalone data urls since there is no parent to inherit from
  if (type === 'album') {
    // music note icon
    return `<svg viewBox="0 0 24 24" fill="rgba(128,128,128,0.7)"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`
  }
  if (type === 'artist') {
    // person icon
    return `<svg viewBox="0 0 24 24" fill="rgba(128,128,128,0.7)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
  }
  // track (music note)
  return `<svg viewBox="0 0 24 24" fill="rgba(128,128,128,0.7)"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`
}

// convert svg string to data url for use in img src
export function getPlaceholderDataUrl(type: 'album' | 'artist' | 'track'): string {
  const svg = getPlaceholderSvg(type)
  return `data:image/svg+xml;base64,${btoa(svg)}`
}
