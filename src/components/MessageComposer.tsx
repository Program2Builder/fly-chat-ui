import { useState, useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EmojiEmotionsRoundedIcon from '@mui/icons-material/EmojiEmotionsRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import HeadsetRoundedIcon from '@mui/icons-material/HeadsetRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import PollRoundedIcon from '@mui/icons-material/PollRounded'
import EventRoundedIcon from '@mui/icons-material/EventRounded'
import MicRoundedIcon from '@mui/icons-material/MicRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import {
  Alert,
  Box,
  IconButton,
  Popover,
  MenuList,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
} from '@mui/material'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import type { ActiveConversation } from '../types/chat'
import { MediaEditorModal } from './media-editor/MediaEditorModal'

interface MessageComposerProps {
  connected: boolean
  activeConversation: ActiveConversation | null
  uploading: boolean
  onSendText: (text: string) => Promise<void>
  onSendMedia: (file: File, caption?: string) => Promise<void>
  onTyping: () => void
}

export function MessageComposer({
  connected,
  uploading,
  onSendText,
  onSendMedia,
  onTyping,
}: MessageComposerProps) {
  const [text, setText] = useState('')
  const [localError, setLocalError] = useState('')

  const [attachAnchorEl, setAttachAnchorEl] = useState<null | HTMLElement>(null)
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<null | HTMLElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleTyping = (nextText: string) => {
    setText(nextText)
    if (nextText.trim()) {
      onTyping()
    }
  }

  const handleSend = async () => {
    if (!text.trim()) return
    try {
      setLocalError('')
      await onSendText(text)
      setText('')
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to send message.')
    }
  }

  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewCaption, setPreviewCaption] = useState('')
  // Files picked through "Document" are sent untouched, like WhatsApp, even
  // when they happen to be images.
  const [previewAsDocument, setPreviewAsDocument] = useState(false)
  const uploadAsDocumentRef = useRef(false)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setAttachAnchorEl(null)
    if (!file) return

    setPreviewAsDocument(uploadAsDocumentRef.current)
    setPreviewFile(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    uploadAsDocumentRef.current = false
  }

  const cancelPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewFile(null)
    setPreviewUrl(null)
    setPreviewCaption('')
    setPreviewAsDocument(false)
    setLocalError('')
  }

  const sendPreview = async (finalFile?: File | null) => {
    const fileToSend = finalFile || previewFile
    if (!fileToSend) return
    try {
      setLocalError('')
      // Video trim metadata is not part of the upload contract yet, so the
      // resolved file/blob is sent through the standard media callback.
      await onSendMedia(fileToSend, previewCaption)
      cancelPreview()
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to upload media.')
    }
  }

  const triggerFileUpload = (accept?: string, asDocument = false) => {
    uploadAsDocumentRef.current = asDocument
    if (fileInputRef.current) {
      if (accept) fileInputRef.current.accept = accept
      else fileInputRef.current.accept = '*/*'
      fileInputRef.current.click()
    }
  }

  return (
    <Box sx={{ width: '100%', bgcolor: '#202c33', p: { xs: 1, sm: 1.5 }, display: 'flex', flexDirection: 'column' }}>
      {localError && <Alert severity="error" sx={{ mb: 1 }}>{localError}</Alert>}
      
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          disabled={!connected || uploading}
          style={{ display: 'none' }}
        />
        
        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.25 }}>
          <IconButton 
            onClick={(e) => setAttachAnchorEl(e.currentTarget)} 
            disabled={!connected || uploading}
            sx={{ color: '#8696a0', p: 1 }}
          >
            <AddRoundedIcon sx={{ fontSize: 26 }} />
          </IconButton>
          
          <IconButton 
            onClick={(e) => setEmojiAnchorEl(e.currentTarget)} 
            disabled={!connected}
            sx={{ color: '#8696a0', p: 1 }}
          >
            <EmojiEmotionsRoundedIcon sx={{ fontSize: 26 }} />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, bgcolor: '#2a3942', borderRadius: '8px', p: 0.5, px: 2 }}>
          <TextField
            placeholder="Type a message"
            variant="standard"
            fullWidth
            multiline
            maxRows={6}
            value={text}
            onChange={(event) => handleTyping(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void handleSend()
              }
            }}
            disabled={!connected}
            InputProps={{
              disableUnderline: true,
              sx: {
                color: '#e9edef',
                fontSize: '0.95rem',
                py: 0.75,
                fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Roboto", sans-serif',
              }
            }}
          />
        </Box>

        <Box sx={{ mb: 0.25 }}>
          {text.trim() ? (
             <IconButton 
               onClick={handleSend}
               disabled={uploading}
               sx={{ color: '#8696a0', p: 1 }}
             >
               <SendRoundedIcon sx={{ fontSize: 24, color: '#00a884' }} />
             </IconButton>
          ) : (
             <IconButton disabled sx={{ color: '#8696a0', p: 1 }}>
               <MicRoundedIcon sx={{ fontSize: 24 }} />
             </IconButton>
          )}
        </Box>
      </Box>

      {/* Attachment Menu Popover */}
      <Popover
        open={Boolean(attachAnchorEl)}
        anchorEl={attachAnchorEl}
        onClose={() => setAttachAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{
          sx: { 
            bgcolor: '#233138', 
            borderRadius: '16px', 
            color: '#e9edef', 
            minWidth: 200, 
            mb: 2,
            boxShadow: '0 2px 5px 0 rgba(11,20,26,.26), 0 2px 10px 0 rgba(11,20,26,.16)'
          }
        }}
      >
        <MenuList sx={{ py: 1 }}>
          <MenuItem sx={{ py: 1.25, px: 3 }} onClick={() => triggerFileUpload(undefined, true)}>
            <ListItemIcon><InsertDriveFileRoundedIcon sx={{ color: '#7F66FF' }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '1rem' }}>Document</ListItemText>
          </MenuItem>
          <MenuItem sx={{ py: 1.25, px: 3 }} onClick={() => triggerFileUpload('image/*,video/*')}>
            <ListItemIcon><PhotoLibraryRoundedIcon sx={{ color: '#007BFC' }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '1rem' }}>Photos & videos</ListItemText>
          </MenuItem>
          <MenuItem sx={{ py: 1.25, px: 3 }}>
            <ListItemIcon><CameraAltRoundedIcon sx={{ color: '#D03B79' }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '1rem' }}>Camera</ListItemText>
          </MenuItem>
          <MenuItem sx={{ py: 1.25, px: 3 }}>
            <ListItemIcon><HeadsetRoundedIcon sx={{ color: '#FF7A00' }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '1rem' }}>Audio</ListItemText>
          </MenuItem>
          <MenuItem sx={{ py: 1.25, px: 3 }}>
            <ListItemIcon><PersonRoundedIcon sx={{ color: '#00A3DA' }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '1rem' }}>Contact</ListItemText>
          </MenuItem>
          <MenuItem sx={{ py: 1.25, px: 3 }}>
            <ListItemIcon><PollRoundedIcon sx={{ color: '#FFC107' }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '1rem' }}>Poll</ListItemText>
          </MenuItem>
          <MenuItem sx={{ py: 1.25, px: 3 }}>
            <ListItemIcon><EventRoundedIcon sx={{ color: '#FF5C8A' }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '1rem' }}>Event</ListItemText>
          </MenuItem>
        </MenuList>
      </Popover>

      {/* Emoji Picker Popover */}
      <Popover
        open={Boolean(emojiAnchorEl)}
        anchorEl={emojiAnchorEl}
        onClose={() => setEmojiAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{
          sx: { 
            bgcolor: 'transparent',
            boxShadow: 'none',
            mb: 1
          }
        }}
      >
        <EmojiPicker 
          theme={Theme.DARK} 
          onEmojiClick={(emojiData) => handleTyping(text + emojiData.emoji)}
          width={350}
          height={400}
        />
      </Popover>

      {/* Full Screen Media Editor / Preview Modal */}
      {previewFile && (
        <MediaEditorModal
          previewFile={previewFile}
          previewUrl={previewUrl}
          previewCaption={previewCaption}
          setPreviewCaption={setPreviewCaption}
          asDocument={previewAsDocument}
          onReplace={() =>
            triggerFileUpload(
              previewAsDocument ? undefined : 'image/*,video/*',
              previewAsDocument,
            )
          }
          onClose={cancelPreview}
          onSend={(file) => sendPreview(file)}
          uploading={uploading}
        />
      )}
    </Box>
  )
}
