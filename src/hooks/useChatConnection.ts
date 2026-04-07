import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SignalProtocolAddress } from '@privacyresearch/libsignal-protocol-typescript'
import { fetchAuthenticatedUser, loginUser } from '../api/authApi'
import {
  fetchBootstrap,
  fetchContacts,
  fetchGroups,
  fetchRoomHistory,
  fetchDirectHistory,
  uploadMedia,
  addContact as apiAddContact,
  removeContact as apiRemoveContact,
  deleteGroup as apiDeleteGroup,
  uploadProfilePicture as apiUploadProfilePicture,
  apiCreateGroup,
  uploadEncryptionKeys,
  fetchUserEncryptionBundle,
  updateProfile as apiUpdateProfile,
} from '../api/chatApi'
import { encryptionService, groupEncryptionService } from '../services/EncryptionService'
import { cachePlaintext, getCachedPlaintext, setCacheUser } from '../services/MessagePlaintextCache'
import { vaultApi } from '../api/vaultApi'
import { deriveVaultKey, encryptForVault, decryptFromVault } from '../services/vaultCrypto'
import type {
  ActiveConversation,
  AuthSession,
  AuthUser,
  ChatContact,
  ChatError,
  ChatGroup,
  ChatMessage,
  ConnectionStatus,
  MediaUploadResponse,
} from '../types/chat'
import { ChatSocket } from '../websocket/chatSocket'
import { useLocalStorage } from './useLocalStorage'
import { useTypingIndicator } from './useTypingIndicator'

function getMessageFingerprint(message: ChatMessage) {
  return [
    message.type,
    message.senderId,
    message.roomId ?? '',
    [...(message.recipients ?? [])].sort().join(','),
    message.content ?? '',
    message.mediaId ?? '',
  ].join('|')
}

function getMessageKey(message: ChatMessage) {
  if (message.id) {
    return `id:${message.id}`
  }

  const recipients = [...(message.recipients ?? [])].sort().join(',')
  return [
    message.type,
    message.senderId,
    message.senderName ?? '',
    message.roomId ?? '',
    recipients,
    message.content ?? '',
    message.mediaId ?? '',
    message.timestamp ?? '',
  ].join('|')
}

function dedupeAndSort(messages: ChatMessage[]) {
  const map = new Map<string, ChatMessage>()
  messages.forEach((message) => {
    map.set(getMessageKey(message), message)
  })

  return Array.from(map.values()).sort((left, right) => {
    const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0
    const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0
    return leftTime - rightTime
  })
}

function appendMessageWithLiveMerge(messages: ChatMessage[], incoming: ChatMessage) {
  const incomingFingerprint = getMessageFingerprint(incoming)
  const incomingTime = incoming.timestamp ? new Date(incoming.timestamp).getTime() : 0

  const merged = [...messages]
  const existingIndex = merged.findIndex((message) => {
    if (incoming.id && message.id === incoming.id) {
      return true
    }

    const sameFingerprint = getMessageFingerprint(message) === incomingFingerprint
    if (!sameFingerprint) {
      return false
    }

    const existingTime = message.timestamp ? new Date(message.timestamp).getTime() : 0
    return Math.abs(existingTime - incomingTime) < 15000
  })

  if (existingIndex >= 0) {
    merged[existingIndex] = {
      ...merged[existingIndex],
      ...incoming,
    }
    return merged
  }

  merged.push(incoming)
  return merged
}

async function syncEntireVaultToCache(token: string, vaultKey: CryptoKey | null) {
  if (!vaultKey) return
  
  console.group('[Vault] 🔄 Synchronization start')
  let currentPage = 0
  let totalRestored = 0
  
  try {
    while (true) {
      console.debug(`[Vault] Fetching page ${currentPage}...`)
      const page = await vaultApi.fetchAll(token, currentPage, 50)
      
      if (page.entries.length > 0) {
        await Promise.all(page.entries.map(async (item: any) => {
          try {
            const plaintext = await decryptFromVault(item.ciphertext, vaultKey)
            if (plaintext) {
              await cachePlaintext(item.messageId, plaintext)
              totalRestored++
            }
          } catch (e) {
            console.warn(`[Vault] Failed to decrypt entry ${item.messageId}:`, e)
          }
        }))
      }
      
      if (!page.hasMore || page.entries.length === 0) break
      currentPage++
    }
    console.log(`[Vault] ✅ Sync complete. Restored ${totalRestored} entries into cache.`)
  } catch (error) {
    console.error('[Vault] ❌ Synchronization failed:', error)
  } finally {
    console.groupEnd()
  }
}

function normalizeContacts(contacts: ChatContact[]) {
  return [...contacts].sort((left, right) => {
    const leftTime = left.lastInteractionAt ? new Date(left.lastInteractionAt).getTime() : 0
    const rightTime = right.lastInteractionAt ? new Date(right.lastInteractionAt).getTime() : 0
    return rightTime - leftTime
  })
}

function getDirectConversationKey(message: ChatMessage, currentUsername: string) {
  if (message.senderId === currentUsername) {
    return message.recipients?.[0] ?? ''
  }

  return message.senderId
}

export function useChatConnection() {
  const socketRef = useRef<ChatSocket | null>(null)
  const restoreSessionRef = useRef<AuthSession | null>(null)
  const bootstrappedTokenRef = useRef<string | null>(null)
  
  /**
   * The zero-knowledge vault key. 
   * Lives ONLY in memory and sessionStorage (for refresh survival).
   */
  const vaultKeyRef = useRef<CryptoKey | null>(null)
  
  /**
   * Temporary store for outgoing messages awaiting server echo.
   * We use a ref here to ensure the data is never stale in socket callbacks.
   */
  const vaultSyncQueueRef = useRef<Array<{
    timestamp: number;
    fingerprint: string;
    content: string;
  }>>([])
  
  const [session, setSession] = useLocalStorage<AuthSession | null>('flychat-auth-session', null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(session?.user ?? null)
  // Always-fresh ref — updated in sync with state but readable in stale closures
  const currentUserRef = useRef<AuthUser | null>(session?.user ?? null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [errors, setErrors] = useState<ChatError[]>([])
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(session?.token))
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [groups, setGroups] = useState<ChatGroup[]>([])
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null)
  
  interface ConversationState {
    messages: ChatMessage[]
    hasNext: boolean
    currentPage: number
    hasLoadedInitial: boolean
  }

  const [groupMessages, setGroupMessages] = useState<Record<string, ConversationState>>({})
  const [directMessages, setDirectMessages] = useState<Record<string, ConversationState>>({})
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [mediaLibrary, setMediaLibrary] = useState<Record<string, MediaUploadResponse>>({})

  const token = session?.token ?? ''

  const pushError = useCallback((source: ChatError['source'], message: string) => {
    setErrors((current) => [{ source, message }, ...current].slice(0, 6))
  }, [])

  const clearErrors = useCallback(() => setErrors([]), [])

  const sendSocketMessage = useCallback((message: ChatMessage) => {
    if (!socketRef.current?.isConnected()) {
      throw new Error('Connect to the chat server first.')
    }

    socketRef.current.publish(message)
  }, [])

  // Keep the ref in sync with the state so all callbacks always see the live user
  useEffect(() => { currentUserRef.current = currentUser }, [currentUser])

  /**
   * Fire-and-forget: encrypt `plaintext` with the vault key and store to server.
   * Silently skips if vault key is unavailable (page refresh without password).
   * Never throws — failures are logged only.
   */
  const encryptAndStoreToVault = useCallback(
    (messageId: string | undefined, plaintext: string) => {
      const vk = vaultKeyRef.current
      if (!messageId || !token || !vk) return
      encryptForVault(plaintext, vk)
        .then((ciphertext) => vaultApi.store(messageId, ciphertext, token))
        .catch((err) => console.debug('[Vault] Store skipped/failed:', err?.message))
    },
    [token],
  )

  const handleSendTyping = useCallback(
    (message: ChatMessage) => {
      try {
        sendSocketMessage(message)
      } catch (error) {
        const readable =
          error instanceof Error ? error.message : 'Failed to send typing event.'
        pushError('websocket', readable)
      }
    },
    [pushError, sendSocketMessage],
  )

  /** Export key bytes → base64 → sessionStorage for refresh survival. */
  const saveVaultKeyToSession = useCallback(async (key: CryptoKey) => {
    try {
      const raw = await window.crypto.subtle.exportKey('raw', key)
      const b64 = btoa(String.fromCharCode(...new Uint8Array(raw)))
      sessionStorage.setItem('fc-vk', b64)
    } catch { /* sessionStorage unavailable */ }
  }, [])

  /** Restore key from sessionStorage if present. */
  const restoreVaultKeyFromSession = useCallback(async () => {
    try {
      const raw = sessionStorage.getItem('fc-vk')
      if (!raw) return null
      const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
      return await window.crypto.subtle.importKey(
        'raw', keyBytes, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
      )
    } catch { return null }
  }, [])

  const typing = useTypingIndicator({
    userId: currentUser?.username ?? '',
    userName: currentUser?.displayName ?? '',
    sendTyping: handleSendTyping,
  })

  const appendIncomingMessage = useCallback(
    (message: ChatMessage) => {
      // Use the ref so this callback is never stale (called during bootstrap when
      // currentUser state hasn't propagated yet)
      const user = currentUserRef.current
      if (!user || message.type === 'TYPING') {
        return
      }

      if (message.roomId) {
        setGroupMessages((current) => {
          const state = current[message.roomId!] || { 
            messages: [], 
            hasNext: false, 
            currentPage: 0,
            hasLoadedInitial: false
          }
          return {
            ...current,
            [message.roomId!]: {
              ...state,
              messages: dedupeAndSort(appendMessageWithLiveMerge(state.messages, message)),
            },
          }
        })
        return
      }

      const conversationKey = getDirectConversationKey(message, user.username)
      if (!conversationKey) {
        return
      }

      setDirectMessages((current) => {
        const state = current[conversationKey] || { 
          messages: [], 
          hasNext: false, 
          currentPage: 0,
          hasLoadedInitial: false
        }
        return {
          ...current,
          [conversationKey]: {
            ...state,
            messages: dedupeAndSort(appendMessageWithLiveMerge(state.messages, message)),
          },
        }
      })
    },
    [currentUser],
  )

  const resetEncryption = useCallback(async (): Promise<void> => {
    if (!token || !currentUser) {
      console.error('[E2EE] resetEncryption: not logged in – token:', token, 'user:', currentUser)
      throw new Error('You must be logged in to reset encryption keys.')
    }

    setUploading(true)
    console.group('[E2EE] 🔄 resetEncryption – start')
    try {
      // Step 1: wipe all local keys
      console.log('[E2EE] Step 1/4 – wiping local IndexedDB keys...')
      await encryptionService.reset()
      console.log('[E2EE] Step 1/4 done.')

      // Step 2: re-bind the service to the user
      console.log('[E2EE] Step 2/4 – re-setting account context...')
      await encryptionService.setAccountContext(currentUser)
      console.log('[E2EE] Step 2/4 done. context user:', currentUser.username)

      // Step 3: generate fresh keys
      console.log('[E2EE] Step 3/4 – generating new identity keys...')
      await encryptionService.initialize()
      console.log('[E2EE] Step 3/4 done.')

      // Step 4: upload the new bundle to the server (unconditional)
      console.log('[E2EE] Step 4/4 – fetching bundle & uploading to server...')
      const bundle = await encryptionService.getEncryptionBundle()
      console.log('[E2EE] Bundle ready | sigLen:', bundle.signedPreKey?.signature?.length ?? 0,
        '| preKeys:', bundle.oneTimePreKeys?.length ?? 0)
      await uploadEncryptionKeys(bundle, token)
      console.log('[E2EE] Step 4/4 done. ✅ New keys live on server.')
    } finally {
      console.groupEnd()
      setUploading(false)
    }
  }, [token, currentUser])

  const handleIncomingMessage = useCallback(
    async (message: ChatMessage) => {
      if (message.type === 'TYPING') {
        typing.registerIncomingTyping(message)
        return
      }
      
      let processedMessage = { ...message }
      const user = currentUserRef.current  // always-fresh, no stale closure

      // Normalise isEncrypted: backend may use 'encrypted' or 'isEncrypted'
      const isEnc = processedMessage.isEncrypted || (processedMessage as any).encrypted || false

      if (isEnc && user) {
        // Handle echoed own outgoing messages: we already rendered plaintext locally,
        // but we MUST capture the server-assigned message ID to cache/vault it correctly
        // so history looks correct after a page reload.
        if (processedMessage.senderId === user.username) {
          typing.clearSenderTyping(processedMessage.senderId)
          
          const incomingTime = processedMessage.timestamp ? new Date(processedMessage.timestamp).getTime() : 0
          // Calculate fingerprint without content (since echo is encrypted, local was plain)
          const fingerprint = [
            processedMessage.type,
            processedMessage.senderId,
            processedMessage.roomId ?? '',
            [...(processedMessage.recipients ?? [])].sort().join(','),
          ].join('|')

          // Guard against HMR state desync (ensure it's an array)
          if (!Array.isArray(vaultSyncQueueRef.current)) vaultSyncQueueRef.current = []

          // Find the best match in the pending queue (matching fingerprint + within 30s window)
          const matchIndex = vaultSyncQueueRef.current.findIndex(p => 
            p.fingerprint === fingerprint && Math.abs(p.timestamp - incomingTime) < 30000
          )
          
          if (matchIndex !== -1) {
            const pending = vaultSyncQueueRef.current[matchIndex]
            console.debug('[Vault] Echo matched: caching final ID', processedMessage.id)
            void cachePlaintext(processedMessage.id, pending.content)
            encryptAndStoreToVault(processedMessage.id, pending.content)
            // Remove from queue
            vaultSyncQueueRef.current.splice(matchIndex, 1)
          }
          return
        }

        if (processedMessage.roomId && (processedMessage as any).isGroupEncryption) {
          try {
            const decryptedText = await groupEncryptionService.decryptGroupMessage(
              processedMessage.roomId,
              processedMessage.senderId,
              processedMessage,
              user.username
            )
            processedMessage.content = decryptedText
            await cachePlaintext(processedMessage.id, decryptedText)   // ← cache
            encryptAndStoreToVault(processedMessage.id, decryptedText) // ← vault (fire & forget)
          } catch (error: any) {
            console.warn('[E2EE] Group decryption failed:', error)
            processedMessage.content = '[🔐 Encrypted group message – decryption failed]'
          }
        } else if (!processedMessage.roomId) {
          // Build a fallback ciphertext descriptor when encryptionMetadata is absent
          const meta = processedMessage.encryptionMetadata ?? {
            type: 3,
            body: processedMessage.content,
          }
          console.debug('[E2EE] Decrypting from', processedMessage.senderId,
            'meta type:', meta?.type, 'has body:', Boolean(meta?.body))
          try {
            const decryptedText = await encryptionService.decryptMessage(
              processedMessage.senderId,
              meta
            )
            processedMessage.content = decryptedText
            await cachePlaintext(processedMessage.id, decryptedText)   // ← cache so reload works
            encryptAndStoreToVault(processedMessage.id, decryptedText) // ← vault (fire & forget)
          } catch (error: any) {
            const isInvalidKey = error?.message?.includes('Invalid private key') ||
                                 error?.message?.includes('identity private key')
            if (isInvalidKey) {
              console.error('[E2EE] CRITICAL: Local keys invalid. Triggering silent repair.', error)
              processedMessage.content = '[🔐 Security repair in progress — please refresh]'
              if (!(window as any)._isRepairingSignal) {
                ;(window as any)._isRepairingSignal = true
                resetEncryption()
                  .catch(err => console.error('[E2EE] Silent repair failed:', err))
                  .finally(() => { setTimeout(() => { (window as any)._isRepairingSignal = false }, 5000) })
              }
            } else {
              console.warn('[E2EE] Decryption failed from', processedMessage.senderId, '| error:', error?.message)
              processedMessage.content = '[🔐 Encrypted message – decryption failed]'
            }
            // Clear broken session so next message triggers a fresh X3DH
            try {
              const address = new SignalProtocolAddress(processedMessage.senderId, 1)
              await (encryptionService.getStore() as any).removeSession(address.toString())
            } catch (e) {
              console.error('[E2EE] Failed to clear broken session:', e)
            }
          }
        }
      }

      typing.clearSenderTyping(processedMessage.senderId)
      appendIncomingMessage(processedMessage)
    },
    [appendIncomingMessage, typing, resetEncryption],  // currentUser removed — uses ref
  )

  const processMessagesWithDecryption = useCallback(
    async (messages: ChatMessage[]) => {
      // Use the ref so this is never stale when called synchronously during bootstrap
      const user = currentUserRef.current
      if (!user) return messages

      const processed = await Promise.all(
        messages.map(async (msg) => {
          let processedMessage = { ...msg }

          // Normalise isEncrypted field (backend may use either name)
          const isEnc = processedMessage.isEncrypted || (processedMessage as any).encrypted || false
          if (!isEnc) return processedMessage

          // ── Cache first: never re-process an already-consumed Signal message ──
          const cached = await getCachedPlaintext(processedMessage.id)
          if (cached !== null) {
            processedMessage.content = cached
            return processedMessage
          }

          if (processedMessage.roomId && (processedMessage as any).isGroupEncryption) {
            try {
              const decryptedText = await groupEncryptionService.decryptGroupMessage(
                processedMessage.roomId,
                processedMessage.senderId,
                processedMessage,
                user.username
              )
              processedMessage.content = decryptedText
              await cachePlaintext(processedMessage.id, decryptedText)
              encryptAndStoreToVault(processedMessage.id, decryptedText) // ← vault (fire & forget)
            } catch {
              processedMessage.content = '[\uD83D\uDD10 Encrypted group message \u2013 decryption failed]'
            }
          } else if (!processedMessage.roomId) {
            if (processedMessage.senderId === user.username) {
              // Own sent DMs: Signal cannot decrypt its own ciphertext.
              // Try to restore from the Message Vault before giving up.
              const vk = vaultKeyRef.current
              if (processedMessage.id && token && vk) {
                try {
                  const vaultItem = await vaultApi.fetchOne(processedMessage.id, token)
                  if (vaultItem && vaultItem.ciphertext) {
                    const decrypted = await decryptFromVault(vaultItem.ciphertext, vk)
                    if (decrypted) {
                      processedMessage.content = decrypted
                      await cachePlaintext(processedMessage.id, decrypted)
                      return processedMessage
                    }
                  }
                } catch (e) {
                  console.warn('[Vault] On-demand restore failed for', processedMessage.id, e)
                }
              }
              // If vault restore also fails, THEN show a (more descriptive) placeholder
              processedMessage.content = '[\uD83D\uDD10 Message vaulted \u2013 restoring...]'
            } else {
              // Build fallback descriptor when encryptionMetadata is absent
              const meta = processedMessage.encryptionMetadata ?? {
                type: 3,
                body: processedMessage.content,
              }
              try {
                const decryptedText = await encryptionService.decryptMessage(
                  processedMessage.senderId,
                  meta
                )
                processedMessage.content = decryptedText
                await cachePlaintext(processedMessage.id, decryptedText)
                encryptAndStoreToVault(processedMessage.id, decryptedText) // ← vault (fire & forget)
              } catch {
                processedMessage.content = '[\uD83D\uDD10 Encrypted message \u2013 decryption failed]'
              }
            }
          }
          return processedMessage
        })
      )
      return processed
    },
    [] // no currentUser dependency — reads from currentUserRef which is always fresh
  )

  const connectSocket = useCallback(
    (user: AuthUser, liveGroups: ChatGroup[]) => {
      setStatus('connecting')
      if (!socketRef.current) {
        socketRef.current = new ChatSocket()
      }

      socketRef.current.connect({
        userId: user.username,
        onConnect: () => {
          setStatus('connected')
          socketRef.current?.subscribeToRooms(
            liveGroups.map((group) => group.roomId),
            handleIncomingMessage,
          )
        },
        onDisconnect: () => {
          setStatus((current) => (current === 'error' ? current : 'disconnected'))
        },
        onError: (message) => {
          setStatus('error')
          pushError('websocket', message)
        },
        onMessage: handleIncomingMessage,
      })
    },
    [handleIncomingMessage, pushError],
  )

  const ensureGroupHistory = useCallback(
    async (roomId: string, authToken: string) => {
      setLoadingHistory(true)
      try {
        const slice = await fetchRoomHistory(roomId, authToken, 0)
        let initialMessages = [...slice.content].reverse()
        initialMessages = await processMessagesWithDecryption(initialMessages)

        setGroupMessages((current) => ({
          ...current,
          [roomId]: {
            messages: dedupeAndSort(initialMessages.filter((m) => m.type !== 'TYPING')),
            hasNext: !slice.last,
            currentPage: 0,
            hasLoadedInitial: true,
          },
        }))
      } catch (error) {
        const readable =
          error instanceof Error ? error.message : 'Unable to load room history.'
        pushError('rest', readable)
      } finally {
        setLoadingHistory(false)
      }
    },
    [pushError, processMessagesWithDecryption],
  )

  const ensureDirectHistory = useCallback(
    async (contactId: string, authToken: string) => {
      setLoadingHistory(true)
      try {
        const slice = await fetchDirectHistory(contactId, authToken, 0)
        let initialMessages = [...slice.content].reverse()
        initialMessages = await processMessagesWithDecryption(initialMessages)

        setDirectMessages((current) => ({
          ...current,
          [contactId]: {
            messages: dedupeAndSort(initialMessages.filter((m) => m.type !== 'TYPING')),
            hasNext: !slice.last,
            currentPage: 0,
            hasLoadedInitial: true,
          },
        }))
      } catch (error) {
        const readable =
          error instanceof Error ? error.message : 'Unable to load direct chat history.'
        pushError('rest', readable)
      } finally {
        setLoadingHistory(false)
      }
    },
    [pushError, processMessagesWithDecryption],
  )

  const loadMoreHistory = useCallback(async () => {
    if (!activeConversation || !token || loadingHistory) return

    const isGroup = activeConversation.type === 'group'
    const id = isGroup ? activeConversation.group.roomId : activeConversation.contact.id
    const currentState = isGroup ? groupMessages[id] : directMessages[id]

    if (!currentState || !currentState.hasNext) return

    setLoadingHistory(true)
    try {
      const nextPage = currentState.currentPage + 1
      const slice = isGroup 
        ? await fetchRoomHistory(id, token, nextPage)
        : await fetchDirectHistory(id, token, nextPage)
      
      let newMessages = [...slice.content].reverse()
      newMessages = await processMessagesWithDecryption(newMessages)

      const setter = isGroup ? setGroupMessages : setDirectMessages
      setter((current) => {
        const prev = current[id]
        return {
          ...current,
          [id]: {
            ...prev,
            messages: dedupeAndSort([...newMessages, ...prev.messages]),
            hasNext: !slice.last,
            currentPage: nextPage,
          },
        }
      })
    } catch (error) {
      pushError('rest', 'Unable to load more history.')
    } finally {
      setLoadingHistory(false)
    }
  }, [activeConversation, token, loadingHistory, groupMessages, directMessages, pushError, processMessagesWithDecryption])

  const bootstrapAuthenticatedChat = useCallback(
    async (authenticatedSession: AuthSession) => {
      setIsBootstrapping(true)
      try {
        const authenticatedUser = await fetchAuthenticatedUser(authenticatedSession.token)
        setCurrentUser(authenticatedUser)
        // Scope the plaintext cache to this user immediately
        setCacheUser(authenticatedUser.id)

        // ── Vault pre-warm — populate IndexedDB cache from server vault ───────────────
        try {
          if (!vaultKeyRef.current) {
            const restoredKey = await restoreVaultKeyFromSession()
            if (restoredKey) {
              vaultKeyRef.current = restoredKey
              console.log('[Vault] Pre-warming IndexedDB cache from server vault...')
              void syncEntireVaultToCache(authenticatedSession.token, restoredKey)
            }
          }
        } catch (e) {
          console.warn('[Vault] Pre-warm failed:', e)
        }

        try {
          if (!encryptionService.isContextSet(authenticatedUser.id)) {
            console.log('[E2EE] Session restore path – setting account context without password.')
            await encryptionService.setAccountContext(authenticatedUser)
            // Restore vault key from session if possible (redundant but safe)
            const restoredKey = await restoreVaultKeyFromSession()
            if (restoredKey) {
              vaultKeyRef.current = restoredKey
              void syncEntireVaultToCache(authenticatedSession.token, restoredKey)
            }
          }
          await encryptionService.initialize()

          const localBundle = await encryptionService.getEncryptionBundle()
          let serverIdentityKey: string | null = null
          try {
            const existing = await fetchUserEncryptionBundle(authenticatedUser.username, authenticatedSession.token)
            serverIdentityKey = existing?.identityPublicKey ?? null
          } catch {
            serverIdentityKey = null
          }

          const keysMatch = serverIdentityKey !== null && serverIdentityKey === localBundle.identityPublicKey
          if (!keysMatch) {
            await uploadEncryptionKeys(localBundle, authenticatedSession.token)
          }
        } catch (e) {
          console.error('[E2EE] Bootstrap failed (non-fatal):', e)
        }

        const [bootstrapData, liveContacts, liveGroups] = await Promise.all([
          fetchBootstrap(authenticatedSession.token),
          fetchContacts(authenticatedSession.token),
          fetchGroups(authenticatedSession.token),
        ])

        setContacts(normalizeContacts(liveContacts))
        setGroups(liveGroups)
        
        const initialDirectState: Record<string, ConversationState> = {}
        for (const [contactId, messages] of Object.entries(bootstrapData.directMessages || {})) {
          const processed = await processMessagesWithDecryption(messages)
          initialDirectState[contactId] = {
            messages: dedupeAndSort(processed.filter((m) => m.type !== 'TYPING')),
            hasNext: true,
            currentPage: 0,
            hasLoadedInitial: true,
          }
        }
        setDirectMessages(initialDirectState)

        const initialGroupState: Record<string, ConversationState> = {}
        for (const [roomId, messages] of Object.entries(bootstrapData.groupMessages || {})) {
          const processed = await processMessagesWithDecryption(messages)
          initialGroupState[roomId] = {
            messages: dedupeAndSort(processed.filter((m) => m.type !== 'TYPING')),
            hasNext: true,
            currentPage: 0,
            hasLoadedInitial: true,
          }
        }
        setGroupMessages(initialGroupState)

        connectSocket(authenticatedUser, liveGroups)
      } catch (error: any) {
        console.error('Bootstrap failed:', error)
        setErrors([{ source: 'rest', message: error.message || 'Session expired or connection lost.' }])
        setSession(null)
      } finally {
        setIsBootstrapping(false)
      }
    },
    [connectSocket, setSession, processMessagesWithDecryption, restoreVaultKeyFromSession]
  )

  const login = useCallback(
    async (username: string, password: string) => {
      clearErrors()
      try {
        const nextSession = await loginUser(username, password)
        setSession(nextSession)
        bootstrappedTokenRef.current = nextSession.token
        
        await encryptionService.setAccountContext(nextSession.user, password)
        try {
          const vk = await deriveVaultKey(password, String(nextSession.user.id))
          vaultKeyRef.current = vk
          await saveVaultKeyToSession(vk)
          void syncEntireVaultToCache(nextSession.token, vk)
        } catch (vaultErr) {
          console.warn('[Vault] Key derivation failed:', vaultErr)
        }
        await bootstrapAuthenticatedChat(nextSession)
      } catch (error: any) {
        console.error('Login process failed:', error)
        pushError('rest', error instanceof Error ? error.message : 'Unable to log in.')
        throw error
      }
    },
    [bootstrapAuthenticatedChat, clearErrors, pushError, saveVaultKeyToSession, setSession]
  )

  const logout = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current = null
    encryptionService.logout()
    vaultKeyRef.current = null
    try { sessionStorage.removeItem('fc-vk') } catch { }
    setSession(null)
    setCurrentUser(null)
    setContacts([])
    setGroups([])
    setActiveConversation(null)
    setGroupMessages({})
    setDirectMessages({})
    setMediaLibrary({})
    setErrors([])
    setStatus('disconnected')
  }, [setSession])

  const selectConversation = useCallback(
    async (conversation: ActiveConversation) => {
      setActiveConversation(conversation)
      const t = session?.token
      if (!t) return

      if (conversation.type === 'group') {
        const existingState = groupMessages[conversation.group.roomId]
        if (!existingState || !existingState.hasLoadedInitial) {
          await ensureGroupHistory(conversation.group.roomId, t)
        }
      } else if (conversation.type === 'direct') {
        const existingState = directMessages[conversation.contact.id]
        if (!existingState || !existingState.hasLoadedInitial) {
          await ensureDirectHistory(conversation.contact.id, t)
        }
        try {
          const bundle = await fetchUserEncryptionBundle(conversation.contact.id, t)
          await encryptionService.preEstablishSession(conversation.contact.id, bundle)
        } catch (e) {
          console.warn('[E2EE] Pre-fetch failed:', e)
        }
      }
    },
    [directMessages, ensureDirectHistory, ensureGroupHistory, session?.token, groupMessages],
  )

  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!currentUser || !session?.token || !activeConversation) return

      const trimmedText = text.trim()
      if (!trimmedText) return

      let finalMessage: ChatMessage = {
        senderId: currentUser.username,
        senderName: currentUser.displayName,
        roomId: activeConversation.type === 'group' ? activeConversation.group.roomId : undefined,
        recipients: activeConversation.type === 'direct' ? [activeConversation.contact.id] : undefined,
        content: trimmedText,
        type: 'TEXT',
        timestamp: new Date().toISOString(),
      }

      if (activeConversation.type === 'direct') {
        try {
          const bundle = await fetchUserEncryptionBundle(activeConversation.contact.id, session.token)
          const encryptedData = await encryptionService.encryptMessage(
            activeConversation.contact.id, trimmedText, bundle
          )
          finalMessage.isEncrypted = true
          finalMessage.content = encryptedData.body
          finalMessage.encryptionMetadata = encryptedData
        } catch (e) {
          console.error('[E2EE] Encryption failed:', e)
        }
      } else if (activeConversation.type === 'group') {
        try {
          const members = activeConversation.group.members ?? []
          const encryptedGroupData = await groupEncryptionService.encryptGroupMessage(
            activeConversation.group.roomId, members, trimmedText
          )
          finalMessage = { ...finalMessage, ...encryptedGroupData }
        } catch (e) {
          console.error('[E2EE] Group encryption failed:', e)
        }
      }

      const fingerprint = getMessageFingerprint(finalMessage)
      if (!Array.isArray(vaultSyncQueueRef.current)) vaultSyncQueueRef.current = []
      vaultSyncQueueRef.current.push({
        timestamp: new Date(finalMessage.timestamp!).getTime(),
        fingerprint,
        content: trimmedText
      })

      sendSocketMessage(finalMessage)
      appendIncomingMessage({ ...finalMessage, content: trimmedText, isEncrypted: false })
    },
    [activeConversation, appendIncomingMessage, currentUser, sendSocketMessage, session?.token],
  )

  const sendMediaMessage = useCallback(
    async (file: File) => {
      if (!currentUser || !session?.token || !activeConversation) return
      setUploading(true)
      try {
        let fileToUpload: File | Blob = file
        if (activeConversation.type === 'direct') {
          try {
            const encryptedData = await encryptionService.encryptFile(file)
            fileToUpload = encryptedData.encryptedBlob
          } catch (e) {
            console.error('File encryption failed:', e)
          }
        }

        const uploaded = await uploadMedia(fileToUpload as File, session.token)
        setMediaLibrary((current) => ({ ...current, [uploaded.id]: uploaded }))

        const finalMessage: ChatMessage = {
          senderId: currentUser.username,
          senderName: currentUser.displayName,
          roomId: activeConversation.type === 'group' ? activeConversation.group.roomId : undefined,
          recipients: activeConversation.type === 'direct' ? [activeConversation.contact.id] : undefined,
          mediaId: uploaded.id,
          type: 'MEDIA',
          timestamp: new Date().toISOString(),
        }

        sendSocketMessage(finalMessage)
        appendIncomingMessage({ ...finalMessage, isEncrypted: false })
      } catch (error) {
        pushError('rest', 'Unable to upload file.')
      } finally {
        setUploading(false)
      }
    },
    [activeConversation, appendIncomingMessage, currentUser, pushError, sendSocketMessage, session?.token],
  )

  const notifyTyping = useCallback(() => {
    if (status !== 'connected' || !activeConversation) return
    typing.notifyTyping({
      scope: activeConversation.type === 'group' ? 'room' : 'direct',
      roomId: activeConversation.type === 'group' ? activeConversation.group.roomId : undefined,
      recipients: activeConversation.type === 'direct' ? [activeConversation.contact.id] : undefined,
    })
  }, [activeConversation, status, typing])

  const addContact = useCallback(async (username: string) => {
    if (!session?.token) return
    await apiAddContact(username, session.token)
    const updatedContacts = await fetchContacts(session.token)
    setContacts(normalizeContacts(updatedContacts))
  }, [session?.token])

  const removeContact = useCallback(async (username: string) => {
    if (!session?.token) return
    await apiRemoveContact(username, session.token)
    setContacts((current) => current.filter((c) => c.id !== username))
    if (activeConversation?.type === 'direct' && activeConversation.contact.id === username) setActiveConversation(null)
  }, [activeConversation, session?.token])

  const deleteGroupAction = useCallback(async (groupId: number) => {
    if (!session?.token) return
    await apiDeleteGroup(groupId, session.token)
    setGroups((current) => current.filter((g) => g.id !== groupId))
    if (activeConversation?.type === 'group' && activeConversation.group.id === groupId) setActiveConversation(null)
  }, [activeConversation, session?.token])

  const updateProfilePicture = useCallback(async (file: File) => {
    if (!session?.token) return
    setUploading(true)
    try {
      await apiUploadProfilePicture(file, session.token)
      const updatedUser = await fetchAuthenticatedUser(session.token)
      setCurrentUser(updatedUser)
    } finally {
      setUploading(false)
    }
  }, [session?.token])

  const createGroup = useCallback(async (name: string, description: string, members: string[]) => {
    if (!session?.token) return
    const newGroup = await apiCreateGroup({ name, description, members }, session.token)
    const updatedGroups = await fetchGroups(session.token)
    setGroups(updatedGroups)
    return newGroup
  }, [session?.token])

  const updateProfile = useCallback(async (displayName: string, about: string) => {
    if (!session?.token) return
    setUploading(true)
    try {
      const updated = await apiUpdateProfile({ displayName, about }, session.token)
      setCurrentUser(updated)
      setSession((current) => current ? { ...current, user: updated } : null)
    } finally {
      setUploading(false)
    }
  }, [session?.token, setSession])

  useEffect(() => { restoreSessionRef.current = session }, [session])

  useEffect(() => {
    if (!session?.token) {
      bootstrappedTokenRef.current = null
      setIsBootstrapping(false)
      return
    }
    if (bootstrappedTokenRef.current !== session.token && restoreSessionRef.current) {
      bootstrappedTokenRef.current = session.token
      void bootstrapAuthenticatedChat(restoreSessionRef.current)
    }
  }, [bootstrapAuthenticatedChat, session?.token])

  useEffect(() => () => socketRef.current?.disconnect(), [])

  const activeMessages = useMemo(() => {
    if (!activeConversation) return []
    if (activeConversation.type === 'group') return groupMessages[activeConversation.group.roomId]?.messages ?? []
    return directMessages[activeConversation.contact.id]?.messages ?? []
  }, [activeConversation, directMessages, groupMessages])

  const hasNextPage = useMemo(() => {
    if (!activeConversation) return false
    const id = activeConversation.type === 'group' ? activeConversation.group.roomId : activeConversation.contact.id
    const state = activeConversation.type === 'group' ? groupMessages[id] : directMessages[id]
    return state?.hasNext ?? false
  }, [activeConversation, directMessages, groupMessages])

  let activeTypingNames: string[] = []
  if (activeConversation) {
    if (activeConversation.type === 'group') activeTypingNames = typing.getTypingNames('room', activeConversation.group.roomId)
    else activeTypingNames = typing.getTypingNames('direct', undefined, [activeConversation.contact.id])
  }

  return {
    token: session?.token ?? '',
    currentUser,
    isAuthenticated: Boolean(session?.token && currentUser),
    isBootstrapping,
    status,
    errors,
    clearErrors,
    contacts,
    groups,
    activeConversation,
    activeMessages,
    activeTypingNames,
    loadingHistory,
    uploading,
    mediaLibrary,
    login,
    logout,
    selectConversation,
    sendTextMessage,
    sendMediaMessage,
    notifyTyping,
    addContact,
    removeContact,
    deleteGroup: deleteGroupAction,
    updateProfile,
    updateProfilePicture,
    createGroup,
    loadMoreHistory,
    hasNextPage,
    isLoadingMore: loadingHistory,
    resetEncryption,
  }
}
