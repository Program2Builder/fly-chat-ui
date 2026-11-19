import { Box, IconButton, Typography } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import { formatBytes } from '../../utils/media'
import { getDocumentInfo } from './utils/fileInfo'

interface DocumentPreviewProps {
  file: File
  previewUrl?: string | null
  onClose: () => void
}

/**
 * WhatsApp-style document preview: a paper card showing the attachment type
 * and a few placeholder lines, with the file name and size underneath.
 * Documents are not editable, they are sent exactly as selected.
 */
export function DocumentPreview({ file, previewUrl, onClose }: DocumentPreviewProps) {
  const info = getDocumentInfo(file.name, file.type)
  const isImage = file.type.startsWith('image/')

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: '#0b141a', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 1.5, bgcolor: '#111b21' }}>
        <IconButton onClick={onClose} sx={{ color: '#e9edef' }}>
          <CloseRoundedIcon />
        </IconButton>
        <Typography sx={{ color: '#e9edef', ml: 1, fontWeight: 500, fontSize: '1rem' }}>
          Document
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2.5,
          px: 3,
          overflow: 'auto',
        }}
      >
        <Box
          sx={{
            width: 200,
            height: 260,
            bgcolor: '#ffffff',
            borderRadius: '6px',
            overflow: 'hidden',
            boxShadow: '0 18px 48px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          <Box sx={{ height: 6, bgcolor: info.color }} />
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
            {isImage && previewUrl ? (
              <Box
                component="img"
                src={previewUrl}
                alt={file.name}
                sx={{
                  width: '100%',
                  flex: 1,
                  minHeight: 0,
                  objectFit: 'contain',
                  bgcolor: '#f4f4f4',
                  borderRadius: '2px',
                }}
              />
            ) : (
              <>
                <Box
                  sx={{
                    alignSelf: 'flex-start',
                    px: 0.75,
                    py: 0.2,
                    borderRadius: '3px',
                    bgcolor: info.color,
                  }}
                >
                  <Typography sx={{ color: '#fff', fontSize: '0.58rem', fontWeight: 800, lineHeight: 1.5 }}>
                    {info.label}
                  </Typography>
                </Box>

                <Box sx={{ width: '65%', height: 6, borderRadius: 3, bgcolor: '#e4e4e4' }} />
                <Box sx={{ width: '85%', height: 6, borderRadius: 3, bgcolor: '#ededed' }} />
                <Box sx={{ width: '78%', height: 6, borderRadius: 3, bgcolor: '#ededed' }} />
                <Box sx={{ width: '60%', height: 6, borderRadius: 3, bgcolor: '#ededed' }} />

                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <InsertDriveFileRoundedIcon sx={{ fontSize: 64, color: info.color, opacity: 0.28 }} />
                </Box>
              </>
            )}
          </Box>
        </Box>

        <Box sx={{ textAlign: 'center', maxWidth: 360 }}>
          <Typography
            title={file.name}
            sx={{ color: '#e9edef', fontSize: '0.95rem', fontWeight: 500, wordBreak: 'break-all' }}
          >
            {file.name}
          </Typography>
          <Typography sx={{ color: '#8696a0', fontSize: '0.78rem', mt: 0.25 }}>
            {info.description} · {formatBytes(file.size)}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
