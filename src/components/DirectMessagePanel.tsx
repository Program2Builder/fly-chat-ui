import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import { alpha } from '@mui/material/styles'
import { Avatar, Box, Divider, Paper, Stack, Typography, IconButton, Tooltip } from '@mui/material'
import type { ActiveConversation, ChatContact, ChatGroup } from '../types/chat'
import { AuthenticatedAvatar } from './AuthenticatedAvatar'

interface DirectMessagePanelProps {
  contacts: ChatContact[]
  groups: ChatGroup[]
  activeConversation: ActiveConversation | null
  onSelectConversation: (conversation: ActiveConversation) => void
  onRemoveContact?: (username: string) => void
}

export function DirectMessagePanel({
  contacts,
  groups,
  activeConversation,
  onSelectConversation,
  onRemoveContact,
}: DirectMessagePanelProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: alpha('#ffffff', 0.015),
        minHeight: 0,
      }}
    >
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{ px: 1.5, py: 1.25, bgcolor: '#202c33' }}
      >
        <ChatBubbleOutlineRoundedIcon color="primary" />
        <Box>
          <Typography variant="subtitle1">Chats</Typography>
          <Typography variant="caption" color="text.secondary">
            Contacts and groups from bootstrap
          </Typography>
        </Box>
      </Stack>

      <Stack sx={{ overflowY: 'auto', minHeight: 0 }}>
        <Box sx={{ px: 1.5, pt: 1.25, pb: 0.75 }}>
          <Typography variant="caption" color="text.secondary">
            Groups
          </Typography>
        </Box>
        {groups.map((group, index) => {
          const selected =
            activeConversation?.type === 'group' &&
            activeConversation.group.roomId === group.roomId

          return (
            <Box key={group.roomId}>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                onClick={() => onSelectConversation({ type: 'group', group })}
                sx={{
                  px: 1.5,
                  py: 1.1,
                  cursor: 'pointer',
                  bgcolor: selected ? alpha('#00a884', 0.14) : alpha('#ffffff', 0.01),
                  transition: 'background-color 0.2s ease',
                }}
              >
                <Avatar sx={{ width: 42, height: 42, bgcolor: '#005c4b' }}>
                  <GroupsRoundedIcon fontSize="small" />
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2" noWrap>
                    {group.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {group.description || group.roomId}
                  </Typography>
                </Box>
              </Stack>
              {index < groups.length - 1 || contacts.length > 0 ? (
                <Divider sx={{ borderColor: alpha('#ffffff', 0.06), ml: 7.5 }} />
              ) : null}
            </Box>
          )
        })}

        <Box sx={{ px: 1.5, pt: 1.5, pb: 0.75 }}>
          <Typography variant="caption" color="text.secondary">
            Contacts
          </Typography>
        </Box>
        {contacts.length === 0 ? (
          <Box sx={{ px: 1.5, pb: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              You haven't added any contacts yet! Click the + button above to start chatting.
            </Typography>
          </Box>
        ) : (
          contacts.map((contact, index) => {
            const selected =
              activeConversation?.type === 'direct' &&
              activeConversation.contact.id === contact.id

            return (
              <Box key={contact.id}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  onClick={() => onSelectConversation({ type: 'direct', contact })}
                  sx={{
                    px: 1.5,
                    py: 1.1,
                    cursor: 'pointer',
                    bgcolor: selected ? alpha('#00a884', 0.14) : alpha('#ffffff', 0.01),
                    transition: 'background-color 0.2s ease',
                  }}
                >
                <AuthenticatedAvatar 
                  relativeUrl={contact.profilePictureUrl}
                  sx={{ width: 42, height: 42, bgcolor: '#00a884' }}
                >
                  <AlternateEmailRoundedIcon fontSize="small" />
                </AuthenticatedAvatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" noWrap>
                      {contact.displayName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {contact.id}
                    </Typography>
                  </Box>
                  {onRemoveContact && (
                    <Tooltip title="Remove Contact">
                      <IconButton
                        size="small"
                        color="inherit"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveContact(contact.id)
                        }}
                        sx={{
                          color: 'text.secondary',
                          opacity: 0.5,
                          '&:hover': {
                            opacity: 1,
                            color: 'error.main',
                            bgcolor: alpha('#f44336', 0.1),
                          },
                        }}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                {index < contacts.length - 1 ? (
                  <Divider sx={{ borderColor: alpha('#ffffff', 0.06), ml: 7.5 }} />
                ) : null}
              </Box>
            )
          })
        )}
      </Stack>

      <Box sx={{ px: 1.5, py: 1, borderTop: `1px solid ${alpha('#ffffff', 0.06)}` }}>
        <Typography variant="caption" color="text.secondary">
          {groups.length} groups, {contacts.length} contacts
        </Typography>
      </Box>
    </Paper>
  )
}
