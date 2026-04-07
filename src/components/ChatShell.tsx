import ForumRoundedIcon from '@mui/icons-material/ForumRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import AddCommentRoundedIcon from '@mui/icons-material/AddCommentRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import { alpha } from '@mui/material/styles'
import {
  Box,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useChat } from '../context/ChatContext'
import { DirectMessagePanel } from './DirectMessagePanel'
import { MessageComposer } from './MessageComposer'
import { MessageList } from './MessageList'
import { AddContactDialog } from './AddContactDialog.tsx'
import { ConfirmationDialog } from './ConfirmationDialog'
import { ProfileDrawer } from './ProfileDrawer'
import { CreateGroupDialog } from './CreateGroupDialog'
import { AuthenticatedAvatar } from './AuthenticatedAvatar'

const SIDEBAR_W = 320

interface ChatShellProps {
  onGoHome: () => void
  onGoLogin: () => void
}

export function ChatShell({ onGoHome, onGoLogin }: ChatShellProps) {
  const chat = useChat()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

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

  /* ── business logic handlers ── */
  const handleRemoveContact = async () => {
    if (!contactToRemove) return
    setIsRemovingContact(true)
    try {
      await chat.removeContact(contactToRemove)
      setContactToRemove(null)
      showToast('Contact removed successfully')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove contact', 'error')
    } finally { setIsRemovingContact(false) }
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
    } finally { setIsDeletingGroup(false) }
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

  /* ── redirect if not authed ── */
  useEffect(() => {
    if (!chat.isAuthenticated && !chat.isBootstrapping && chat.status !== 'connecting') {
      onGoLogin()
    }
  }, [chat.isAuthenticated, chat.isBootstrapping, chat.status, onGoLogin])

  if (!chat.isAuthenticated) return null

  const conversationTitle =
    chat.activeConversation?.type === 'group'
      ? chat.activeConversation.group.name
      : chat.activeConversation?.contact.displayName || 'Select a conversation'

  const conversationSubtitle =
    chat.activeConversation?.type === 'group'
      ? chat.activeConversation.group.description || chat.activeConversation.group.roomId
      : chat.activeConversation?.contact.id || ''

  /* ── Sidebar content (shared between permanent & drawer) ── */
  const sidebarContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#111b21' }}>

      {/* Sidebar header */}
      <Box sx={{
        px: 2, py: 1.5,
        bgcolor: '#1f2c34',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        {/* Current user avatar */}
        <Tooltip title="Your profile">
          <Box onClick={() => setIsProfileOpen(true)} sx={{ cursor: 'pointer', flexShrink: 0 }}>
            <AuthenticatedAvatar
              relativeUrl={chat.currentUser?.profilePictureUrl}
              sx={{ width: 38, height: 38, bgcolor: '#00a884', fontSize: '1rem', fontWeight: 700 }}
            >
              {chat.currentUser?.displayName?.[0]?.toUpperCase() || 'F'}
            </AuthenticatedAvatar>
          </Box>
        </Tooltip>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#e9edef' }}>
            {chat.currentUser?.displayName || chat.currentUser?.username || 'Me'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#00a884', flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: '#8696a0', fontSize: '0.72rem' }}>Online</Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={0.25}>
          <Tooltip title="Create Group">
            <IconButton size="small" color="inherit" onClick={() => setIsCreateGroupOpen(true)} sx={{ color: '#8696a0', '&:hover': { color: '#e9edef', bgcolor: 'rgba(255,255,255,0.06)' } }}>
              <GroupsRoundedIcon sx={{ fontSize: '1.2rem' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Add Contact">
            <IconButton size="small" color="inherit" onClick={() => setIsAddContactOpen(true)} sx={{ color: '#8696a0', '&:hover': { color: '#e9edef', bgcolor: 'rgba(255,255,255,0.06)' } }}>
              <AddCommentRoundedIcon sx={{ fontSize: '1.2rem' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Home">
            <IconButton size="small" color="inherit" onClick={onGoHome} sx={{ color: '#8696a0', '&:hover': { color: '#e9edef', bgcolor: 'rgba(255,255,255,0.06)' } }}>
              <HomeRoundedIcon sx={{ fontSize: '1.2rem' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Logout">
            <IconButton size="small" color="inherit" onClick={chat.logout} sx={{ color: '#8696a0', '&:hover': { color: '#ef5350', bgcolor: 'rgba(244,67,54,0.1)' } }}>
              <LogoutRoundedIcon sx={{ fontSize: '1.2rem' }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Conversation list */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DirectMessagePanel
          contacts={chat.contacts}
          groups={chat.groups}
          activeConversation={chat.activeConversation}
          onSelectConversation={conversation => {
            void chat.selectConversation(conversation)
            if (isMobile) setIsDrawerOpen(false)
          }}
          onRemoveContact={username => setContactToRemove(username)}
        />
      </Box>
    </Box>
  )

  return (
    <Box
      component="main"
      sx={{
        height: '100dvh',
        display: 'flex',
        bgcolor: '#0b141a',
        overflow: 'hidden',
      }}
    >
      {/* ── Persistent sidebar (desktop) ── */}
      {!isMobile && (
        <Box sx={{
          width: SIDEBAR_W,
          flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}>
          {sidebarContent}
        </Box>
      )}

      {/* ── Drawer sidebar (mobile) ── */}
      {isMobile && (
        <Drawer
          anchor="left"
          open={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          PaperProps={{ sx: { width: '85vw', maxWidth: SIDEBAR_W, bgcolor: '#111b21', color: 'text.primary' } }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* ── Main chat column ── */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── Top header bar ── */}
        <Box sx={{
          height: 60,
          display: 'flex', alignItems: 'center',
          px: 1.5,
          gap: 1,
          bgcolor: '#1f2c34',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          {/* Hamburger on mobile */}
          {isMobile && (
            <IconButton size="small" color="inherit" onClick={() => setIsDrawerOpen(true)} sx={{ mr: 0.5 }}>
              <MenuRoundedIcon />
            </IconButton>
          )}

          {chat.activeConversation ? (
            <>
              {/* Conversation avatar */}
              {chat.activeConversation.type === 'direct' ? (
                <AuthenticatedAvatar
                  relativeUrl={chat.activeConversation.contact.profilePictureUrl}
                  alt={chat.activeConversation.contact.displayName}
                  sx={{
                    width: 40, height: 40, flexShrink: 0,
                    bgcolor: '#00a884', fontSize: '1rem', fontWeight: 700,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                  }}
                >
                  {(chat.activeConversation.contact.displayName?.[0] || 'C').toUpperCase()}
                </AuthenticatedAvatar>
              ) : (
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#005c4b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                  <ForumRoundedIcon sx={{ fontSize: '1.3rem', color: '#e9edef' }} />
                </Box>
              )}

              {/* Name + subtitle */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700, color: '#e9edef', fontSize: '0.95rem', lineHeight: 1.2 }}>
                    {conversationTitle}
                  </Typography>
                  <Tooltip title="End-to-End Encrypted">
                    <LockRoundedIcon sx={{ fontSize: '0.8rem', color: '#00a884', opacity: 0.8, flexShrink: 0 }} />
                  </Tooltip>
                </Stack>
                <Typography variant="caption" sx={{
                  fontSize: '0.75rem',
                  color: chat.activeTypingNames.length > 0 ? '#00a884' : '#8696a0',
                  fontWeight: chat.activeTypingNames.length > 0 ? 600 : 400,
                }}>
                  {chat.activeTypingNames.length > 0
                    ? `${chat.activeTypingNames.join(', ')} typing…`
                    : conversationSubtitle || 'No messages yet'}
                </Typography>
              </Box>
            </>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
              <Typography variant="subtitle1" sx={{ color: '#8696a0', fontSize: '0.9rem' }}>
                ✈️ FlyChat
              </Typography>
              <Box sx={{
                height: '18px', width: '1px', bgcolor: 'rgba(255,255,255,0.12)', mx: 0.5,
              }} />
              <Typography variant="caption" sx={{ color: '#8696a0', fontSize: '0.78rem' }}>
                Select a conversation
              </Typography>
            </Box>
          )}

          {/* Right actions */}
          <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
            {chat.activeConversation && (
              <Tooltip title="Search">
                <IconButton size="small" sx={{ color: '#8696a0', '&:hover': { color: '#e9edef', bgcolor: 'rgba(255,255,255,0.06)' } }}>
                  <SearchRoundedIcon sx={{ fontSize: '1.2rem' }} />
                </IconButton>
              </Tooltip>
            )}
            {chat.activeConversation?.type === 'group' && (
              <Tooltip title="Group options">
                <IconButton
                  size="small"
                  sx={{ color: '#8696a0', '&:hover': { color: '#e9edef', bgcolor: 'rgba(255,255,255,0.06)' } }}
                  onClick={e => setGroupAnchorEl(e.currentTarget)}
                >
                  <MoreVertRoundedIcon sx={{ fontSize: '1.2rem' }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          <Menu
            anchorEl={groupAnchorEl}
            open={Boolean(groupAnchorEl)}
            onClose={() => setGroupAnchorEl(null)}
            PaperProps={{ sx: { bgcolor: '#233138', color: 'text.primary', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' } }}
          >
            <MenuItem onClick={() => {
              if (chat.activeConversation?.type === 'group') {
                setGroupToDelete(chat.activeConversation.group.id)
              }
              setGroupAnchorEl(null)
            }}>
              <Typography color="error" variant="body2">Delete Group</Typography>
            </MenuItem>
          </Menu>
        </Box>

        {/* ── Message area ── */}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {chat.activeConversation ? (
            <MessageList
              title={conversationTitle}
              subtitle={conversationSubtitle}
              messages={chat.activeMessages}
              activeTypingNames={chat.activeTypingNames}
              currentUserId={chat.currentUser?.username ?? ''}
              mediaLibrary={chat.mediaLibrary}
              emptyState="No messages yet. Say hello!"
              showHeader={false}
              onLoadMore={chat.loadMoreHistory}
              isLoadingMore={chat.isLoadingMore}
              hasNextPage={chat.hasNextPage}
            />
          ) : (
            /* Empty state */
            <Box sx={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              bgcolor: '#0b141a',
              backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(0,168,132,0.06), transparent 60%)',
            }}>
              <Box sx={{
                width: 80, height: 80, borderRadius: '50%',
                bgcolor: 'rgba(0,168,132,0.1)',
                border: '2px solid rgba(0,168,132,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ForumRoundedIcon sx={{ fontSize: 40, color: '#00a884', opacity: 0.6 }} />
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ color: '#8696a0', fontWeight: 600, mb: 0.5 }}>
                  Open a conversation
                </Typography>
                <Typography variant="body2" sx={{ color: alpha('#8696a0', 0.7), fontSize: '0.85rem' }}>
                  {isMobile
                    ? 'Tap ☰ to pick a contact or group'
                    : 'Choose a contact or group from the sidebar'}
                </Typography>
              </Box>

              {/* E2EE badge */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                px: 2, py: 0.75,
                bgcolor: 'rgba(0,168,132,0.08)',
                border: '1px solid rgba(0,168,132,0.18)',
                borderRadius: '20px',
              }}>
                <LockRoundedIcon sx={{ fontSize: '0.9rem', color: '#00a884' }} />
                <Typography variant="caption" sx={{ color: '#00a884', fontWeight: 600, fontSize: '0.75rem' }}>
                  All messages are end-to-end encrypted
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* ── Composer ── */}
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
      </Box>

      {/* ── Overlays ── */}
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
        <Alert onClose={() => setToastMessage(null)} severity={toastSeverity} variant="filled" sx={{ width: '100%', borderRadius: '12px' }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  )
}
