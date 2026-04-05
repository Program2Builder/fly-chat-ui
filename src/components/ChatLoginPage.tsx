import ChatRoundedIcon from '@mui/icons-material/ChatRounded'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import type { ConnectionStatus } from '../types/chat'

interface ChatLoginPageProps {
  status: ConnectionStatus
  isBootstrapping: boolean
  errorMessage?: string
  onSubmit: (credentials: { username: string; password: string }) => void
}

export function ChatLoginPage({
  status,
  isBootstrapping,
  errorMessage,
  onSubmit,
}: ChatLoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const disabled =
    isBootstrapping || status === 'connecting' || !username.trim() || !password.trim()

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          p: { xs: 3, sm: 4 },
          borderRadius: 6,
          bgcolor: '#111b21',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Stack spacing={3}>
          <Stack spacing={1.5} alignItems="center" textAlign="center">
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
              <ChatRoundedIcon />
            </Avatar>
            <Box>
              <Typography variant="h5">Start conversation</Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in once and we will load your profile, contacts, groups, and
                subscriptions automatically.
              </Typography>
            </Box>
          </Stack>

          <TextField
            label="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            fullWidth
            InputProps={{
              startAdornment: <PersonRoundedIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            fullWidth
            InputProps={{
              startAdornment: <LockRoundedIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

          <Button
            variant="contained"
            size="large"
            startIcon={<LoginRoundedIcon />}
            disabled={disabled}
            onClick={() => onSubmit({ username, password })}
          >
            {isBootstrapping || status === 'connecting' ? 'Signing in...' : 'Start chat'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
