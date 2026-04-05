import { useMemo, useState } from 'react'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { Box, Link, Stack, Typography, CircularProgress } from '@mui/material'
import type { MediaUploadResponse } from '../types/chat'
import { getMediaUrl, isImageContentType } from '../utils/media'
import { useAuthenticatedImage } from '../hooks/useAuthenticatedImage'
import { useChat } from '../context/ChatContext'
import { ImageViewer } from './ImageViewer'

interface MediaMessageProps {
  mediaId: string
  uploadedMedia?: MediaUploadResponse
  encryptionKeys?: { key: string; iv: string }
}

export function MediaMessage({ mediaId, uploadedMedia, encryptionKeys }: MediaMessageProps) {
  const { token } = useChat()
  const [imageErrored, setImageErrored] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const href = useMemo(() => getMediaUrl(mediaId, uploadedMedia), [mediaId, uploadedMedia])
  
  const canPreviewImage = isImageContentType(uploadedMedia?.contentType) && !imageErrored
  const { src: authSrc, loading } = useAuthenticatedImage(
    canPreviewImage ? href : null, 
    token, 
    encryptionKeys
  )

  return (
    <>
      <Stack spacing={1}>
        {canPreviewImage ? (
          <Box 
            sx={{ position: 'relative', width: 'min(320px, 100%)', cursor: 'zoom-in' }}
            onClick={() => setViewerOpen(true)}
          >
            <Box
              component="img"
              src={authSrc}
              alt={uploadedMedia?.storedFilename || mediaId}
              onError={() => setImageErrored(true)}
              sx={{
                width: '100%',
                borderRadius: 3,
                display: 'block',
                visibility: loading ? 'hidden' : 'visible',
                minHeight: loading ? 100 : 'auto',
                bgcolor: 'rgba(255,255,255,0.05)',
                transition: 'transform 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.02)'
                }
              }}
            />
            {loading && (
              <Box sx={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%', 
                transform: 'translate(-50%, -50%)' 
              }}>
                <CircularProgress size={24} color="inherit" />
              </Box>
            )}
          </Box>
        ) : (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ color: 'inherit' }}
          >
            <InsertDriveFileRoundedIcon fontSize="small" />
            <Typography variant="body2">{uploadedMedia?.storedFilename || mediaId}</Typography>
          </Stack>
        )}
        <Box>
          <Link
            component="button"
            onClick={() => setViewerOpen(true)}
            underline="hover"
            color="inherit"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', p: 0 }}
          >
            Open {encryptionKeys ? 'secure ' : ''}preview <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
          </Link>
        </Box>
      </Stack>

      {canPreviewImage && (
        <ImageViewer
          open={viewerOpen}
          imageUrl={href}
          onClose={() => setViewerOpen(false)}
          encryptionKeys={encryptionKeys}
          alt={uploadedMedia?.storedFilename || mediaId}
        />
      )}
    </>
  )
}
