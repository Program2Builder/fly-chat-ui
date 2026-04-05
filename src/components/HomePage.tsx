import ChatRoundedIcon from '@mui/icons-material/ChatRounded'
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import { alpha } from '@mui/material/styles'
import {
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material'

interface HomePageProps {
  onOpenChat: () => void
}

export function HomePage({ onOpenChat }: HomePageProps) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        py: { xs: 4, md: 6 },
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.15fr 0.85fr' },
            gap: 3,
            alignItems: 'stretch',
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 5 },
              borderRadius: 6,
              backgroundColor: alpha('#111b21', 0.92),
              border: `1px solid ${alpha('#ffffff', 0.08)}`,
            }}
          >
            <Stack spacing={3}>
              <Chip
                label="Fly Chat"
                color="primary"
                sx={{ alignSelf: 'flex-start', fontWeight: 700 }}
              />
              <Typography variant="h1" sx={{ fontSize: { xs: '2.6rem', md: '4.6rem' } }}>
                WhatsApp-style chat for your Spring backend.
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 640, fontWeight: 400 }}>
                Open the chat workspace, authenticate with your own user id, join rooms,
                send private messages, and upload media through the backend you already
                have.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<ChatRoundedIcon />}
                  onClick={onOpenChat}
                >
                  Open chat workspace
                </Button>
                <Chip label="Default route: /" variant="outlined" />
                <Chip label="Chat route: /chat" variant="outlined" />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Chip icon={<LockOpenRoundedIcon />} label="Live STOMP + SockJS" />
                <Chip icon={<CloudUploadRoundedIcon />} label="Media upload and preview" />
              </Stack>
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 6,
              backgroundColor: alpha('#111b21', 0.94),
              border: `1px solid ${alpha('#ffffff', 0.08)}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: 'primary.main' }}>F</Avatar>
              <Box>
                <Typography variant="subtitle1">Preview</Typography>
                <Typography variant="body2" color="text.secondary">
                  WhatsApp-inspired conversation layout
                </Typography>
              </Box>
            </Stack>

            <Box
              sx={{
                p: 2,
                borderRadius: 5,
                backgroundColor: '#0b141a',
                backgroundImage:
                  'radial-gradient(circle at top left, rgba(0,168,132,0.16), transparent 36%), linear-gradient(180deg, rgba(17,27,33,0.95), rgba(11,20,26,0.95))',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                minHeight: 360,
              }}
            >
              <Paper
                sx={{
                  px: 2,
                  py: 1.5,
                  maxWidth: '82%',
                  bgcolor: '#202c33',
                  borderRadius: 4,
                  color: 'text.primary',
                }}
              >
                <Typography variant="body2">Room `room-1` is ready and history is available.</Typography>
              </Paper>
              <Paper
                sx={{
                  px: 2,
                  py: 1.5,
                  maxWidth: '82%',
                  ml: 'auto',
                  bgcolor: '#005c4b',
                  borderRadius: 4,
                  color: '#e9edef',
                }}
              >
                <Typography variant="body2">
                  Direct messages, typing indicators, and media uploads are wired in.
                </Typography>
              </Paper>
              <Typography variant="caption" color="text.secondary">
                The chat workspace uses MUI components and a WhatsApp-like visual rhythm.
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  )
}
