import {
  Popover, Box, IconButton, MenuList, MenuItem,
  ListItemIcon, ListItemText, Divider
} from '@mui/material'
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import ForwardRoundedIcon from '@mui/icons-material/ForwardRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

interface MessageContextMenuProps {
  anchorEl: HTMLElement | null
  isOwn: boolean
  messageContent: string
  onClose: () => void
  onReply: () => void
  onCopy: () => void
  onForward: () => void
  onDelete: () => void
  onReact: (emoji: string) => void
}

export function MessageContextMenu({
  anchorEl,
  isOwn,
  messageContent,
  onClose,
  onReply,
  onCopy,
  onForward,
  onDelete,
  onReact,
}: MessageContextMenuProps) {
  const action = (fn: () => void) => () => { fn(); onClose() }

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: isOwn ? 'right' : 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: isOwn ? 'right' : 'left' }}
      PaperProps={{
        sx: {
          bgcolor: '#1f2c34',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.08)',
          minWidth: 220,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          mt: 0.5,
        }
      }}
    >
      {/* ── Quick emoji reactions ─────────────────────── */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        px: 1,
        py: 0.75,
        gap: 0.25,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {QUICK_EMOJIS.map((emoji) => (
          <IconButton
            key={emoji}
            size="small"
            onClick={action(() => onReact(emoji))}
            sx={{
              fontSize: '1.35rem',
              p: 0.6,
              borderRadius: '50%',
              transition: 'transform 0.15s, background 0.15s',
              '&:hover': {
                transform: 'scale(1.3)',
                bgcolor: 'rgba(255,255,255,0.08)',
              },
            }}
          >
            <span style={{ fontFamily: '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif' }}>
              {emoji}
            </span>
          </IconButton>
        ))}
        <IconButton
          size="small"
          sx={{
            p: 0.6,
            borderRadius: '50%',
            color: '#8696a0',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: '#e9edef' },
          }}
        >
          <AddRoundedIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
      </Box>

      {/* ── Action items ──────────────────────────────── */}
      <MenuList dense sx={{ py: 0.5 }}>
        <MenuItem
          onClick={action(onReply)}
          sx={{ py: 1, px: 2, color: '#e9edef', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}
        >
          <ListItemIcon sx={{ color: '#8696a0', minWidth: 36 }}>
            <ReplyRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.9rem' }}>Reply</ListItemText>
        </MenuItem>

        {messageContent && (
          <MenuItem
            onClick={action(onCopy)}
            sx={{ py: 1, px: 2, color: '#e9edef', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}
          >
            <ListItemIcon sx={{ color: '#8696a0', minWidth: 36 }}>
              <ContentCopyRoundedIcon sx={{ fontSize: '1.1rem' }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '0.9rem' }}>Copy</ListItemText>
          </MenuItem>
        )}

        <MenuItem
          onClick={action(onForward)}
          sx={{ py: 1, px: 2, color: '#e9edef', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}
        >
          <ListItemIcon sx={{ color: '#8696a0', minWidth: 36 }}>
            <ForwardRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.9rem' }}>Forward</ListItemText>
        </MenuItem>

        {isOwn && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 0.5 }} />
            <MenuItem
              onClick={action(onDelete)}
              sx={{ py: 1, px: 2, color: '#ef5350', '&:hover': { bgcolor: 'rgba(239,83,80,0.08)' } }}
            >
              <ListItemIcon sx={{ color: '#ef5350', minWidth: 36 }}>
                <DeleteRoundedIcon sx={{ fontSize: '1.1rem' }} />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '0.9rem' }}>Delete</ListItemText>
            </MenuItem>
          </>
        )}
      </MenuList>
    </Popover>
  )
}
