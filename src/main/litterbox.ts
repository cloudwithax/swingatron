// litterbox image upload service for discord rpc artwork
// uploads images temporarily to litterbox.catbox.moe for public url access

const LITTERBOX_API = 'https://litterbox.catbox.moe/resources/internals/api.php'
const UPLOAD_EXPIRY = '1h' // 1h, 12h, 24h, or 72h

// cache uploaded image urls to avoid re-uploading the same image
const imageUrlCache = new Map<string, { url: string; expiry: number }>()

// clean up expired cache entries
function cleanupCache(): void {
  const now = Date.now()
  for (const [key, value] of imageUrlCache.entries()) {
    if (value.expiry < now) {
      imageUrlCache.delete(key)
    }
  }
}

// get cache key from image data
function getCacheKey(imageHash: string): string {
  return imageHash
}

// get expiry time based on UPLOAD_EXPIRY
function getExpiryMs(): number {
  const expiryMap: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '72h': 72 * 60 * 60 * 1000
  }
  // return slightly less than actual expiry to avoid edge cases
  return (expiryMap[UPLOAD_EXPIRY] || expiryMap['1h']) * 0.9
}

export async function uploadImageToLitterbox(
  imageUrl: string,
  imageHash: string
): Promise<string | null> {
  const cacheKey = getCacheKey(imageHash)

  // check cache first
  const cached = imageUrlCache.get(cacheKey)
  if (cached && cached.expiry > Date.now()) {
    return cached.url
  }

  // clean up old entries
  cleanupCache()

  try {
    // fetch the image from the local server
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      return null
    }

    const imageBlob = await imageResponse.blob()

    // create form data for litterbox upload
    const formData = new FormData()
    formData.append('reqtype', 'fileupload')
    formData.append('time', UPLOAD_EXPIRY)
    formData.append('fileToUpload', imageBlob, `${imageHash}.jpg`)

    // upload to litterbox
    const uploadResponse = await fetch(LITTERBOX_API, {
      method: 'POST',
      body: formData
    })

    if (!uploadResponse.ok) {
      return null
    }

    const uploadedUrl = await uploadResponse.text()

    // cache the result
    imageUrlCache.set(cacheKey, {
      url: uploadedUrl.trim(),
      expiry: Date.now() + getExpiryMs()
    })

    return uploadedUrl.trim()
  } catch {
    return null
  }
}

export function clearImageCache(): void {
  imageUrlCache.clear()
}
