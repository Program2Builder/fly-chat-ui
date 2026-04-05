import { useState, type ChangeEvent, type KeyboardEvent } from 'react'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import TagRoundedIcon from '@mui/icons-material/TagRounded'
import {
  Alert,
  Avatar,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import type { ActiveConversation } from '../types/chat'

interface MessageComposerProps {
  connected: boolean
  activeConversation: ActiveConversation | null
  uploading: boolean
  onSendText: (text: string) => Promise<void>
  onSendMedia: (file: File) => Promise<void>
  onTyping: () => void
}

export function MessageComposer({
  connected,
  activeConversation,
  uploading,
  onSendText,
  onSendMedia,
  onTyping,
}: MessageComposerProps) {
  const [text, setText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState('')

  const resetForm = () => {
    setText('')
    setSelectedFile(null)
    setLocalError('')
  }

  const handleTyping = (nextText: string) => {
    setText(nextText)
    if (nextText.trim()) {
      onTyping()
    }
  }

  const handleSend = async () => {
    try {
      setLocalError('')

      if (selectedFile) {
        await onSendMedia(selectedFile)
      } else {
        await onSendText(text)
      }

      resetForm()
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to send message.')
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  const sendDisabled =
    !connected ||
    !activeConversation ||
    uploading ||
    (!selectedFile && !text.trim())

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 0.75, sm: 1 },
        borderRadius: 0,
        bgcolor: 'transparent',
        borderTop: '1px solid transparent',
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Avatar
            sx={{
              width: 28,
              height: 28,
              bgcolor: activeConversation?.type === 'group' ? 'primary.main' : '#6b7c85',
            }}
          >
            {activeConversation?.type === 'group' ? (
              <TagRoundedIcon sx={{ fontSize: 16 }} />
            ) : (
              <AlternateEmailRoundedIcon sx={{ fontSize: 16 }} />
            )}
          </Avatar>
          <Typography variant="caption" color="text.secondary">
            {activeConversation
              ? activeConversation.type === 'group'
                ? `Posting in ${activeConversation.group.name}`
                : `Messaging ${activeConversation.contact.displayName}`
              : 'Select a conversation to start messaging'}
          </Typography>
        </Stack>

        {localError ? <Alert severity="error">{localError}</Alert> : null}

        <Stack direction="row" spacing={{ xs: 0.75, sm: 1 }} alignItems="flex-end">
          <Stack spacing={0.75} sx={{ flex: 1 }}>
            <input
              id="media-upload"
              type="file"
              onChange={handleFileChange}
              disabled={!connected || uploading}
              style={{ display: 'none' }}
            />
            <Paper
              elevation={0}
              sx={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 1,
                px: 1,
                py: 0.75,
                borderRadius: 999,
                bgcolor: '#2a3942',
              }}
            >
              <label htmlFor="media-upload">
                <Tooltip title="Attach file">
                  <span>
                    <IconButton component="span" color="inherit" disabled={!connected || uploading}>
                      <AttachFileRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </label>
              <TextField
                placeholder={
                  activeConversation?.type === 'direct'
                    ? 'Type a direct message'
                    : 'Type a message'
                }
                variant="standard"
                fullWidth
                multiline
                maxRows={6}
                value={text}
                onChange={(event) => handleTyping(event.target.value)}
                onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (!sendDisabled) {
                      void handleSend()
                    }
                  }
                }}
                disabled={!connected}
                InputProps={{
                  disableUnderline: true,
                }}
              />
              <Avatar
                variant="rounded"
                sx={{
                  width: 'auto',
                  px: 1.25,
                  height: 32,
                  bgcolor: 'transparent',
                  color: 'text.secondary',
                  fontSize: 12,
                }}
              >
                {selectedFile ? selectedFile.name.slice(0, 16) : 'Enter to send'}
              </Avatar>
            </Paper>
            {selectedFile ? (
              <Typography variant="caption" color="text.secondary" sx={{ px: 1.5 }}>
                Attached: {selectedFile.name}
              </Typography>
            ) : null}
          </Stack>

          <Button
            variant="contained"
            sx={{ minWidth: 48, width: 48, height: 48, borderRadius: '50%', p: 0 }}
            disabled={sendDisabled}
            onClick={() => void handleSend()}
          >
            <SendRoundedIcon />
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )
}
