import { API_BASE_URL } from '../config'

/**
 * Returns the full URL for a user's profile picture or undefined if no URL is provided.
 */
export function getAvatarUrl(relativeUrl: string | null | undefined): string | undefined {
  if (!relativeUrl) return undefined
  if (relativeUrl.startsWith('http')) return relativeUrl
  return `${API_BASE_URL}${relativeUrl}`
}
