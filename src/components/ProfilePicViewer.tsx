import React from 'react'
import { Dialog, Box, IconButton, Typography, Fade } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { AuthenticatedAvatar } from './AuthenticatedAvatar'

interface ProfilePicViewerProps {
  open: boolean
  onClose: () => void
  relativeUrl?: string | null
  displayName?: string
  subtitle?: string
}

export function ProfilePicViewer({ open, onClose, relativeUrl, displayName, subtitle }: ProfilePicViewerProps) {
  const initials = displayName?.slice(0, 2).toUpperCase() || '?'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      TransitionComponent={Fade}
      PaperProps={{
        sx: {
          background: 'transparent',
          boxShadow: 'none',
          overflow: 'visible',
        },
      }}
      BackdropProps={{
        sx: { backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.75)' },
      }}
    >
      {/* Close button */}
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          top: -48,
          right: -4,
          color: '#e9edef',
          bgcolor: 'rgba(255,255,255,0.1)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
        }}
      >
        <CloseRoundedIcon />
      </IconButton>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          p: 1,
        }}
      >
        {/* Big rounded avatar */}
        <AuthenticatedAvatar
          relativeUrl={relativeUrl}
          sx={{
            width: 260,
            height: 260,
            fontSize: '4rem',
            fontWeight: 700,
            bgcolor: 'transparent',
            border: '0px solid transparent',
            boxShadow: '0 8px 40px transparent',
          }}
        >
          {initials}
        </AuthenticatedAvatar>

        {/* Name */}
        {displayName && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              sx={{
                color: '#e9edef',
                fontWeight: 700,
                fontSize: '1.2rem',
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}
            >
              {displayName}
            </Typography>
            {subtitle && (
              <Typography sx={{ color: '#8696a0', fontSize: '0.82rem', mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Dialog>
  )
}
