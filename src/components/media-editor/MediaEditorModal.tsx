import React, { useRef } from 'react'
import { Dialog, Box, TextField, IconButton } from '@mui/material'
import EmojiEmotionsRoundedIcon from '@mui/icons-material/EmojiEmotionsRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { CanvasEditor } from './CanvasEditor'
import type { CanvasEditorRef } from './CanvasEditor'
import { VideoEditor } from './VideoEditor'
import type { VideoEditorRef } from './VideoEditor'

export interface MediaEditorModalProps {
  previewFile: File | null
  previewUrl: string | null
  previewCaption: string
  setPreviewCaption: (c: string) => void
  onClose: () => void
  onSend: (file: File | null, metadata?: { startTime: number, endTime: number }) => Promise<void>
  uploading: boolean
}

export function MediaEditorModal({
  previewFile,
  previewUrl,
  previewCaption,
  setPreviewCaption,
  onClose,
  onSend,
  uploading
}: MediaEditorModalProps) {
  const canvasEditorRef = useRef<CanvasEditorRef>(null)
  const videoEditorRef = useRef<VideoEditorRef>(null)

  const handleSend = async () => {
    if (!previewFile) return
    
    if (previewFile.type.startsWith('image/')) {
        if (canvasEditorRef.current) {
            try {
              const editedBlob = await canvasEditorRef.current.exportBlob()
              const newFile = new File([editedBlob], previewFile.name, { type: 'image/jpeg' })
              await onSend(newFile)
            } catch (err) {
              console.error('Failed to export canvas', err)
              await onSend(previewFile) // Fallback
            }
        } else {
            await onSend(previewFile)
        }
    } else if (previewFile.type.startsWith('video/')) {
        let metadata
        if (videoEditorRef.current) {
            metadata = videoEditorRef.current.exportMetadata()
        }
        await onSend(previewFile, metadata)
    } else {
        await onSend(previewFile)
    }
  }

  return (
    <Dialog
      fullScreen
      open={Boolean(previewFile)}
      onClose={onClose}
      PaperProps={{
        sx: { bgcolor: '#0b141a', display: 'flex', flexDirection: 'column' }
      }}
    >
      {previewFile?.type.startsWith('image/') && previewUrl && (
        <CanvasEditor ref={canvasEditorRef} imageUrl={previewUrl} onClose={onClose} />
      )}
      
      {previewFile?.type.startsWith('video/') && previewUrl && (
        <VideoEditor ref={videoEditorRef} videoUrl={previewUrl} onClose={onClose} />
      )}

      {(!previewFile?.type.startsWith('image/') && !previewFile?.type.startsWith('video/')) && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
           <Box sx={{ p: 2 }}>
             <IconButton onClick={onClose} sx={{ color: '#e9edef' }}>
                <CloseRoundedIcon />
             </IconButton>
           </Box>
           <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
             <InsertDriveFileRoundedIcon sx={{ fontSize: 100, color: '#8696a0' }} />
           </Box>
        </Box>
      )}

      {/* Shared Bottom Compose Row */}
      <Box sx={{ bgcolor: '#0b141a', display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2, pb: 4 }}>
        <Box sx={{ width: '100%', maxWidth: '700px', display: 'flex', alignItems: 'flex-end', bgcolor: '#2a3942', borderRadius: '8px', p: 0.5, px: 2, mb: 2 }}>
          <TextField
            placeholder="Type a message"
            variant="standard"
            fullWidth
            multiline
            maxRows={6}
            value={previewCaption}
            onChange={(e) => setPreviewCaption(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            InputProps={{
              disableUnderline: true,
              sx: { color: '#e9edef', fontSize: '0.95rem', py: 1.25 }
            }}
          />
          <IconButton sx={{ color: '#8696a0', p: 1, mb: 0.25 }}>
            <EmojiEmotionsRoundedIcon />
          </IconButton>
        </Box>

        <Box sx={{ width: '100%', maxWidth: '700px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
             <Box sx={{ 
               width: '50px', height: '50px', 
               border: '2px solid #00a884', 
               borderRadius: '8px',
               overflow: 'hidden',
               display: 'flex', justifyContent: 'center', alignItems: 'center',
               bgcolor: '#202c33'
             }}>
               {previewFile?.type.startsWith('image/') && previewUrl ? (
                 <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
               ) : (
                 <InsertDriveFileRoundedIcon sx={{ color: '#8696a0' }} />
               )}
             </Box>
             <Box sx={{
               width: '50px', height: '50px',
               border: '1px solid rgba(255,255,255,0.1)',
               borderRadius: '8px',
               display: 'flex', justifyContent: 'center', alignItems: 'center',
               cursor: 'pointer'
             }}>
               <AddRoundedIcon sx={{ color: '#e9edef' }} />
             </Box>
          </Box>
          <Box>
            <IconButton 
              onClick={handleSend}
              disabled={uploading}
              sx={{ 
                bgcolor: '#00a884', 
                color: '#fff', 
                width: '54px', height: '54px',
                '&:hover': { bgcolor: '#008f6f' },
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
              }}
            >
              <SendRoundedIcon sx={{ fontSize: 24 }} />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Dialog>
  )
}
