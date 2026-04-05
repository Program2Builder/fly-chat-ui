import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  alpha,
} from '@mui/material'

interface ConfirmationDialogProps {
  open: boolean
  title: string
  content: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  loading?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmationDialog({
  open,
  title,
  content,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  loading = false,
  onClose,
  onConfirm,
}: ConfirmationDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      PaperProps={{
        sx: {
          bgcolor: '#202c33',
          color: 'text.primary',
          borderRadius: 3,
          minWidth: 320,
          border: `1px solid ${alpha('#ffffff', 0.08)}`,
        },
      }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: 'text.secondary' }}>
          {content}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
