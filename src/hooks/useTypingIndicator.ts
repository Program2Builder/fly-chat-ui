import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage } from '../types/chat'

const TYPING_VISIBLE_MS = 3000
const TYPING_DEBOUNCE_MS = 900

type TypingScope = 'room' | 'direct'

interface NotifyTypingInput {
  scope: TypingScope
  roomId?: string
  recipients?: string[]
}

interface UseTypingIndicatorOptions {
  userId: string
  userName: string
  sendTyping: (message: ChatMessage) => void
}

interface TypingEntry {
  names: Map<string, string>
  timeoutIds: Map<string, number>
}

function getScopeKey(scope: TypingScope, roomId?: string, recipients?: string[]) {
  if (scope === 'room') {
    return `room:${roomId ?? ''}`
  }

  const sortedRecipients = [...(recipients ?? [])].sort().join(',')
  return `direct:${sortedRecipients}`
}

export function useTypingIndicator({
  userId,
  userName,
  sendTyping,
}: UseTypingIndicatorOptions) {
  const entriesRef = useRef<Map<string, TypingEntry>>(new Map())
  const debounceRef = useRef<Map<string, number>>(new Map())
  const [, forceRender] = useState(0)

  const registerIncomingTyping = useCallback(
    (message: ChatMessage) => {
      if (message.type !== 'TYPING') {
        return
      }

      console.log('<<< [TYPING] Incoming Event Received:', message)

      if (message.senderId === userId) {
        return
      }

      const scope: TypingScope = message.roomId ? 'room' : 'direct'
      const conversationRecipients = scope === 'direct' ? [message.senderId] : message.recipients
      const key = getScopeKey(scope, message.roomId, conversationRecipients)
      const entry =
        entriesRef.current.get(key) ?? {
          names: new Map<string, string>(),
          timeoutIds: new Map<string, number>(),
        }

      const visibleName = message.senderName || message.senderId
      entry.names.set(message.senderId, visibleName)

      const previousTimeout = entry.timeoutIds.get(message.senderId)
      if (previousTimeout) {
        window.clearTimeout(previousTimeout)
      }

      const timeoutId = window.setTimeout(() => {
        const liveEntry = entriesRef.current.get(key)
        if (!liveEntry) {
          return
        }

        liveEntry.names.delete(message.senderId)
        liveEntry.timeoutIds.delete(message.senderId)
        if (liveEntry.names.size === 0) {
          entriesRef.current.delete(key)
        }
        forceRender((value) => value + 1)
      }, TYPING_VISIBLE_MS)

      entry.timeoutIds.set(message.senderId, timeoutId)
      entriesRef.current.set(key, entry)
      forceRender((value) => value + 1)
    },
    [userId],
  )

  const notifyTyping = useCallback(
    ({ scope, roomId, recipients }: NotifyTypingInput) => {
      const key = getScopeKey(scope, roomId, recipients)
      const existingTimer = debounceRef.current.get(key)
      if (existingTimer) {
        return
      }

      const payload = {
        senderId: userId,
        senderName: userName,
        type: 'TYPING' as const,
        roomId: scope === 'room' ? roomId : undefined,
        recipients: scope === 'direct' ? recipients : undefined,
      }

      console.log('>>> [TYPING] Sending Event:', payload)

      sendTyping(payload)

      const timeoutId = window.setTimeout(() => {
        debounceRef.current.delete(key)
      }, TYPING_DEBOUNCE_MS)

      debounceRef.current.set(key, timeoutId)
    },
    [sendTyping, userId, userName],
  )

  const getTypingNames = useCallback(
    (scope: TypingScope, roomId?: string, recipients?: string[]) => {
      const key = getScopeKey(scope, roomId, recipients)
      return Array.from(entriesRef.current.get(key)?.names.values() ?? [])
    },
    [],
  )

  const getTypingNamesForScope = useCallback((scope: TypingScope) => {
    const prefix = `${scope}:`
    const names = new Set<string>()

    entriesRef.current.forEach((entry, key) => {
      if (!key.startsWith(prefix)) {
        return
      }

      entry.names.forEach((name) => names.add(name))
    })

    return Array.from(names)
  }, [])

  const clearAll = useCallback(() => {
    entriesRef.current.forEach((entry) => {
      entry.timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
    })
    debounceRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    entriesRef.current.clear()
    debounceRef.current.clear()
    forceRender((value) => value + 1)
  }, [])

  const clearSenderTyping = useCallback((senderId: string) => {
    entriesRef.current.forEach((entry, key) => {
      if (entry.names.has(senderId)) {
        const timeoutId = entry.timeoutIds.get(senderId)
        if (timeoutId) {
          window.clearTimeout(timeoutId)
        }
        entry.names.delete(senderId)
        entry.timeoutIds.delete(senderId)
        if (entry.names.size === 0) {
          entriesRef.current.delete(key)
        }
      }
    })
    forceRender((value) => value + 1)
  }, [])

  useEffect(() => clearAll, [clearAll])

  return useMemo(
    () => ({
      registerIncomingTyping,
      notifyTyping,
      getTypingNames,
      getTypingNamesForScope,
      clearAll,
      clearSenderTyping,
    }),
    [clearAll, clearSenderTyping, getTypingNames, getTypingNamesForScope, notifyTyping, registerIncomingTyping],
  )
}
