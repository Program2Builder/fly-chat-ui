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

export function getMediaUrl(
  mediaId: string,
  uploadedMedia?: MediaUploadResponse | null,
) {
  if (uploadedMedia?.downloadUrl) {
    return toAbsoluteMediaUrl(uploadedMedia.downloadUrl)
  }

  return buildMediaDownloadUrl(mediaId)
}
