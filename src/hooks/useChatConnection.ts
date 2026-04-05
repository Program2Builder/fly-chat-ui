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
  const [session, setSession] = useLocalStorage<AuthSession | null>('flychat-auth-session', null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(session?.user ?? null)
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

  const typing = useTypingIndicator({
    userId: currentUser?.username ?? '',
    userName: currentUser?.displayName ?? '',
    sendTyping: handleSendTyping,
  })

  const appendIncomingMessage = useCallback(
    (message: ChatMessage) => {
      if (!currentUser || message.type === 'TYPING') {
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

      const conversationKey = getDirectConversationKey(message, currentUser.username)
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

  const resetEncryption = useCallback(async () => {
    if (!token) throw new Error('Not logged in')
    setUploading(true)
    try {
      await encryptionService.reset()
      await encryptionService.initialize()
      const bundle = await encryptionService.getEncryptionBundle()
      await uploadEncryptionKeys(bundle, token)
      console.log('E2EE has been manually reset and new keys uploaded.')
    } finally {
      setUploading(false)
    }
  }, [token])

  const handleIncomingMessage = useCallback(
    async (message: ChatMessage) => {
      if (message.type === 'TYPING') {
        typing.registerIncomingTyping(message)
        return
      }
      
      let processedMessage = { ...message }
      if (processedMessage.isEncrypted && currentUser) {
        if (!processedMessage.roomId && processedMessage.senderId === currentUser.username) {
          typing.clearSenderTyping(processedMessage.senderId)
          return
        }

        try {
          const decryptedText = await encryptionService.decryptMessage(
            processedMessage.senderId,
            processedMessage.encryptionMetadata
          )
          processedMessage.content = decryptedText
        } catch (error: any) {
          const isInvalidKey = error?.message?.includes('Invalid private key')
          if (isInvalidKey) {
            console.error('CRITICAL: Local encryption keys are invalid. Attempting silent repair.', error)
            processedMessage.content = '[Security Repair in progress... Please refresh.]'
            
            if (!(window as any)._isRepairingSignal) {
              (window as any)._isRepairingSignal = true;
              resetEncryption()
                .catch(err => console.error('Silent repair failed:', err))
                .finally(() => {
                  setTimeout(() => { (window as any)._isRepairingSignal = false; }, 5000);
                });
            }
          } else {
            processedMessage.content = '[Encrypted Message - Decryption Failed]'
          }
          
          try {
            const address = new SignalProtocolAddress(processedMessage.senderId, 1)
            await (encryptionService.getStore() as any).removeSession(address.toString())
          } catch (e) {
            console.error('Failed to clear broken session:', e)
          }
        }
      } else if (processedMessage.roomId && (processedMessage as any).isGroupEncryption && currentUser) {
        try {
          const decryptedText = await groupEncryptionService.decryptGroupMessage(
            processedMessage.roomId,
            processedMessage.senderId,
            processedMessage,
            currentUser.username
          )
          processedMessage.content = decryptedText
        } catch (error: any) {
          processedMessage.content = '[Encrypted Group Message - Decryption Failed]'
        }
      }

      typing.clearSenderTyping(processedMessage.senderId)
      appendIncomingMessage(processedMessage)
    },
    [appendIncomingMessage, typing, currentUser, resetEncryption],
  )

  const processMessagesWithDecryption = useCallback(
    async (messages: ChatMessage[]) => {
      if (!currentUser) return messages

      const processed = await Promise.all(
        messages.map(async (msg) => {
          let processedMessage = { ...msg }
          if (!processedMessage.isEncrypted) return processedMessage

          if (processedMessage.roomId && (processedMessage as any).isGroupEncryption) {
            try {
              const decryptedText = await groupEncryptionService.decryptGroupMessage(
                processedMessage.roomId,
                processedMessage.senderId,
                processedMessage,
                currentUser.username
              )
              processedMessage.content = decryptedText
            } catch (error) {
              processedMessage.content = '[Encrypted Group Message - Decryption Failed]'
            }
          } else if (!processedMessage.roomId) {
            if (processedMessage.senderId === currentUser.username) {
              processedMessage.content = '[Sent Encrypted Message]'
            } else {
              try {
                const decryptedText = await encryptionService.decryptMessage(
                  processedMessage.senderId,
                  processedMessage.encryptionMetadata
                )
                processedMessage.content = decryptedText
              } catch (error) {
                processedMessage.content = '[Encrypted Message - Decryption Failed]'
              }
            }
          }
          return processedMessage
        })
      )
      return processed
    },
    [currentUser]
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

        try {
          await encryptionService.setAccountContext(authenticatedUser)
          await encryptionService.initialize()
          
          const existingBundle = await fetchUserEncryptionBundle(authenticatedUser.username, authenticatedSession.token)
          if (!existingBundle) {
            const bundle = await encryptionService.getEncryptionBundle()
            await uploadEncryptionKeys(bundle, authenticatedSession.token)
          }
        } catch (e) {
          console.error('E2EE bootstrap failed:', e)
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
    [connectSocket, setSession],
  )

  const login = useCallback(
    async (username: string, password: string) => {
      clearErrors()
      try {
        const nextSession = await loginUser(username, password)
        setSession(nextSession)
        bootstrappedTokenRef.current = nextSession.token
        
        await encryptionService.setAccountContext(nextSession.user, password)
        await bootstrapAuthenticatedChat(nextSession)
      } catch (error: any) {
        console.error('Login process failed:', error)
        const readable = error instanceof Error ? error.message : 'Unable to log in.'
        pushError('rest', readable)
        throw error
      }
    },
    [bootstrapAuthenticatedChat, clearErrors, pushError, setSession],
  )

  const logout = useCallback(() => {
    socketRef.current?.disconnect()
    typing.clearAll()
    setSession(null)
    bootstrappedTokenRef.current = null
    setCurrentUser(null)
    setContacts([])
    setGroups([])
    setActiveConversation(null)
    setGroupMessages({})
    setDirectMessages({})
    setMediaLibrary({})
    setErrors([])
    setStatus('disconnected')
  }, [setSession, typing])

  const selectConversation = useCallback(
    async (conversation: ActiveConversation) => {
      setActiveConversation(conversation)

      if (conversation.type === 'group' && token) {
        const existingState = groupMessages[conversation.group.roomId]
        if (!existingState || !existingState.hasLoadedInitial) {
          await ensureGroupHistory(conversation.group.roomId, token)
        }
      } else if (conversation.type === 'direct' && token) {
        const existingState = directMessages[conversation.contact.id]
        if (!existingState || !existingState.hasLoadedInitial) {
          await ensureDirectHistory(conversation.contact.id, token)
        }
      }
    },
    [directMessages, ensureDirectHistory, ensureGroupHistory, token],
  )

  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!currentUser) throw new Error('You must be logged in to send a message.')

      const trimmedText = text.trim()
      if (!trimmedText) throw new Error('Type a message before sending.')
      if (!activeConversation) throw new Error('Select a conversation first.')

      let finalMessage: ChatMessage = {
        senderId: currentUser.username,
        senderName: currentUser.displayName,
        roomId: activeConversation.type === 'group' ? activeConversation.group.roomId : undefined,
        recipients: activeConversation.type === 'direct' ? [activeConversation.contact.id] : undefined,
        content: trimmedText,
        type: 'TEXT',
        timestamp: new Date().toISOString(),
      }

      if (activeConversation.type === 'direct' && token) {
        try {
          let bundle = await fetchUserEncryptionBundle(activeConversation.contact.id, token)
          const encryptedData = await encryptionService.encryptMessage(activeConversation.contact.id, trimmedText, bundle)
          finalMessage.isEncrypted = true
          finalMessage.content = encryptedData.body
          finalMessage.encryptionMetadata = encryptedData
        } catch (e) {
          console.error('Encryption failed:', e)
        }
      } else if (activeConversation.type === 'group' && token) {
        try {
          const members = activeConversation.group.members || []
          const encryptedGroupData = await groupEncryptionService.encryptGroupMessage(activeConversation.group.roomId, members, trimmedText);
          finalMessage = { ...finalMessage, ...encryptedGroupData }
        } catch (e) {
          console.error('Group encryption failed:', e)
        }
      }

      sendSocketMessage(finalMessage)
      appendIncomingMessage({ ...finalMessage, content: trimmedText, isEncrypted: false })
    },
    [activeConversation, appendIncomingMessage, currentUser, sendSocketMessage, token],
  )

  const sendMediaMessage = useCallback(
    async (file: File) => {
      if (!currentUser || !token) throw new Error('Not logged in.')
      if (!activeConversation) throw new Error('Select a conversation first.')

      setUploading(true)
      try {
        let fileToUpload: File | Blob = file
        let encryptionKeys: { key: string; iv: string } | undefined = undefined

        if (activeConversation.type === 'direct') {
          try {
            const encryptedData = await encryptionService.encryptFile(file)
            fileToUpload = encryptedData.encryptedBlob
            encryptionKeys = { key: encryptedData.key, iv: encryptedData.iv }
          } catch (e) {
            console.error('File encryption failed:', e)
          }
        }

        const uploaded = await uploadMedia(fileToUpload as File, token)
        setMediaLibrary((current) => ({ ...current, [uploaded.id]: uploaded }))

        let finalMessage: ChatMessage = {
          senderId: currentUser.username,
          senderName: currentUser.displayName,
          roomId: activeConversation.type === 'group' ? activeConversation.group.roomId : undefined,
          recipients: activeConversation.type === 'direct' ? [activeConversation.contact.id] : undefined,
          mediaId: uploaded.id,
          type: 'MEDIA',
          timestamp: new Date().toISOString(),
        }

        if (activeConversation.type === 'direct' && encryptionKeys) {
          try {
            let bundle = await fetchUserEncryptionBundle(activeConversation.contact.id, token)
            const metadataStr = JSON.stringify(encryptionKeys)
            const encryptedMetadata = await encryptionService.encryptMessage(activeConversation.contact.id, metadataStr, bundle)
            finalMessage.isEncrypted = true
            finalMessage.content = encryptedMetadata.body
            finalMessage.encryptionMetadata = encryptedMetadata
          } catch (e) {
            console.error('Signal encryption of media keys failed:', e)
          }
        }

        sendSocketMessage(finalMessage)
        appendIncomingMessage({ ...finalMessage, isEncrypted: false })
      } catch (error) {
        pushError('rest', 'Unable to upload file.')
        throw error
      } finally {
        setUploading(false)
      }
    },
    [activeConversation, appendIncomingMessage, currentUser, pushError, sendSocketMessage, token],
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
    if (!token) throw new Error('Not logged in')
    await apiAddContact(username, token)
    const updatedContacts = await fetchContacts(token)
    setContacts(normalizeContacts(updatedContacts))
  }, [token])

  const removeContact = useCallback(async (username: string) => {
    if (!token) throw new Error('Not logged in')
    await apiRemoveContact(username, token)
    setContacts((current) => current.filter((c) => c.id !== username))
    if (activeConversation?.type === 'direct' && activeConversation.contact.id === username) setActiveConversation(null)
  }, [activeConversation, token])

  const deleteGroupAction = useCallback(async (groupId: number) => {
    if (!token) throw new Error('Not logged in')
    await apiDeleteGroup(groupId, token)
    setGroups((current) => current.filter((g) => g.id !== groupId))
    if (activeConversation?.type === 'group' && activeConversation.group.id === groupId) setActiveConversation(null)
  }, [activeConversation, token])

  const updateProfilePicture = useCallback(async (file: File) => {
    if (!token) throw new Error('Not logged in')
    setUploading(true)
    try {
      await apiUploadProfilePicture(file, token)
      const updatedUser = await fetchAuthenticatedUser(token)
      setCurrentUser(updatedUser)
    } finally {
      setUploading(false)
    }
  }, [token])

  const createGroup = useCallback(async (name: string, description: string, members: string[]) => {
    if (!token) throw new Error('Not logged in')
    const newGroup = await apiCreateGroup({ name, description, members }, token)
    const updatedGroups = await fetchGroups(token)
    setGroups(updatedGroups)
    return newGroup
  }, [token])

  const updateProfile = useCallback(async (displayName: string, about: string) => {
    if (!token) throw new Error('Not logged in')
    setUploading(true)
    try {
      const updated = await apiUpdateProfile({ displayName, about }, token)
      setCurrentUser(updated)
      setSession((current) => current ? { ...current, user: updated } : null)
    } finally {
      setUploading(false)
    }
  }, [token, setSession])

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
    token,
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
    resetEncryption,
    updateProfilePicture,
    createGroup,
    loadMoreHistory,
    hasNextPage,
    isLoadingMore: loadingHistory,
  }
}
