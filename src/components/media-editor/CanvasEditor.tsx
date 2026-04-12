import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react'
import { Box } from '@mui/material'
import { useCanvasEditor } from './hooks/useCanvasEditor'
import { Toolbar } from './Toolbar'

interface CanvasEditorProps {
  imageUrl: string
  onClose: () => void
}

export interface CanvasEditorRef {
  exportBlob: () => Promise<Blob>
}

export const CanvasEditor = forwardRef<CanvasEditorRef, CanvasEditorProps>(({ imageUrl, onClose }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const {
    activeTool,
    setTool,
    drawColor,
    drawColors,
    changeDrawColor,
    addText,
    addSticker,
    rotateActiveOrImage,
    activateCrop,
    confirmCrop,
    cancelCrop,
    undo,
    redo,
    deleteSelected,
    exportBlob,
  } = useCanvasEditor(canvasRef, imageUrl)

  useImperativeHandle(ref, () => ({ exportBlob }))

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault()
        redo()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeTool !== 'text') {
        deleteSelected()
      }
      if (e.key === 'Enter' && activeTool === 'crop') {
        confirmCrop()
      }
      if (e.key === 'Escape' && activeTool === 'crop') {
        cancelCrop()
      }
    },
    [undo, redo, deleteSelected, activeTool, confirmCrop, cancelCrop]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Toolbar
        onClose={onClose}
        activeTool={activeTool}
        setTool={setTool}
        addText={addText}
        addSticker={addSticker}
        rotateActiveOrImage={rotateActiveOrImage}
        activateCrop={activateCrop}
        confirmCrop={confirmCrop}
        cancelCrop={cancelCrop}
        undo={undo}
        redo={redo}
        deleteSelected={deleteSelected}
        drawColor={drawColor}
        drawColors={drawColors}
        changeDrawColor={changeDrawColor}
      />
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          bgcolor: '#0b141a',
          p: 2,
          cursor: activeTool === 'draw' ? 'crosshair' : 'default',
        }}
      >
        <canvas ref={canvasRef} style={{ borderRadius: '4px', maxWidth: '100%', maxHeight: '100%' }} />
      </Box>
    </Box>
  )
})

CanvasEditor.displayName = 'CanvasEditor'
