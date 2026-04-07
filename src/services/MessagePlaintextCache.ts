/**
 * MessagePlaintextCache
 *
 * IndexedDB-backed store that maps (userId + messageId) → decrypted plaintext.
 *
 * WHY THIS EXISTS — The WhatsApp model:
 *   Signal Protocol messages can only be decrypted ONCE (Double Ratchet).
 *   WhatsApp solves this by writing plaintext to a local SQLite DB immediately
 *   after decryption, then reading from the DB — never re-decrypting from the
 *   server.  We mirror that pattern using IndexedDB.
 *
 * USER SCOPING:
 *   Keys are prefixed with the current user's ID so that if User A logs out
 *   and User B logs in on the same browser, User B cannot read User A's cache.
 *   The cache survives logout intentionally (messages should remain readable
 *   after re-login, just like WhatsApp's local database persists across
 *   re-launches).
 */

import { get, set, del } from 'idb-keyval'

const CACHE_PREFIX = 'fc-msg-plain'
const MAX_AGE_MS   = 90 * 24 * 60 * 60 * 1000   // 90 days

interface CachedEntry {
  plaintext: string
  cachedAt:  number   // Date.now() timestamp
}

/** Call this as soon as the user identity is known (before any read/write). */
let _userId: string | null = null
export function setCacheUser(userId: string | number): void {
  _userId = String(userId)
}

function cacheKey(msgId: string): string {
  if (!_userId) {
    console.warn('[MessageCache] setCacheUser() not called — falling back to anonymous scope.')
    return `${CACHE_PREFIX}-anon-${msgId}`
  }
  return `${CACHE_PREFIX}-${_userId}-${msgId}`
}

/**
 * Store a plaintext for the given message ID.
 * Safe to call multiple times for the same ID (idempotent).
 */
export async function cachePlaintext(msgId: string | undefined, plaintext: string): Promise<void> {
  if (!msgId) return
  const entry: CachedEntry = { plaintext, cachedAt: Date.now() }
  await set(cacheKey(msgId), entry)
}

/**
 * Retrieve a cached plaintext.
 * Returns null if not found or if the entry has expired.
 */
export async function getCachedPlaintext(msgId: string | undefined): Promise<string | null> {
  if (!msgId) return null
  const entry: CachedEntry | undefined = await get(cacheKey(msgId))
  if (!entry) return null
  if (Date.now() - entry.cachedAt > MAX_AGE_MS) {
    await del(cacheKey(msgId))   // evict stale entry
    return null
  }
  return entry.plaintext
}
