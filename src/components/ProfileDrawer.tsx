import { alpha } from '@mui/material/styles'
import {
  Box,
  Drawer,
  IconButton,
  Typography,
  Avatar,
  Stack,
  CircularProgress,
  Tooltip,
  TextField,
  InputAdornment,
  Button,
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import type { AuthUser } from '../types/chat'
import { useState, useRef, useEffect } from 'react'
import { ImageViewer } from './ImageViewer'
import { getAvatarUrl } from '../utils/chatUtils'
import { useAuthenticatedImage } from '../hooks/useAuthenticatedImage'
import { useChat } from '../context/ChatContext'

interface ProfileDrawerProps {
  open: boolean
  user: AuthUser | null
  onClose: () => void
  onUpdateProfilePicture?: (file: File) => Promise<void>
  onUpdateProfile?: (displayName: string, about: string) => Promise<void>
  onResetEncryption?: () => Promise<void>
}

export function ProfileDrawer({ 
  open, 
  user, 
  onClose, 
  onUpdateProfilePicture,
  onUpdateProfile,
  onResetEncryption 
}: ProfileDrawerProps) {
  const { token } = useChat()
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [resetError, setResetError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Profile Edit State
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingAbout, setIsEditingAbout] = useState(false)
  const [editName, setEditName] = useState(user?.displayName || '')
  const [editAbout, setEditAbout] = useState(user?.about || 'Hey there! I am using FlyChat.')

  useEffect(() => {
    if (user) {
      setEditName(user.displayName)
      setEditAbout(user.about || 'Hey there! I am using FlyChat.')
    }
  }, [user])

  const { src: profilePicSrc, loading: picLoading } = useAuthenticatedImage(
    getAvatarUrl(user?.profilePictureUrl),
    token
  )

  if (!user) return null

  const fallbackText = user.displayName?.[0]?.toUpperCase()

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !onUpdateProfilePicture) return

    setUploading(true)
    try {
      await onUpdateProfilePicture(file)
    } catch (err) {
      console.error('Failed to upload profile picture:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleAvatarClick = () => {
    if (user.profilePictureUrl) {
      setImageViewerOpen(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleSaveName = async () => {
    if (!onUpdateProfile || editName === user.displayName) {
      setIsEditingName(false)
      return
    }
    setUploading(true)
    try {
      await onUpdateProfile(editName, editAbout)
      setIsEditingName(false)
    } finally {
      setUploading(false)
    }
  }

  const handleSaveAbout = async () => {
    if (!onUpdateProfile || editAbout === user.about) {
      setIsEditingAbout(false)
      return
    }
    setUploading(true)
    try {
      await onUpdateProfile(editName, editAbout)
      setIsEditingAbout(false)
    } finally {
      setUploading(false)
    }
  }

  const handleResetEncryption = async () => {
    if (!onResetEncryption) return
    if (!window.confirm(
      'Reset your E2EE keys?\n\n'
      + '• Your local keys will be wiped and regenerated.\n'
      + '• New keys will be uploaded to the server.\n'
      + '• Contacts must re-open chat to re-establish sessions.'
    )) {
      return
    }

    setResetLoading(true)
    setResetStatus('idle')
    setResetError(null)
    try {
      await onResetEncryption()
      setResetStatus('success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[E2EE] resetEncryption failed:', err)
      setResetStatus('error')
      setResetError(msg)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <>
      <Drawer
        anchor="left"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            bgcolor: '#111b21',
            color: 'text.primary',
            width: { xs: '100%', sm: 380 },
            borderRight: `1px solid ${alpha('#ffffff', 0.04)}`,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box sx={{ p: 2, bgcolor: '#202c33', display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton color="inherit" onClick={onClose}>
            <ArrowBackRoundedIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1 }}>Profile</Typography>
        </Box>
        
        <Box sx={{ p: 0, overflowY: 'auto', flex: 1 }}>
          <Stack alignItems="center" spacing={0}>
            <Box sx={{ p: 3, width: '100%', display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ position: 'relative' }}>
                <Box
                  sx={{
                    position: 'relative',
                    cursor: 'pointer',
                    borderRadius: '50%',
                    '&:hover .avatar-overlay': {
                      opacity: 1,
                    }
                  }}
                  onClick={handleAvatarClick}
                >
                  <Avatar
                    src={profilePicSrc}
                    sx={{
                      width: 200,
                      height: 200,
                      bgcolor: '#6b7c85',
                      fontSize: '5rem',
                    }}
                  >
                    {fallbackText || <PersonRoundedIcon fontSize="inherit" />}
                  </Avatar>
                  
                  <Box
                    className="avatar-overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: '50%',
                      bgcolor: 'rgba(0,0,0,0.4)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.2s',
                      color: 'white',
                      gap: 1,
                      textAlign: 'center',
                      p: 2,
                    }}
                  >
                    <PhotoCameraRoundedIcon sx={{ fontSize: '2.5rem' }} />
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                      {user.profilePictureUrl ? 'View Photo' : 'Upload Photo'}
                    </Typography>
                  </Box>

                  {(uploading || picLoading) && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: '50%',
                        bgcolor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1,
                      }}
                    >
                      <CircularProgress color="primary" />
                    </Box>
                  )}
                </Box>

                {onUpdateProfilePicture && (
                  <Tooltip title="Change Profile Photo">
                    <IconButton
                      size="small"
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        bgcolor: '#00a884',
                        color: 'white',
                        '&:hover': { bgcolor: '#008f72' },
                        boxShadow: 3,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      disabled={uploading}
                    >
                      <PhotoCameraRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              <input
                type="file"
                hidden
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
              />
            </Box>

            <Box sx={{ width: '100%', bgcolor: '#111b21', p: 3, mb: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <Typography variant="body2" color="#00a884" sx={{ mb: 1.5, fontWeight: 500 }}>
                Your name
              </Typography>
              
              {isEditingName ? (
                <TextField
                  fullWidth
                  variant="standard"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  InputProps={{
                    sx: { color: 'text.primary', borderBottom: '2px solid #00a884' },
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={handleSaveName} sx={{ color: '#00a884' }} disabled={uploading}>
                          <CheckRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setIsEditingName(false)} sx={{ color: '#8696a0' }}>
                          <CloseRoundedIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              ) : (
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="body1" sx={{ color: 'text.primary' }}>
                    {user.displayName}
                  </Typography>
                  <IconButton size="small" onClick={() => setIsEditingName(true)} sx={{ color: '#8696a0' }}>
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              )}
              
              <Typography variant="caption" sx={{ color: '#8696a0', display: 'block', mt: 1.5 }}>
                This is not your username or pin. This name will be visible to your FlyChat contacts.
              </Typography>
            </Box>

            <Box sx={{ width: '100%', bgcolor: '#111b21', p: 3, mb: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <Typography variant="body2" color="#00a884" sx={{ mb: 1.5, fontWeight: 500 }}>
                About
              </Typography>
              
              {isEditingAbout ? (
                <TextField
                  fullWidth
                  variant="standard"
                  multiline
                  value={editAbout}
                  onChange={(e) => setEditAbout(e.target.value)}
                  autoFocus
                  InputProps={{
                    sx: { color: 'text.primary', borderBottom: '2px solid #00a884' },
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={handleSaveAbout} sx={{ color: '#00a884' }} disabled={uploading}>
                          <CheckRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setIsEditingAbout(false)} sx={{ color: '#8696a0' }}>
                          <CloseRoundedIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              ) : (
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="body1" sx={{ color: 'text.primary' }}>
                    {user.about || 'Hey there! I am using FlyChat.'}
                  </Typography>
                  <IconButton size="small" onClick={() => setIsEditingAbout(true)} sx={{ color: '#8696a0' }}>
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              )}
            </Box>

            <Box sx={{ width: '100%', bgcolor: '#111b21', p: 3, mb: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <Typography variant="body2" color="#00a884" sx={{ mb: 1.5, fontWeight: 500 }}>
                Username
              </Typography>
              <Typography variant="body1" sx={{ color: '#8696a0' }}>
                @{user.username}
              </Typography>
            </Box>

            <Box sx={{ width: '100%', bgcolor: '#111b21', p: 3, mb: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <Typography variant="body2" color="#ea4335" sx={{ mb: 1.5, fontWeight: 500 }}>
                Security & Privacy
              </Typography>
              <Typography variant="caption" sx={{ color: '#8696a0', display: 'block', mb: 2 }}>
                If you are having trouble decrypting messages, you can reset your encryption state. This will regenerate your keys and clear all current sessions.
              </Typography>
              <Button 
                variant="outlined" 
                color="error" 
                fullWidth 
                onClick={handleResetEncryption}
                disabled={resetLoading}
                startIcon={resetLoading ? <CircularProgress size={20} color="inherit" /> : null}
                sx={{ 
                  textTransform: 'none', 
                  borderRadius: '20px',
                  borderColor: alpha('#ea4335', 0.3),
                  '&:hover': {
                    borderColor: '#ea4335',
                    bgcolor: alpha('#ea4335', 0.05)
                  }
                }}
              >
                {resetLoading ? 'Resetting…' : 'Reset End-to-End Encryption'}
              </Button>

              {/* Feedback below the button */}
              {resetStatus === 'success' && (
                <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '10px', bgcolor: 'rgba(0,168,132,0.1)', border: '1px solid rgba(0,168,132,0.3)' }}>
                  <Typography variant="caption" sx={{ color: '#00a884', fontWeight: 600 }}>
                    ✅ Keys reset & uploaded successfully. Contacts must re-open the chat to re-establish secure sessions.
                  </Typography>
                </Box>
              )}
              {resetStatus === 'error' && resetError && (
                <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '10px', bgcolor: 'rgba(234,67,53,0.1)', border: '1px solid rgba(234,67,53,0.3)' }}>
                  <Typography variant="caption" sx={{ color: '#ea4335', fontWeight: 600 }}>
                    ❌ Reset failed: {resetError}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: '#8696a0', mt: 0.5 }}>
                    Check the DevTools Console (F12) for details.
                  </Typography>
                </Box>
              )}
            </Box>
          </Stack>
        </Box>
      </Drawer>

      <ImageViewer 
        open={imageViewerOpen} 
        onClose={() => setImageViewerOpen(false)} 
        imageUrl={getAvatarUrl(user.profilePictureUrl)}
        fallbackText={fallbackText} 
      />
    </>
  )
}
