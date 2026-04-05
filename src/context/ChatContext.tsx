import { createContext, useContext, type ReactNode } from 'react'
import { useChatConnection } from '../hooks/useChatConnection'

type ChatContextValue = ReturnType<typeof useChatConnection>

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const value = useChatConnection()
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within ChatProvider')
  }
  return context
}
