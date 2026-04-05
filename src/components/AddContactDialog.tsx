import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  CircularProgress,
} from '@mui/material'
import { alpha } from '@mui/material/styles'

interface AddContactDialogProps {
  open: boolean
  onClose: () => void
  onAddContact: (username: string) => Promise<void>
}

export function AddContactDialog({ open, onClose, onAddContact }: AddContactDialogProps) {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    if (loading) return
    setUsername('')
    setError(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmed = username.trim()
    if (!trimmed) {
      setError('Username cannot be empty.')
      return
    }

    setError(null)
    setLoading(true)
    
    try {
      await onAddContact(trimmed)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contact.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit,
        sx: {
          bgcolor: '#202c33',
          color: 'text.primary',
          borderRadius: 3,
          minWidth: 320,
          border: `1px solid ${alpha('#ffffff', 0.08)}`,
        },
      }}
    >
      <DialogTitle>Add Contact</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: 'text.secondary', mb: 2 }}>
          Enter the exact username of the person you want to add.
        </DialogContentText>
        <TextField
          autoFocus
          margin="dense"
          label="Username"
          type="text"
          fullWidth
          variant="outlined"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={!!error}
          helperText={error}
          disabled={loading}
          InputLabelProps={{
            sx: { color: 'text.secondary' }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: 'text.primary',
              '& fieldset': {
                borderColor: alpha('#ffffff', 0.2),
              },
              '&:hover fieldset': {
                borderColor: alpha('#ffffff', 0.3),
              },
            },
          }}
        />
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
          Add Contact
        </Button>
      </DialogActions>
    </Dialog>
  )
}
