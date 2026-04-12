export type MessageType = 'TEXT' | 'MEDIA' | 'TYPING'

export interface AuthUser {
  id: number
  username: string
  email: string
  displayName: string
  roles: string[]
  profilePictureUrl: string | null
  about?: string
}

export interface ChatContact {
  id: string
  displayName: string
  profilePictureUrl?: string | null
  lastInteractionAt?: string
}

export interface ChatGroup {
  id: number
  roomId: string
  name: string
  description?: string
  autoJoin: boolean
  members?: string[]
}

export interface AuthSession {
  token: string
  tokenType: string
  expiresAt?: string
  user: AuthUser
}

export type LoginResponse = AuthSession

export interface SessionProfile {
  userId: string
  displayName: string
  roomId: string
}

export interface BootstrapResponse {
  currentUser: AuthUser
  contacts: ChatContact[]
  groups: ChatGroup[]
  directMessages: Record<string, ChatMessage[]>
  groupMessages: Record<string, ChatMessage[]>
}

export interface Slice<T> {
  content: T[]
  last: boolean
  first: boolean
  totalPages: number
  totalElements: number
  size: number
  number: number
  numberOfElements: number
  empty: boolean
  hasNext?: boolean
}

export interface ChatMessage {
  id?: string
  senderId: string
  senderName?: string
  recipients?: string[]
  roomId?: string
  content?: string
  type: MessageType
  mediaId?: string
  timestamp?: string
  status?: 'SENT' | 'DELIVERED' | 'READ'
}

export interface MediaUploadResponse {
  id: string
  storedFilename: string
  downloadUrl: string
  contentType: string
  size: number
}

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

export interface ChatError {
  source: 'auth' | 'rest' | 'websocket' | 'validation' | 'info'
  message: string
}

export type ActiveConversation =
  | {
    type: 'group'
    group: ChatGroup
  }
  | {
    type: 'direct'
    contact: ChatContact
  }
