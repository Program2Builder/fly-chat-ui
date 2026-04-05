import { Avatar, Box } from '@mui/material'
import type { AvatarProps } from '@mui/material'
import { useAuthenticatedImage } from '../hooks/useAuthenticatedImage'
import { useChat } from '../context/ChatContext'
import { getAvatarUrl } from '../utils/chatUtils'

interface AuthenticatedAvatarProps extends AvatarProps {
  relativeUrl?: string | null
}

export function AuthenticatedAvatar({ relativeUrl, sx, children, ...props }: AuthenticatedAvatarProps) {
  const { token } = useChat()
  const { src, loading } = useAuthenticatedImage(getAvatarUrl(relativeUrl), token)

  return (
    <Box sx={{ 
      position: 'relative', 
      display: 'inline-flex',
      flexShrink: 0,
      ...sx 
    }}>
      <Avatar 
        {...props} 
        src={src} 
        sx={{ 
          width: '100%', 
          height: '100%',
          backgroundColor: src ? 'transparent' : (sx as any)?.bgcolor || '#6b7c85',
        }}
      >
        {!src && !loading && children}
      </Avatar>
    </Box>
  )
}
