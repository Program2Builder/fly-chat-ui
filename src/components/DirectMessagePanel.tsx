import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import { alpha } from '@mui/material/styles'
import {
  Avatar,
  Box,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import type { ActiveConversation, ChatContact, ChatGroup } from '../types/chat'
import { AuthenticatedAvatar } from './AuthenticatedAvatar'

interface DirectMessagePanelProps {
  contacts: ChatContact[]
  groups: ChatGroup[]
  activeConversation: ActiveConversation | null
  onSelectConversation: (conversation: ActiveConversation) => void
  onRemoveContact?: (username: string) => void
}

function stringToColor(s: string) {
  const palette = ['#00a884', '#005c4b', '#0078d4', '#6b2fa0', '#c2410c', '#0f766e', '#1d4ed8']
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}

export function DirectMessagePanel({
  contacts,
  groups,
  activeConversation,
  onSelectConversation,
  onRemoveContact,
}: DirectMessagePanelProps) {
  const [query, setQuery] = useState('')

  const q = query.toLowerCase().trim()
  const filteredGroups = q ? groups.filter(g => g.name.toLowerCase().includes(q)) : groups
  const filteredContacts = q ? contacts.filter(c =>
    c.displayName.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
  ) : contacts

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Search ── */}
      <Box sx={{ px: 1.5, py: 1.25 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search contacts & groups…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: '1.1rem', color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
              bgcolor: 'rgba(255,255,255,0.05)',
              fontSize: '0.875rem',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
              '&.Mui-focused fieldset': { borderColor: '#00a884' },
            },
          }}
        />
      </Box>

      {/* ── Scrollable list ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0,
        '&::-webkit-scrollbar': { width: '4px' },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.12)', borderRadius: '4px' },
        '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
      }}>

        {/* Groups section */}
        {filteredGroups.length > 0 && (
          <>
            <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#8696a0', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                Groups · {filteredGroups.length}
              </Typography>
            </Box>

            {filteredGroups.map(group => {
              const selected = activeConversation?.type === 'group' && activeConversation.group.roomId === group.roomId
              return (
                <Stack
                  key={group.roomId}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  onClick={() => onSelectConversation({ type: 'group', group })}
                  sx={{
                    px: 1.5, py: 1,
                    cursor: 'pointer',
                    borderRadius: '12px',
                    mx: 0.75,
                    mb: 0.25,
                    bgcolor: selected ? alpha('#00a884', 0.16) : 'transparent',
                    transition: 'background-color 0.15s',
                    '&:hover': { bgcolor: selected ? alpha('#00a884', 0.20) : alpha('#ffffff', 0.05) },
                    position: 'relative',
                  }}
                >
                  {/* Left accent bar when selected */}
                  {selected && (
                    <Box sx={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '3px', borderRadius: '0 3px 3px 0', bgcolor: '#00a884' }} />
                  )}

                  <Avatar
                    alt={group.name}
                    sx={{
                      width: 46, height: 46,
                      bgcolor: stringToColor(group.name),
                      fontSize: '1.1rem', fontWeight: 700,
                      boxShadow: selected ? '0 0 0 2px #00a884' : 'none',
                      transition: 'box-shadow 0.15s',
                      flexShrink: 0,
                    }}
                  >
                    <GroupsRoundedIcon sx={{ fontSize: '1.3rem' }} />
                  </Avatar>

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600, fontSize: '0.9rem', color: selected ? '#e9edef' : '#d1d5db' }}>
                      {group.name}
                    </Typography>
                    <Typography variant="caption" noWrap sx={{ color: '#8696a0', fontSize: '0.75rem' }}>
                      {group.description || group.roomId}
                    </Typography>
                  </Box>

                  <LockRoundedIcon sx={{ fontSize: '0.75rem', color: '#00a884', opacity: 0.7, flexShrink: 0 }} />
                </Stack>
              )
            })}
          </>
        )}

        {/* Contacts section */}
        {(filteredContacts.length > 0 || contacts.length === 0) && (
          <>
            <Box sx={{ px: 2, pt: filteredGroups.length > 0 ? 1.5 : 1, pb: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#8696a0', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                Contacts · {filteredContacts.length}
              </Typography>
            </Box>

            {filteredContacts.length === 0 && contacts.length === 0 ? (
              <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.82rem' }}>
                  No contacts yet. Use the + button to add someone.
                </Typography>
              </Box>
            ) : filteredContacts.length === 0 ? (
              <Box sx={{ px: 2, py: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.82rem' }}>
                  No contacts match "{query}"
                </Typography>
              </Box>
            ) : (
              filteredContacts.map(contact => {
                const selected = activeConversation?.type === 'direct' && activeConversation.contact.id === contact.id
                const initials = (contact.displayName || contact.id).slice(0, 2).toUpperCase()

                return (
                  <Stack
                    key={contact.id}
                    direction="row"
                    alignItems="center"
                    spacing={1.5}
                    onClick={() => onSelectConversation({ type: 'direct', contact })}
                    sx={{
                      px: 1.5, py: 1,
                      cursor: 'pointer',
                      borderRadius: '12px',
                      mx: 0.75,
                      mb: 0.25,
                      bgcolor: selected ? alpha('#00a884', 0.16) : 'transparent',
                      transition: 'background-color 0.15s',
                      '&:hover': {
                        bgcolor: selected ? alpha('#00a884', 0.20) : alpha('#ffffff', 0.05),
                        '& .remove-btn': { opacity: 1 },
                      },
                      position: 'relative',
                    }}
                  >
                    {selected && (
                      <Box sx={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '3px', borderRadius: '0 3px 3px 0', bgcolor: '#00a884' }} />
                    )}

                    <AuthenticatedAvatar
                      relativeUrl={contact.profilePictureUrl}
                      alt={contact.displayName}
                      sx={{
                        width: 46, height: 46,
                        bgcolor: stringToColor(contact.id),
                        fontSize: '1rem', fontWeight: 700,
                        boxShadow: selected ? '0 0 0 2px #00a884' : 'none',
                        transition: 'box-shadow 0.15s',
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </AuthenticatedAvatar>

                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600, fontSize: '0.9rem', color: selected ? '#e9edef' : '#d1d5db' }}>
                        {contact.displayName}
                      </Typography>
                      <Typography variant="caption" noWrap sx={{ color: '#8696a0', fontSize: '0.75rem' }}>
                        @{contact.id}
                      </Typography>
                    </Box>

                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                      <LockRoundedIcon sx={{ fontSize: '0.75rem', color: '#00a884', opacity: 0.7 }} />
                      {onRemoveContact && (
                        <Tooltip title="Remove Contact">
                          <IconButton
                            className="remove-btn"
                            size="small"
                            onClick={e => { e.stopPropagation(); onRemoveContact(contact.id) }}
                            sx={{
                              opacity: 0, p: 0.5,
                              color: 'text.disabled',
                              transition: 'opacity 0.15s, color 0.15s',
                              '&:hover': { color: 'error.main', bgcolor: alpha('#f44336', 0.1) },
                            }}
                          >
                            <DeleteOutlineRoundedIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>
                )
              })
            )}
          </>
        )}

        {/* Empty search result */}
        {q && filteredGroups.length === 0 && filteredContacts.length === 0 && (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.82rem' }}>
              Nothing matches "{query}"
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── Footer count ── */}
      <Box sx={{ px: 2, py: 1, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 1.5 }}>
        <Typography variant="caption" sx={{ color: '#8696a0', fontSize: '0.72rem' }}>
          {groups.length} group{groups.length !== 1 ? 's' : ''}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)' }}>·</Typography>
        <Typography variant="caption" sx={{ color: '#8696a0', fontSize: '0.72rem' }}>
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
        </Typography>
      </Box>
    </Box>
  )
}
