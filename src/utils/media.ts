import type { MediaUploadResponse } from '../types/chat'

import { API_BASE_URL } from '../config'

export function toAbsoluteMediaUrl(url: string) {
  if (!url) {
    return ''
  }

  if (/^https?:\/\//i.test(url)) {
    return url
  }

  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

export function buildMediaDownloadUrl(mediaId: string) {
  return toAbsoluteMediaUrl(`/api/chat/media/${encodeURIComponent(mediaId)}/download`)
}

export function isImageContentType(contentType?: string) {
  return contentType?.startsWith('image/') ?? false
}

export function isVideoContentType(contentType?: string) {
  return contentType?.startsWith('video/') ?? false
}

export function formatBytes(bytes?: number, decimals = 1) {
  if (bytes === undefined || bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function getMediaUrl(
  mediaId: string,
  uploadedMedia?: MediaUploadResponse | null,
) {
  if (uploadedMedia?.downloadUrl) {
    return toAbsoluteMediaUrl(uploadedMedia.downloadUrl)
  }

  return buildMediaDownloadUrl(mediaId)
}
