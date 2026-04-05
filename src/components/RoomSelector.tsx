import { useEffect, useState } from 'react'
import ForumRoundedIcon from '@mui/icons-material/ForumRounded'
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'
import { alpha } from '@mui/material/styles'
import { Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material'

interface RoomSelectorProps {
  activeRoomId: string
  isConnected: boolean
  loadingHistory: boolean
  roomMessageCount: number
  onJoinRoom: (roomId: string) => void
}

export function RoomSelector({
  activeRoomId,
  isConnected,
  loadingHistory,
  roomMessageCount,
  onJoinRoom,
}: RoomSelectorProps) {
  const [draftRoomId, setDraftRoomId] = useState(activeRoomId)

  useEffect(() => {
    setDraftRoomId(activeRoomId)
  }, [activeRoomId])

  return (
    <Paper elevation={0} sx={{ p: 1.5, borderRadius: 5, bgcolor: alpha('#ffffff', 0.015) }}>
      <Stack spacing={1.5}>
        <div>
          <Typography variant="h6">Room chat</Typography>
          <Typography variant="body2" color="text.secondary">
            Join a room, fetch history, and keep the live subscription active.
          </Typography>
        </div>

        <TextField
          label="Room id"
          size="small"
          value={draftRoomId}
          onChange={(event) => setDraftRoomId(event.target.value)}
          placeholder="room-1"
          fullWidth
        />

        <Button
          variant="contained"
          disabled={!draftRoomId.trim() || !isConnected || loadingHistory}
          startIcon={loadingHistory ? <SyncRoundedIcon /> : <ForumRoundedIcon />}
          onClick={() => onJoinRoom(draftRoomId)}
        >
          {loadingHistory ? 'Loading...' : 'Join room'}
        </Button>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip icon={<ForumRoundedIcon />} label={`Active: ${activeRoomId || 'None'}`} />
          <Chip label={`${roomMessageCount} messages`} variant="outlined" />
          <Chip label={isConnected ? 'Live subscription on' : 'Offline'} variant="outlined" />
        </Stack>
      </Stack>
    </Paper>
  )
}
