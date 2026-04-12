import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { ChatMessage } from '../types/chat'

import { WS_BASE_URL } from '../config'

interface ChatSocketOptions {
  userId: string
  onConnect: () => void
  onDisconnect: () => void
  onError: (message: string) => void
  onMessage: (message: ChatMessage) => void
}

export class ChatSocket {
  private client: Client | null = null
  private roomSubscriptions = new Map<string, StompSubscription>()
  private directSubscription: StompSubscription | null = null
  private globalSubscription: StompSubscription | null = null

  connect(options: ChatSocketOptions) {
    const { userId, onConnect, onDisconnect, onError, onMessage } = options

    this.disconnect()

    this.client = new Client({
      webSocketFactory: () =>
        new SockJS(
          `${WS_BASE_URL}/ws?username=${encodeURIComponent(userId)}`,
        ) as WebSocket,
      connectHeaders: {
        'X-User-Id': userId,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        onConnect()
        this.subscribeToGlobalMessages(onMessage)
        this.subscribeToDirectMessages(onMessage)
      },
      onWebSocketClose: () => {
        onDisconnect()
      },
      onWebSocketError: () => {
        onError('WebSocket transport error. Check that the backend is running.')
      },
      onStompError: (frame) => {
        const message = frame.headers.message || frame.body || 'STOMP broker error.'
        onError(message)
      },
    })

    this.client.activate()
  }

  disconnect() {
    this.roomSubscriptions.forEach((subscription) => subscription.unsubscribe())
    this.roomSubscriptions.clear()
    this.directSubscription?.unsubscribe()
    this.directSubscription = null
    this.globalSubscription?.unsubscribe()
    this.globalSubscription = null
    this.client?.deactivate()
    this.client = null
  }

  subscribeToRooms(roomIds: string[], onMessage: (message: ChatMessage) => void) {
    if (!this.client?.connected) {
      return
    }

    const nextIds = new Set(roomIds)

    this.roomSubscriptions.forEach((subscription, roomId) => {
      if (!nextIds.has(roomId)) {
        subscription.unsubscribe()
        this.roomSubscriptions.delete(roomId)
      }
    })

    roomIds.forEach((roomId) => {
      if (this.roomSubscriptions.has(roomId)) {
        return
      }

      const subscription = this.client?.subscribe(
        `/topic/room.${roomId}`,
        (frame) => this.handleFrame(frame, onMessage),
      )

      if (subscription) {
        this.roomSubscriptions.set(roomId, subscription)
      }
    })
  }

  publish(message: ChatMessage) {
    if (!this.client?.connected) {
      throw new Error('Not connected')
    }

    this.client.publish({
      destination: '/app/chat.send',
      body: JSON.stringify(message),
    })
  }

  publishStatus(messageId: string, status: 'SENT' | 'DELIVERED' | 'READ') {
    if (!this.client?.connected) {
      throw new Error('Not connected')
    }

    this.client.publish({
      destination: '/app/chat.status',
      body: JSON.stringify({ messageId, status }),
    })
  }

  isConnected() {
    return this.client?.connected ?? false
  }

  private subscribeToDirectMessages(onMessage: (message: ChatMessage) => void) {
    if (!this.client?.connected) {
      return
    }

    this.directSubscription?.unsubscribe()
    this.directSubscription = this.client.subscribe(
      '/user/queue/messages',
      (frame) => this.handleFrame(frame, onMessage),
    )
  }

  private subscribeToGlobalMessages(onMessage: (message: ChatMessage) => void) {
    if (!this.client?.connected) {
      return
    }

    this.globalSubscription?.unsubscribe()
    this.globalSubscription = this.client.subscribe(
      '/topic/public',
      (frame) => this.handleFrame(frame, onMessage),
    )
  }

  private handleFrame(
    frame: IMessage,
    onMessage: (message: ChatMessage) => void,
  ) {
    try {
      const body = JSON.parse(frame.body) as ChatMessage
      onMessage(body)
    } catch {
      onMessage({
        senderId: 'system',
        senderName: 'System',
        content: frame.body,
        type: 'TEXT',
        timestamp: new Date().toISOString(),
      })
    }
  }
}
