import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Box,
  Chip,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { ChatContact } from '../types/chat'

interface CreateGroupDialogProps {
  open: boolean
  contacts: ChatContact[]
  onClose: () => void
  onCreateGroup: (name: string, description: string, members: string[]) => Promise<void>
}

export function CreateGroupDialog({
  open,
  contacts,
  onClose,
  onCreateGroup,
}: CreateGroupDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    if (loading) return
    setName('')
    setDescription('')
    setSelectedMembers([])
    setError(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Group name is required.')
      return
    }

    if (selectedMembers.length === 0) {
      setError('Select at least one member.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      await onCreateGroup(trimmedName, description.trim(), selectedMembers)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit,
        sx: {
          bgcolor: '#202c33',
          color: 'text.primary',
          borderRadius: 3,
          border: `1px solid ${alpha('#ffffff', 0.08)}`,
        },
      }}
    >
      <DialogTitle>Create New Group</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          <TextField
            autoFocus
            label="Group Name"
            fullWidth
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            sx={textFieldStyles}
          />

          <TextField
            label="Description (Optional)"
            fullWidth
            multiline
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            sx={textFieldStyles}
          />

          <FormControl fullWidth sx={selectStyles}>
            <InputLabel id="members-selection-label">Select Members</InputLabel>
            <Select
              labelId="members-selection-label"
              multiple
              value={selectedMembers}
              onChange={(e) => setSelectedMembers(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              input={<OutlinedInput label="Select Members" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip
                      key={value}
                      label={contacts.find((c) => c.id === value)?.displayName || value}
                      size="small"
                      sx={{ bgcolor: 'primary.main', color: 'white' }}
                    />
                  ))}
                </Box>
              )}
              disabled={loading}
              MenuProps={MenuProps}
            >
              {contacts.map((contact) => (
                <MenuItem key={contact.id} value={contact.id}>
                  <Checkbox checked={selectedMembers.indexOf(contact.id) > -1} />
                  <ListItemText primary={contact.displayName} secondary={contact.id} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        {error && (
          <Box sx={{ color: 'error.main', mt: 2, fontSize: '0.875rem' }}>{error}</Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={handleClose} color="inherit" disabled={loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          Create Group
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const textFieldStyles = {
  '& .MuiOutlinedInput-root': {
    color: 'text.primary',
    '& fieldset': { borderColor: alpha('#ffffff', 0.2) },
    '&:hover fieldset': { borderColor: alpha('#ffffff', 0.3) },
  },
  '& .MuiInputLabel-root': { color: 'text.secondary' },
}

const selectStyles = {
  '& .MuiOutlinedInput-root': {
    color: 'text.primary',
    '& fieldset': { borderColor: alpha('#ffffff', 0.2) },
    '&:hover fieldset': { borderColor: alpha('#ffffff', 0.3) },
  },
  '& .MuiInputLabel-root': { color: 'text.secondary' },
}

const MenuProps = {
  PaperProps: {
    sx: {
      bgcolor: '#202c33',
      color: 'text.primary',
      maxHeight: 300,
    },
  },
}
