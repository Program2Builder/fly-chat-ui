import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { alpha, keyframes } from '@mui/material/styles'
import { Box, Paper, Typography, CircularProgress, IconButton } from '@mui/material'
import type { ChatMessage, MediaUploadResponse, ChatContact } from '../types/chat'
import { AuthenticatedAvatar } from './AuthenticatedAvatar'
import { formatMessageTime, formatDateSeparator } from '../utils/dates'
import { MediaMessage } from './MediaMessage'
import { TypingIndicator } from './TypingIndicator'
import DoneRoundedIcon from '@mui/icons-material/DoneRounded'
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import { MessageContextMenu } from './MessageContextMenu'

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

const emojiBounce = keyframes`
  0%   { transform: scale(0) rotate(-10deg); opacity: 0; }
  60%  { transform: scale(1.3) rotate(6deg);  opacity: 1; }
  80%  { transform: scale(0.88) rotate(-3deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
`

// Split text into proper Unicode grapheme clusters (handles flags, ZWJ families, skin tones, etc.)
function getGraphemes(text: string): string[] {
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text.trim()), (s) => s.segment)
  } catch {
    // Fallback for very old browsers
    return [...text.trim()]
  }
}

function isEmojiGrapheme(segment: string): boolean {
  // Flag emojis: exactly two Regional Indicator codepoints (U+1F1E0..U+1F1FF)
  const codePoints = [...segment].map((c) => c.codePointAt(0) ?? 0)
  if (
    codePoints.length === 2 &&
    codePoints[0] >= 0x1f1e0 && codePoints[0] <= 0x1f1ff &&
    codePoints[1] >= 0x1f1e0 && codePoints[1] <= 0x1f1ff
  ) return true
  // Standard emoji: starts with Emoji_Presentation or has a variation selector \uFE0F
  return /^\p{Emoji_Presentation}/u.test(segment) || /\uFE0F/.test(segment)
}

// Explicit check for a single country flag (two Regional Indicator Letters)
function isFlagEmoji(text: string): boolean {
  const cp = [...text.trim()].map((c) => c.codePointAt(0) ?? 0)
  return cp.length === 2 && cp[0] >= 0x1f1e0 && cp[0] <= 0x1f1ff && cp[1] >= 0x1f1e0 && cp[1] <= 0x1f1ff
}

function isSingleEmoji(text: string): boolean {
  if (isFlagEmoji(text)) return true
  const graphemes = getGraphemes(text)
  return graphemes.length === 1 && isEmojiGrapheme(graphemes[0])
}

function isOnlyEmojis(text: string): boolean {
  const graphemes = getGraphemes(text)
  return graphemes.length > 1 && graphemes.every(isEmojiGrapheme)
}

const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif'

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
  isGroup?: boolean
  contacts?: ChatContact[]
}

function stringToColor(s: string) {
  const palette = ['#00a884', '#005c4b', '#0078d4', '#6b2fa0', '#c2410c', '#0f766e', '#1d4ed8']
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
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
  isGroup = false,
  contacts = [],
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const lastScrollHeightRef = useRef<number>(0)
  const isPrependingRef = useRef(false)

  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [menuState, setMenuState] = useState<{
    anchorEl: HTMLElement
    message: ChatMessage
    isOwn: boolean
  } | null>(null)

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
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
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
                border: `1px dashed ${alpha('#ffffff', 0.03)}`,
              }}
            >
              <Typography color="text.secondary">{emptyState}</Typography>
            </Paper>
          ) : (
            renderedMessages.map((message, index) => {
              const isOwn = message.senderId === currentUserId

              const prevMessage = index > 0 ? renderedMessages[index - 1] : null
              const nextMessage = index < renderedMessages.length - 1 ? renderedMessages[index + 1] : null

              const timeDiff = prevMessage?.timestamp && message.timestamp
                ? new Date(message.timestamp).getTime() - new Date(prevMessage.timestamp).getTime()
                : 0
              const nextTimeDiff = nextMessage?.timestamp && message.timestamp
                ? new Date(nextMessage.timestamp).getTime() - new Date(message.timestamp).getTime()
                : 0

              const isFirstInBlock = !prevMessage || prevMessage.senderId !== message.senderId || timeDiff > 300000
              const isLastInBlock = !nextMessage || nextMessage.senderId !== message.senderId || nextTimeDiff > 300000

              const key =
                message.id ??
                `${message.senderId}-${message.timestamp}-${message.content}-${message.mediaId}`

              const showSenderInfo = isGroup && !isOwn && isFirstInBlock
              const senderContact = contacts.find(c => c.id === message.senderId)
              const senderDisplayName = senderContact?.displayName || message.senderName || message.senderId
              const senderColor = stringToColor(message.senderId)

              const messageDateStr = message.timestamp ? new Date(message.timestamp).toDateString() : ''
              const prevDateStr = prevMessage?.timestamp ? new Date(prevMessage.timestamp).toDateString() : ''
              const showDateSeparator = messageDateStr !== prevDateStr && messageDateStr !== ''

              return (
                <React.Fragment key={key}>
                  {showDateSeparator && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 1.5 }}>
                      <Box sx={{
                        bgcolor: 'rgba(255,255,255,0.06)',
                        color: '#8696a0',
                        px: 1.5, py: 0.5,
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        boxShadow: '0 1px 1px rgba(0,0,0,0.2)'
                      }}>
                        {formatDateSeparator(message.timestamp)}
                      </Box>
                    </Box>
                  )}
                  <Box
                    onMouseEnter={() => setHoveredKey(key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    sx={{
                      alignSelf: isOwn ? 'flex-end' : 'flex-start',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.25,
                      maxWidth: { xs: '92%', sm: '80%', md: '75%' },
                      mt: isFirstInBlock && index !== 0 ? 1.5 : 0.25,
                      position: 'relative',
                    }}
                  >
                    {isGroup && !isOwn && (
                      <Box sx={{ width: 30, flexShrink: 0, mt: 0.5 }}>
                        {showSenderInfo && (
                          <AuthenticatedAvatar
                            relativeUrl={senderContact?.profilePictureUrl}
                            sx={{ width: 30, height: 30, bgcolor: 'transparent', fontSize: '0.85rem', fontWeight: 700 }}
                          >
                            {senderDisplayName[0].toUpperCase()}
                          </AuthenticatedAvatar>
                        )}
                      </Box>
                    )}

                    {/* Wrapper for Paper + Pinned Arrow */}
                    <Box sx={{ position: 'relative' }}>
                      {(() => {
                        const content = message.content || ''
                        const _isSingleEmoji = isSingleEmoji(content)
                        const emojiOnly = !_isSingleEmoji && isOnlyEmojis(content)

                        return (
                          <>
                            <Paper
                              elevation={0}
                              sx={{
                                px: _isSingleEmoji ? 0 : 1.5,
                                pt: _isSingleEmoji ? 0 : 0.75,
                                pb: _isSingleEmoji ? 0 : 0.5,
                                borderRadius: '8px',
                                borderTopLeftRadius: !isOwn ? (isFirstInBlock ? 0 : '8px') : '8px',
                                borderBottomLeftRadius: '8px',
                                borderTopRightRadius: isOwn ? (isFirstInBlock ? 0 : '8px') : '8px',
                                borderBottomRightRadius: '8px',
                                background: _isSingleEmoji ? 'transparent'
                                  : isOwn
                                  ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)'
                                  : 'rgba(255, 255, 255, 0.04)',
                                backdropFilter: _isSingleEmoji ? 'none' : isOwn ? 'none' : 'blur(16px)',
                                border: _isSingleEmoji ? 'none'
                                  : isOwn ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.08)',
                                color: isOwn ? '#ffffff' : '#f9fafb',
                                boxShadow: _isSingleEmoji ? 'none'
                                  : isOwn
                                  ? '0 8px 24px -6px rgba(124, 58, 237, 0.5)'
                                  : '0 4px 16px -2px rgba(0, 0, 0, 0.4)',
                                animation: `${slideFadeIn} 0.25s ease-out forwards`,
                                transformOrigin: isOwn ? 'top right' : 'top left',
                                willChange: 'transform, opacity',
                                minWidth: 0,
                              }}
                            >
                              {showSenderInfo && (
                                <Typography variant="caption" sx={{ fontWeight: 600, color: senderColor, mb: 0.5, display: 'block', lineHeight: 1.2, fontSize: '0.8125rem' }}>
                                  {senderDisplayName}
                                </Typography>
                              )}

                              {message.type === 'MEDIA' && message.mediaId ? (
                                <Box sx={{ mb: 0 }}>
                                  <MediaMessage
                                    mediaId={message.mediaId}
                                    uploadedMedia={mediaLibrary[message.mediaId]}
                                  />
                                  {content && (
                                    <Typography
                                      variant="body1"
                                      component="div"
                                      sx={{
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        fontSize: '0.875rem',
                                        lineHeight: 1.4,
                                        letterSpacing: '0.01em',
                                        mt: 0.75,
                                        px: 0.5,
                                        fontFamily: EMOJI_FONT,
                                      }}
                                    >
                                      <Box component="span" sx={{ display: 'inline' }}>
                                        {content}
                                      </Box>
                                      <Box component="span" sx={{ float: 'right', mt: '10px', ml: '20px', fontSize: '0.6875rem', opacity: isOwn ? 0.75 : 0.5, fontWeight: 600, position: 'relative', top: '1px', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        {formatMessageTime(message.timestamp)}
                                        {isOwn && message.id && (!message.status || message.status === 'SENT') && <DoneRoundedIcon sx={{ fontSize: '0.9rem' }} />}
                                        {isOwn && message.status === 'DELIVERED' && <DoneAllRoundedIcon sx={{ fontSize: '0.9rem' }} />}
                                        {isOwn && message.status === 'READ' && <DoneAllRoundedIcon sx={{ fontSize: '0.9rem', color: '#53bdeb', opacity: 1 }} />}
                                      </Box>
                                      <Box sx={{ clear: 'both' }} />
                                    </Typography>
                                  )}
                                  {!content && (
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.5, opacity: isOwn ? 0.75 : 0.5 }}>
                                      <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
                                        {formatMessageTime(message.timestamp)}
                                      </Typography>
                                      {isOwn && message.id && (!message.status || message.status === 'SENT') && <DoneRoundedIcon sx={{ fontSize: '0.8rem' }} />}
                                      {isOwn && message.status === 'DELIVERED' && <DoneAllRoundedIcon sx={{ fontSize: '0.8rem' }} />}
                                      {isOwn && message.status === 'READ' && <DoneAllRoundedIcon sx={{ fontSize: '0.8rem', color: '#53bdeb', opacity: 1 }} />}
                                    </Box>
                                  )}
                                </Box>
                              ) : _isSingleEmoji ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                                  <Box
                                    sx={{
                                      fontSize: '3.5rem',
                                      lineHeight: 1,
                                      fontFamily: EMOJI_FONT,
                                      animation: `${emojiBounce} 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards`,
                                      display: 'inline-block',
                                      userSelect: 'none',
                                      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))',
                                    }}
                                  >
                                    {content}
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.25, opacity: 0.55, fontSize: '0.65rem', fontWeight: 600, color: '#e9edef' }}>
                                    {formatMessageTime(message.timestamp)}
                                    {isOwn && message.id && (!message.status || message.status === 'SENT') && <DoneRoundedIcon sx={{ fontSize: '0.8rem' }} />}
                                    {isOwn && message.status === 'DELIVERED' && <DoneAllRoundedIcon sx={{ fontSize: '0.8rem' }} />}
                                    {isOwn && message.status === 'READ' && <DoneAllRoundedIcon sx={{ fontSize: '0.8rem', color: '#53bdeb', opacity: 1 }} />}
                                  </Box>
                                </Box>
                              ) : (
                                <Typography
                                  variant="body1"
                                  component="div"
                                  sx={{
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    fontFamily: EMOJI_FONT,
                                    fontSize: emojiOnly ? '1.375rem' : '0.875rem',
                                    lineHeight: emojiOnly ? 1.5 : 1.4,
                                    letterSpacing: '0.01em',
                                    pb: 0.25,
                                  }}
                                >
                                  <Box component="span" sx={{ display: 'inline' }}>
                                    {content}
                                  </Box>
                                  <Box component="span" sx={{ float: 'right', mt: '10px', ml: '20px', fontSize: '0.6875rem', opacity: isOwn ? 0.75 : 0.5, fontWeight: 600, position: 'relative', top: '1px', display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                    {formatMessageTime(message.timestamp)}
                                    {isOwn && message.id && (!message.status || message.status === 'SENT') && <DoneRoundedIcon sx={{ fontSize: '0.9rem' }} />}
                                    {isOwn && message.status === 'DELIVERED' && <DoneAllRoundedIcon sx={{ fontSize: '0.9rem' }} />}
                                    {isOwn && message.status === 'READ' && <DoneAllRoundedIcon sx={{ fontSize: '0.9rem', color: '#53bdeb', opacity: 1 }} />}
                                  </Box>
                                  <Box sx={{ clear: 'both' }} />
                                </Typography>
                              )}
                            </Paper>

                            {/* Arrow button — temporarily hidden
                            {hoveredKey === key && (
                              <IconButton
                                size="small"
                                onClick={(e) =>
                                  setMenuState({ anchorEl: e.currentTarget, message, isOwn })
                                }
                                sx={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  width: 20,
                                  height: 20,
                                  bgcolor: 'rgba(0,0,0,0.45)',
                                  backdropFilter: 'blur(4px)',
                                  color: '#e9edef',
                                  '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
                                  zIndex: 10,
                                  animation: 'fadeIn 0.1s ease',
                                  '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
                                }}
                              >
                                <KeyboardArrowDownRoundedIcon sx={{ fontSize: '0.85rem' }} />
                              </IconButton>
                            )}
                            */}
                          </>
                        )
                      })()}
                    </Box>
                  </Box>
                </React.Fragment>
              )
            })

          )}
          {activeTypingNames.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <TypingIndicator names={activeTypingNames} isGroup={isGroup} />
            </Box>
          )}
        </Box>
      </Box>

      {/* Message context menu — single instance, reused for all messages */}
      <MessageContextMenu
        anchorEl={menuState?.anchorEl ?? null}
        isOwn={menuState?.isOwn ?? false}
        messageContent={menuState?.message.content ?? ''}
        onClose={() => setMenuState(null)}
        onReply={() => {/* TODO: wire reply */ setMenuState(null)}}
        onCopy={() => {
          if (menuState?.message.content) {
            navigator.clipboard.writeText(menuState.message.content).catch(() => {})
          }
        }}
        onForward={() => {/* TODO: forward */ setMenuState(null)}}
        onDelete={() => {/* TODO: delete */ setMenuState(null)}}
        onReact={(emoji) => console.log('React', emoji, menuState?.message.id)}
      />
    </Box>
  )
}
