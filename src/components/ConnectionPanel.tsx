import { useEffect, useState } from 'react'
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded'
import WifiRoundedIcon from '@mui/icons-material/WifiRounded'
import { alpha } from '@mui/material/styles'
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import type { ReactElement } from 'react'
import type { ConnectionStatus, SessionProfile } from '../types/chat'

interface ConnectionPanelProps {
  profile: SessionProfile
  status: ConnectionStatus
  errors: { source: string; message: string }[]
  onSaveProfile: (profile: SessionProfile) => void
  onConnect: (profile?: SessionProfile) => void
  onDisconnect: () => void
  onClearErrors: () => void
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting',
  connected: 'Connected',
  error: 'Error',
}

const STATUS_ICONS: Record<ConnectionStatus, ReactElement> = {
  disconnected: <LinkOffRoundedIcon fontSize="small" />,
  connecting: <AutorenewRoundedIcon fontSize="small" />,
  connected: <WifiRoundedIcon fontSize="small" />,
  error: <ErrorOutlineRoundedIcon fontSize="small" />,
}

export function ConnectionPanel({
  profile,
  status,
  errors,
  onSaveProfile,
  onConnect,
  onDisconnect,
  onClearErrors,
}: ConnectionPanelProps) {
  const [draft, setDraft] = useState(profile)

  useEffect(() => {
    setDraft(profile)
  }, [profile])

  const isConnected = status === 'connected'
  const canConnect =
    status !== 'connecting' && !!draft.userId.trim() && !!draft.displayName.trim()

  return (
    <Paper elevation={0} sx={{ p: 1.5, borderRadius: 5, bgcolor: alpha('#ffffff', 0.015) }}>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Box>
            <Typography variant="h6">Profile & connection</Typography>
            <Typography variant="body2" color="text.secondary">
              Identity is stored in localStorage so reconnecting is quick.
            </Typography>
          </Box>
          <Chip
            icon={STATUS_ICONS[status]}
            label={STATUS_LABELS[status]}
            color={
              status === 'connected'
                ? 'primary'
                : status === 'error'
                  ? 'error'
                  : 'default'
            }
          />
        </Stack>

        <Stack spacing={1}>
          <TextField
            label="User id"
            fullWidth
            size="small"
            value={draft.userId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, userId: event.target.value }))
            }
            placeholder="user1"
          />

          <TextField
            label="Display name"
            fullWidth
            size="small"
            value={draft.displayName}
            onChange={(event) =>
              setDraft((current) => ({ ...current, displayName: event.target.value }))
            }
            placeholder="User One"
          />

          <TextField
            label="Default room id"
            fullWidth
            size="small"
            value={draft.roomId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, roomId: event.target.value }))
            }
            placeholder="room-1"
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="outlined" color="inherit" onClick={() => onSaveProfile(draft)}>
            Save profile
          </Button>
          <Button
            variant="contained"
            disabled={!canConnect}
            onClick={() => {
              onSaveProfile(draft)
              onConnect(draft)
            }}
          >
            {status === 'connecting' ? 'Connecting...' : 'Connect'}
          </Button>
          <Button
            variant="text"
            color="inherit"
            disabled={!isConnected && status !== 'error'}
            onClick={onDisconnect}
          >
            Disconnect
          </Button>
        </Stack>

        {errors.length > 0 ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={onClearErrors}>
                Clear
              </Button>
            }
          >
            {errors[0]?.message}
          </Alert>
        ) : (
          <Alert severity="info" sx={{ bgcolor: 'rgba(0, 168, 132, 0.08)' }}>
            Backend URLs come from `VITE_API_BASE_URL` and `VITE_WS_BASE_URL`.
          </Alert>
        )}
      </Stack>
    </Paper>
  )
}
