import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  updateProfile as apiUpdateProfile,
} from '../api/chatApi'
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
  const incomingTime = incoming.timestamp ? new Date(incoming.timestamp).getTime() : 0

  const merged = [...messages]
  const existingIndex = merged.findIndex((message) => {
    if (incoming.id && message.id === incoming.id) {
      return true
    }
    // Simple fingerprinting fallback if IDs are missing
    return (
      message.senderId === incoming.senderId &&
      message.type === incoming.type &&
      message.content === incoming.content &&
      Math.abs((message.timestamp ? new Date(message.timestamp).getTime() : 0) - incomingTime) < 15000
    )
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

function normalizeContacts(contacts: ChatContact[]) {
  return [...contacts].sort((left, right) => {
    const leftTime = left.lastInteractionAt ? new Date(left.lastInteractionAt).getTime() : 0
    const rightTime = right.lastInteractionAt ? new Date(right.lastInteractionAt).getTime() : 0
    return rightTime - leftTime
  })
}

function getDirectConversationKey(message: ChatMessage, currentUsername: string) {
  if (message.roomId) return message.roomId

  if (message.senderId === currentUsername) {
    return message.recipients?.[0] ?? ''
  }

  return message.senderId
}

export function useChatConnection() {
  const socketRef = useRef<ChatSocket | null>(null)
  const restoreSessionRef = useRef<AuthSession | null>(null)
  const bootstrappedTokenRef = useRef<string | null>(null)

  const [session, setSession] = useLocalStorage<AuthSession | null>('flychat-auth-session', null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(session?.user ?? null)
  const currentUserRef = useRef<AuthUser | null>(session?.user ?? null)
  const tokenRef = useRef<string>(session?.token ?? '')

  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [errors, setErrors] = useState<ChatError[]>([])
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(session?.token))
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [groups, setGroups] = useState<ChatGroup[]>([])
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null)
  const activeConversationRef = useRef<ActiveConversation | null>(null)

  useEffect(() => {
    activeConversationRef.current = activeConversation
  }, [activeConversation])

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

  useEffect(() => {
    currentUserRef.current = currentUser
    tokenRef.current = session?.token ?? ''
  }, [currentUser, session])

  const handleSendTyping = useCallback(
    (message: ChatMessage) => {
      try {
        sendSocketMessage(message)
      } catch (error) {
        const readable = error instanceof Error ? error.message : 'Failed to send typing event.'
        pushError('websocket', readable)
      }
    },
    [pushError, sendSocketMessage],
  )

  const typing = useTypingIndicator({
    userId: currentUser?.username ?? '',
    userName: currentUser?.displayName ?? '',
    sendTyping: handleSendTyping,
  })

  const appendIncomingMessage = useCallback(
    (message: ChatMessage) => {
      const user = currentUserRef.current
      if (!user || message.type === 'TYPING') return

      if (message.id && message.senderId !== user.username) {
        const activeConv = activeConversationRef.current
        const isGroupAndActive = message.roomId && activeConv?.type === 'group' && activeConv.group.roomId === message.roomId
        const isDirectAndActive = !message.roomId && activeConv?.type === 'direct' && activeConv.contact.id === message.senderId

        if (!message.status || message.status === 'SENT') {
          if (isGroupAndActive || isDirectAndActive) {
            socketRef.current?.publishStatus(message.id, 'READ')
          } else {
            socketRef.current?.publishStatus(message.id, 'DELIVERED')
          }
        } else if (message.status === 'DELIVERED') {
          if (isGroupAndActive || isDirectAndActive) {
            socketRef.current?.publishStatus(message.id, 'READ')
          }
        }
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
      if (!conversationKey) return

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
    []
  )

  const handleIncomingMessage = useCallback(
    async (message: ChatMessage) => {
      if (message.type === 'TYPING') {
        typing.registerIncomingTyping(message)
        return
      }
      typing.clearSenderTyping(message.senderId)
      appendIncomingMessage(message)
    },
    [appendIncomingMessage, typing],
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
        const initialMessages = [...slice.content].reverse()

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
        const readable = error instanceof Error ? error.message : 'Unable to load room history.'
        pushError('rest', readable)
      } finally {
        setLoadingHistory(false)
      }
    },
    [pushError],
  )

  const ensureDirectHistory = useCallback(
    async (contactId: string, authToken: string) => {
      setLoadingHistory(true)
      try {
        const slice = await fetchDirectHistory(contactId, authToken, 0)
        const initialMessages = [...slice.content].reverse()

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
        const readable = error instanceof Error ? error.message : 'Unable to load direct chat history.'
        pushError('rest', readable)
      } finally {
        setLoadingHistory(false)
      }
    },
    [pushError],
  )

  const loadMoreHistory = useCallback(async () => {
    const t = tokenRef.current
    if (!activeConversation || !t || loadingHistory) return

    const isGroup = activeConversation.type === 'group'
    const id = isGroup ? activeConversation.group.roomId : activeConversation.contact.id
    const currentState = isGroup ? groupMessages[id] : directMessages[id]

    if (!currentState || !currentState.hasNext) return

    setLoadingHistory(true)
    try {
      const nextPage = currentState.currentPage + 1
      const slice = isGroup
        ? await fetchRoomHistory(id, t, nextPage)
        : await fetchDirectHistory(id, t, nextPage)

      const newMessages = [...slice.content].reverse()

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
  }, [activeConversation, loadingHistory, groupMessages, directMessages, pushError])

  const bootstrapAuthenticatedChat = useCallback(
    async (authenticatedSession: AuthSession) => {
      setIsBootstrapping(true)
      try {
        const authenticatedUser = await fetchAuthenticatedUser(authenticatedSession.token)
        setCurrentUser(authenticatedUser)

        const [bootstrapData, liveContacts, liveGroups] = await Promise.all([
          fetchBootstrap(authenticatedSession.token),
          fetchContacts(authenticatedSession.token),
          fetchGroups(authenticatedSession.token),
        ])

        setContacts(normalizeContacts(liveContacts))
        setGroups(liveGroups)

        const initialDirectState: Record<string, ConversationState> = {}
        for (const [contactId, messages] of Object.entries(bootstrapData.directMessages || {})) {
          initialDirectState[contactId] = {
            messages: dedupeAndSort(messages.filter((m) => m.type !== 'TYPING')),
            hasNext: true,
            currentPage: 0,
            hasLoadedInitial: true,
          }
        }
        setDirectMessages(initialDirectState)

        const initialGroupState: Record<string, ConversationState> = {}
        for (const [roomId, messages] of Object.entries(bootstrapData.groupMessages || {})) {
          initialGroupState[roomId] = {
            messages: dedupeAndSort(messages.filter((m) => m.type !== 'TYPING')),
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
    [connectSocket, setSession]
  )

  const login = useCallback(
    async (username: string, password: string) => {
      clearErrors()
      try {
        const nextSession = await loginUser(username, password)
        setSession(nextSession)
        bootstrappedTokenRef.current = nextSession.token
        await bootstrapAuthenticatedChat(nextSession)
      } catch (error: any) {
        console.error('Login process failed:', error)
        pushError('rest', error instanceof Error ? error.message : 'Unable to log in.')
        throw error
      }
    },
    [bootstrapAuthenticatedChat, clearErrors, pushError, setSession]
  )

  const logout = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current = null
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
      }
    },
    [directMessages, ensureDirectHistory, ensureGroupHistory, session?.token, groupMessages],
  )

  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!currentUser || !session?.token || !activeConversation) return

      const trimmedText = text.trim()
      if (!trimmedText) return

      const finalMessage: ChatMessage = {
        senderId: currentUser.username,
        senderName: currentUser.displayName,
        roomId: activeConversation.type === 'group' ? activeConversation.group.roomId : undefined,
        recipients: activeConversation.type === 'direct' ? [activeConversation.contact.id] : undefined,
        content: trimmedText,
        type: 'TEXT',
        timestamp: new Date().toISOString(),
      }

      sendSocketMessage(finalMessage)
      appendIncomingMessage(finalMessage)
    },
    [activeConversation, appendIncomingMessage, currentUser, sendSocketMessage, session?.token],
  )

  const sendMediaMessage = useCallback(
    async (file: File, caption?: string) => {
      if (!currentUser || !session?.token || !activeConversation) return
      setUploading(true)
      try {
        const uploaded = await uploadMedia(file, session.token)
        setMediaLibrary((current) => ({ ...current, [uploaded.id]: uploaded }))

        const finalMessage: ChatMessage = {
          senderId: currentUser.username,
          senderName: currentUser.displayName,
          roomId: activeConversation.type === 'group' ? activeConversation.group.roomId : undefined,
          recipients: activeConversation.type === 'direct' ? [activeConversation.contact.id] : undefined,
          content: caption ? caption.trim() : undefined,
          mediaId: uploaded.id,
          type: 'MEDIA',
          timestamp: new Date().toISOString(),
        }

        sendSocketMessage(finalMessage)
        appendIncomingMessage(finalMessage)
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

  const clearAppStorage = useCallback(async () => {
    localStorage.clear()
    sessionStorage.clear()
    const dbs = ['fc-msg-plain', 'signal-store', 'key-val-store']
    await Promise.all(dbs.map(dbName => {
      return new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName)
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
        req.onblocked = () => resolve()
      })
    }))
    window.location.reload()
  }, [])

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

  useEffect(() => {
    if (!currentUser || !activeConversation || status !== 'connected' || !socketRef.current?.isConnected()) return

    let needsUpdate = false
    const updatedMessages = activeMessages.map(m => {
      if (m.id && m.senderId !== currentUser.username && m.status !== 'READ') {
        socketRef.current?.publishStatus(m.id, 'READ')
        needsUpdate = true
        return { ...m, status: 'READ' as const }
      }
      return m
    })

    if (needsUpdate) {
      const isGroup = activeConversation.type === 'group'
      const id = isGroup ? activeConversation.group.roomId : activeConversation.contact.id
      const setter = isGroup ? setGroupMessages : setDirectMessages

      setter((current) => {
        const prev = current[id]
        if (!prev) return current
        return {
          ...current,
          [id]: {
            ...prev,
            messages: updatedMessages
          }
        }
      })
    }
  }, [activeMessages, activeConversation, currentUser, status])

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
    clearAppStorage,
  }
}
