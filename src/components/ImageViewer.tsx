import { Box, Modal, IconButton, Avatar, CircularProgress } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import { useAuthenticatedImage } from '../hooks/useAuthenticatedImage'
import { useChat } from '../context/ChatContext'

interface ImageViewerProps {
  open: boolean
  imageUrl?: string | null
  fallbackText?: string
  alt?: string
  onClose: () => void
}

export function ImageViewer({ open, imageUrl, fallbackText, alt, onClose }: ImageViewerProps) {
  const { token } = useChat()
  const { src: authSrc, loading } = useAuthenticatedImage(open ? imageUrl : null, token)

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        bgcolor: 'rgba(11, 20, 26, 0.85)',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          outline: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: -48,
            right: -48,
            color: '#fff',
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.2)',
            },
            '@media (max-width: 600px)': {
              top: -48,
              right: 0,
            }
          }}
        >
          <CloseRoundedIcon />
        </IconButton>

        {imageUrl ? (
          <Box sx={{ position: 'relative' }}>
            <Box
              component="img"
              src={authSrc}
              alt={alt || 'Profile view'}
              sx={{
                maxWidth: { xs: '90vw', sm: '80vw', md: '600px' },
                maxHeight: { xs: '90vh', sm: '80vh', md: '600px' },
                objectFit: 'contain',
                boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
                visibility: loading ? 'hidden' : 'visible',
              }}
            />
            {loading && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                <CircularProgress color="inherit" />
              </Box>
            )}
          </Box>
        ) : (
          <Avatar
            sx={{
              width: { xs: '80vw', sm: 300 },
              height: { xs: '80vw', sm: 300 },
              bgcolor: '#6b7c85',
              fontSize: { xs: '8rem', sm: '10rem' },
              boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            }}
          >
            {fallbackText ? fallbackText.charAt(0).toUpperCase() : <PersonRoundedIcon sx={{ fontSize: 'inherit' }} />}
          </Avatar>
        )}
      </Box>
    </Modal>
  )
}
