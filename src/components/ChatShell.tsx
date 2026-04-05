import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ForumRoundedIcon from '@mui/icons-material/ForumRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import AddCommentRoundedIcon from '@mui/icons-material/AddCommentRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import { alpha } from '@mui/material/styles'
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Typography,
  Drawer,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import { useState } from 'react'
import { useChat } from '../context/ChatContext'
import { ChatLoginPage } from './ChatLoginPage'
import { DirectMessagePanel } from './DirectMessagePanel'
import { MessageComposer } from './MessageComposer'
import { MessageList } from './MessageList'
import { AddContactDialog } from './AddContactDialog.tsx'
import { ConfirmationDialog } from './ConfirmationDialog'
import { ProfileDrawer } from './ProfileDrawer'
import { CreateGroupDialog } from './CreateGroupDialog'
import { AuthenticatedAvatar } from './AuthenticatedAvatar'

interface ChatShellProps {
  onGoHome: () => void
}

export function ChatShell({ onGoHome }: ChatShellProps) {
  const chat = useChat()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isAddContactOpen, setIsAddContactOpen] = useState(false)
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
  
  const [contactToRemove, setContactToRemove] = useState<string | null>(null)
  const [isRemovingContact, setIsRemovingContact] = useState(false)

  const [groupAnchorEl, setGroupAnchorEl] = useState<null | HTMLElement>(null)
  const [groupToDelete, setGroupToDelete] = useState<number | null>(null)
  const [isDeletingGroup, setIsDeletingGroup] = useState(false)

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error'>('success')

  const showToast = (message: string, severity: 'success' | 'error' = 'success') => {
    setToastMessage(message)
    setToastSeverity(severity)
  }

  const handleRemoveContact = async () => {
    if (!contactToRemove) return
    setIsRemovingContact(true)
    try {
      await chat.removeContact(contactToRemove)
      setContactToRemove(null)
      showToast('Contact removed successfully')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove contact', 'error')
    } finally {
      setIsRemovingContact(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return
    setIsDeletingGroup(true)
    try {
      await chat.deleteGroup(groupToDelete)
      setGroupToDelete(null)
      setGroupAnchorEl(null)
      showToast('Group deleted successfully')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Only the group creator can delete this group', 'error')
    } finally {
      setIsDeletingGroup(false)
    }
  }

  const handleCreateGroup = async (name: string, description: string, members: string[]) => {
    try {
      await chat.createGroup(name, description, members)
      showToast(`Group "${name}" created successfully`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create group', 'error')
      throw err
    }
  }

  if (!chat.isAuthenticated || chat.isBootstrapping) {
    return (
      <ChatLoginPage
        status={chat.status}
        isBootstrapping={chat.isBootstrapping}
        errorMessage={chat.errors[0]?.message}
        onSubmit={({ username, password }) => {
          void chat.login(username, password)
        }}
      />
    )
  }

  const conversationTitle =
    chat.activeConversation?.type === 'group'
      ? chat.activeConversation.group.name
      : chat.activeConversation?.contact.displayName || 'Select a conversation'

  const conversationSubtitle =
    chat.activeConversation?.type === 'group'
      ? chat.activeConversation.group.description || chat.activeConversation.group.roomId
      : chat.activeConversation?.contact.id || 'Choose a contact or group from the sidebar'

  return (
    <Box
      component="main"
      sx={{
        height: '100dvh',
        p: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#0b141a',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 1.25,
          borderRadius: 0,
          backgroundColor: '#202c33',
          borderBottom: `1px solid ${alpha('#ffffff', 0.08)}`,
        }}
      >
        <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Tooltip title="View Contacts">
              <IconButton
                color="inherit"
                onClick={() => setIsDrawerOpen(true)}
                sx={{ mr: 1 }}
              >
                <MenuRoundedIcon />
              </IconButton>
            </Tooltip>
            
            <Stack 
              direction="row" 
              spacing={1.5} 
              alignItems="center"
              onClick={() => {
                // Future: Open recipient profile details/drawer
              }}
              sx={{ 
                cursor: 'pointer', 
                p: 0.5, 
                px: 1,
                borderRadius: 2,
                transition: 'background-color 0.2s',
                '&:hover': {
                  bgcolor: alpha('#ffffff', 0.05)
                }
              }}
            >
              <AuthenticatedAvatar 
                relativeUrl={chat.activeConversation?.type === 'direct' ? chat.activeConversation.contact.profilePictureUrl : undefined}
                sx={{ 
                  width: 40, 
                  height: 40, 
                  bgcolor: chat.activeConversation?.type === 'group' ? 'primary.main' : '#6b7c85',
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                }}
              >
                {chat.activeConversation?.type === 'group' ? (
                  <ForumRoundedIcon />
                ) : (
                  (chat.activeConversation?.contact.displayName?.[0] || 'C').toUpperCase()
                )}
              </AuthenticatedAvatar>
              <Box>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography 
                    variant="subtitle1" 
                    sx={{ 
                      fontWeight: 700, 
                      lineHeight: 1.2, 
                      color: '#e9edef',
                      fontSize: '1rem'
                    }}
                  >
                    {conversationTitle}
                  </Typography>
                  {(chat.activeConversation?.type === 'direct' || chat.activeConversation?.type === 'group') && (
                    <Tooltip title="End-to-End Encrypted">
                      <LockRoundedIcon sx={{ fontSize: '0.9rem', color: '#00a884', opacity: 0.8 }} />
                    </Tooltip>
                  )}
                </Stack>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontSize: '0.8rem', 
                    color: chat.activeTypingNames.length > 0 ? '#00a884' : '#8696a0',
                    fontWeight: chat.activeTypingNames.length > 0 ? 600 : 400
                  }}
                >
                  {chat.activeTypingNames.length > 0
                    ? `${chat.activeTypingNames.join(', ')} typing...`
                    : conversationSubtitle}
                </Typography>
              </Box>
            </Stack>
          </Stack>
          
          <Stack direction="row" spacing={1}>
            {chat.activeConversation && (
              <IconButton color="inherit" size="small">
                <SearchRoundedIcon />
              </IconButton>
            )}
            {chat.activeConversation && (
              <IconButton
                color="inherit"
                size="small"
                onClick={(e) => {
                  if (chat.activeConversation?.type === 'group') {
                    setGroupAnchorEl(e.currentTarget)
                  }
                }}
              >
                <MoreVertRoundedIcon />
              </IconButton>
            )}
            
            <Button
              variant="text"
              color="inherit"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={onGoHome}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Home
            </Button>
            <Tooltip title="Logout">
              <IconButton color="inherit" size="small" onClick={chat.logout}>
                <LogoutRoundedIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Profile">
              <IconButton color="inherit" size="small" onClick={() => setIsProfileOpen(true)} sx={{ ml: 1 }}>
                <AuthenticatedAvatar 
                  relativeUrl={chat.currentUser?.profilePictureUrl}
                  sx={{ width: 32, height: 32, bgcolor: '#6b7c85', fontSize: '1rem' }}
                >
                  {chat.currentUser?.displayName?.[0]?.toUpperCase() || 'F'}
                </AuthenticatedAvatar>
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={groupAnchorEl}
              open={Boolean(groupAnchorEl)}
              onClose={() => setGroupAnchorEl(null)}
              PaperProps={{
                sx: { bgcolor: '#202c33', color: 'text.primary' }
              }}
            >
              <MenuItem onClick={() => {
                if (chat.activeConversation?.type === 'group') {
                  setGroupToDelete(chat.activeConversation.group.id)
                }
                setGroupAnchorEl(null)
              }}>
                <Typography color="error">Delete Group</Typography>
              </MenuItem>
            </Menu>
          </Stack>
        </Stack>
      </Paper>

      {/* Main Content Area */}
      <Box sx={{ minHeight: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {chat.activeConversation ? (
          <MessageList
            title={conversationTitle}
            subtitle={conversationSubtitle}
            messages={chat.activeMessages}
            activeTypingNames={chat.activeTypingNames}
            currentUserId={chat.currentUser?.username ?? ''}
            mediaLibrary={chat.mediaLibrary}
            emptyState="No messages yet. Select a conversation and start chatting."
            showHeader={false}
            onLoadMore={chat.loadMoreHistory}
            isLoadingMore={chat.isLoadingMore}
            hasNextPage={chat.hasNextPage}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              gap: 2,
              opacity: 0.6,
            }}
          >
            <ForumRoundedIcon sx={{ fontSize: 64, color: 'primary.main', opacity: 0.5 }} />
            <Typography variant="h6">Click on Contact to Show chats</Typography>
            <Typography variant="body2" color="text.secondary">
              Select a conversation from the sidebar to start messaging.
            </Typography>
          </Box>
        )}
      </Box>
      {chat.activeConversation && (
        <MessageComposer
          connected={chat.status === 'connected'}
          activeConversation={chat.activeConversation}
          uploading={chat.uploading}
          onSendText={chat.sendTextMessage}
          onSendMedia={chat.sendMediaMessage}
          onTyping={chat.notifyTyping}
        />
      )}

      {/* Overlays / Dialogs */}
      <Drawer
        anchor="left"
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#111b21',
            color: 'text.primary',
            width: { xs: '100%', sm: 380 },
            borderRight: `1px solid ${alpha('#ffffff', 0.04)}`,
          },
        }}
      >
        <Box sx={{ p: 2, bgcolor: '#202c33', display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton color="inherit" onClick={() => setIsDrawerOpen(false)}>
            <ArrowBackRoundedIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1 }}>New chat</Typography>
          <Tooltip title="Create Group">
            <IconButton color="inherit" onClick={() => {
              setIsCreateGroupOpen(true)
            }}>
              <GroupsRoundedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Add Contact">
            <IconButton color="inherit" onClick={() => setIsAddContactOpen(true)}>
              <AddCommentRoundedIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ p: 1.25, overflowY: 'auto' }}>
          <DirectMessagePanel
            contacts={chat.contacts}
            groups={chat.groups}
            activeConversation={chat.activeConversation}
            onSelectConversation={(conversation) => {
              void chat.selectConversation(conversation)
              setIsDrawerOpen(false)
            }}
            onRemoveContact={(username) => setContactToRemove(username)}
          />
        </Box>
      </Drawer>

      <ProfileDrawer 
        open={isProfileOpen} 
        user={chat.currentUser} 
        onClose={() => setIsProfileOpen(false)} 
        onUpdateProfilePicture={chat.updateProfilePicture}
        onUpdateProfile={chat.updateProfile}
        onResetEncryption={chat.resetEncryption}
      />

      <AddContactDialog
        open={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
        onAddContact={async (username: string) => {
          await chat.addContact(username)
          showToast(`Contact ${username} added successfully`)
        }}
      />

      <CreateGroupDialog
        open={isCreateGroupOpen}
        contacts={chat.contacts}
        onClose={() => setIsCreateGroupOpen(false)}
        onCreateGroup={handleCreateGroup}
      />

      <ConfirmationDialog
        open={Boolean(contactToRemove)}
        title="Remove Contact"
        content={`Are you sure you want to remove ${contactToRemove} from your contacts?`}
        confirmText="Remove"
        destructive
        loading={isRemovingContact}
        onClose={() => setContactToRemove(null)}
        onConfirm={handleRemoveContact}
      />

      <ConfirmationDialog
        open={Boolean(groupToDelete)}
        title="Delete Group"
        content="This action cannot be undone. Are you sure you want to delete this group?"
        confirmText="Delete"
        destructive
        loading={isDeletingGroup}
        onClose={() => setGroupToDelete(null)}
        onConfirm={handleDeleteGroup}
      />

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={4000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setToastMessage(null)} severity={toastSeverity} variant="filled" sx={{ width: '100%' }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  )
}
