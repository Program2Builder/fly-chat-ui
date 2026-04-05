import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { alpha, keyframes } from '@mui/material/styles'
import { Box, Paper, Stack, Typography, CircularProgress } from '@mui/material'
import type { ChatMessage, MediaUploadResponse } from '../types/chat'
import { formatLocalTimestamp } from '../utils/dates'
import { MediaMessage } from './MediaMessage'
import { TypingIndicator } from './TypingIndicator'

const slideFadeIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`

interface MessageListProps {
  title: string
  subtitle: string
  messages: ChatMessage[]
  currentUserId: string
  mediaLibrary: Record<string, MediaUploadResponse>
  emptyState: string
  activeTypingNames?: string[]
  showHeader?: boolean
  onLoadMore?: () => void
  isLoadingMore?: boolean
  hasNextPage?: boolean
}

export function MessageList({
  title,
  subtitle,
  messages,
  currentUserId,
  mediaLibrary,
  emptyState,
  activeTypingNames = [],
  showHeader = true,
  onLoadMore,
  isLoadingMore,
  hasNextPage,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const lastScrollHeightRef = useRef<number>(0)
  const isPrependingRef = useRef(false)

  // Track if we are prepending messages for scroll preservation
  const firstMessageId = messages[0]?.id || messages[0]?.timestamp
  const prevFirstMessageId = useRef(firstMessageId)

  useLayoutEffect(() => {
    if (firstMessageId !== prevFirstMessageId.current && !stickToBottomRef.current) {
      isPrependingRef.current = true
    }
    prevFirstMessageId.current = firstMessageId
  }, [firstMessageId])

  const renderedMessages = useMemo(() => messages, [messages])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    if (stickToBottomRef.current) {
      element.scrollTop = element.scrollHeight
    } else if (isPrependingRef.current) {
      // Preserve scroll position when prepending
      const newScrollHeight = element.scrollHeight
      const heightDiff = newScrollHeight - lastScrollHeightRef.current
      element.scrollTop += heightDiff
      isPrependingRef.current = false
    }
    
    lastScrollHeightRef.current = element.scrollHeight
  }, [renderedMessages, activeTypingNames])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {showHeader ? (
        <>
          <Box sx={{ px: 1.5, pt: 1.5, pb: 0.75 }}>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>

          <Box sx={{ px: 1.5, pb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {messages.length === 0 ? 'No messages yet' : `${messages.length} messages`}
            </Typography>
          </Box>
        </>
      ) : null}

      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 1, sm: 1.5 },
          py: showHeader ? 0 : 1.5,
          pb: 1.5,
          backgroundColor: '#0f111a',
          backgroundImage:
            'radial-gradient(circle at top left, rgba(79, 70, 229, 0.12), transparent 35%), radial-gradient(circle at bottom right, rgba(124, 58, 237, 0.1), transparent 40%)',
          '&::-webkit-scrollbar': {
            width: '6px',
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '10px',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
            },
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
            margin: '4px',
          },
        }}
        onScroll={(event) => {
          const element = event.currentTarget
          const remaining =
            element.scrollHeight - element.scrollTop - element.clientHeight
          stickToBottomRef.current = remaining < 48

          // Detect scroll to top with a small threshold for better reliability
          if (element.scrollTop <= 5 && hasNextPage && !isLoadingMore && onLoadMore) {
            onLoadMore()
          }

          lastScrollHeightRef.current = element.scrollHeight
        }}
      >
        <Stack spacing={1}>
          {isLoadingMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} thickness={5} />
            </Box>
          )}
          {renderedMessages.length === 0 && !isLoadingMore ? (
            <Paper
              elevation={0}
              sx={{
                p: 3,
                textAlign: 'center',
                bgcolor: alpha('#ffffff', 0.04),
                border: `1px dashed ${alpha('#ffffff', 0.12)}`,
              }}
            >
              <Typography color="text.secondary">{emptyState}</Typography>
            </Paper>
          ) : (
            renderedMessages.map((message) => {
              const isOwn = message.senderId === currentUserId
              const key =
                message.id ??
                `${message.senderId}-${message.timestamp}-${message.content}-${message.mediaId}`

              return (
                <Paper
                  elevation={0}
                  key={key}
                  sx={{
                    alignSelf: isOwn ? 'flex-end' : 'flex-start',
                    maxWidth: { xs: '92%', sm: '75%', md: '65%' },
                    px: { xs: 2.25, sm: 2.75 },
                    py: { xs: 1.5, sm: 1.75 },
                    borderRadius: '24px',
                    borderBottomRightRadius: isOwn ? '6px' : '24px',
                    borderBottomLeftRadius: isOwn ? '24px' : '6px',
                    background: isOwn 
                      ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' 
                      : 'rgba(255, 255, 255, 0.04)',
                    backdropFilter: isOwn ? 'none' : 'blur(16px)',
                    border: isOwn ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: isOwn ? '#ffffff' : '#f9fafb',
                    boxShadow: isOwn
                      ? '0 8px 24px -6px rgba(124, 58, 237, 0.5)'
                      : '0 4px 16px -2px rgba(0, 0, 0, 0.4)',
                    animation: `${slideFadeIn} 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards`,
                    transformOrigin: isOwn ? 'bottom right' : 'bottom left',
                    willChange: 'transform, opacity',
                  }}
                >
                  {message.type === 'MEDIA' && message.mediaId ? (
                    <Box sx={{ mb: 1 }}>
                      {(() => {
                        let encryptionKeys = undefined
                        if (message.isEncrypted && message.content) {
                          try {
                            encryptionKeys = JSON.parse(message.content)
                          } catch (e) {
                            console.error('Failed to parse media encryption keys:', e)
                          }
                        }
                        return (
                          <MediaMessage
                            mediaId={message.mediaId}
                            uploadedMedia={mediaLibrary[message.mediaId]}
                            encryptionKeys={encryptionKeys}
                          />
                        )
                      })()}
                    </Box>
                  ) : (
                    <Typography
                      variant="body1"
                      sx={{ 
                        whiteSpace: 'pre-wrap', 
                        wordBreak: 'break-word',
                        fontSize: '0.95rem',
                        lineHeight: 1.5,
                        letterSpacing: '0.01em'
                      }}
                    >
                      {message.content}
                    </Typography>
                  )}
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      opacity: isOwn ? 0.75 : 0.5, 
                      display: 'block',
                      textAlign: 'right',
                      mt: 0.75,
                      lineHeight: 1,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      letterSpacing: '0.03em'
                    }}
                  >
                    {formatLocalTimestamp(message.timestamp)}
                  </Typography>
                </Paper>
              )
            })
          )}
          {activeTypingNames.length > 0 && (
            <TypingIndicator names={activeTypingNames} />
          )}
        </Stack>
      </Box>
    </Box>
  )
}
