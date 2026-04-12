import React from 'react'
import { Box, IconButton, Tooltip, Button } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CreateRoundedIcon from '@mui/icons-material/CreateRounded'
import TitleRoundedIcon from '@mui/icons-material/TitleRounded'
import EmojiEmotionsRoundedIcon from '@mui/icons-material/EmojiEmotionsRounded'
import RotateRightRoundedIcon from '@mui/icons-material/RotateRightRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import RedoRoundedIcon from '@mui/icons-material/RedoRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import CropRoundedIcon from '@mui/icons-material/CropRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseIcon from '@mui/icons-material/Close'
import type { FabricTool } from './hooks/useCanvasEditor'

interface ToolbarProps {
  onClose: () => void
  activeTool: FabricTool
  setTool: (t: FabricTool) => void
  addText: () => void
  addSticker: () => void
  rotateActiveOrImage: () => void
  undo: () => void
  redo: () => void
  deleteSelected: () => void
  drawColor: string
  drawColors: string[]
  changeDrawColor: (color: string) => void
  activateCrop: () => void
  confirmCrop: () => void
  cancelCrop: () => void
}

export function Toolbar({
  onClose,
  activeTool,
  setTool,
  addText,
  addSticker,
  rotateActiveOrImage,
  undo,
  redo,
  deleteSelected,
  drawColor,
  drawColors,
  changeDrawColor,
  activateCrop,
  confirmCrop,
  cancelCrop,
}: ToolbarProps) {
  const isCropping = activeTool === 'crop'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', bgcolor: '#111b21' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
        {/* Left: close + undo/redo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isCropping ? (
            // In crop mode show Cancel
            <Tooltip title="Cancel Crop">
              <IconButton onClick={cancelCrop} sx={{ color: '#e9edef' }}>
                <CloseIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <>
              <Tooltip title="Close">
                <IconButton onClick={onClose} sx={{ color: '#e9edef' }}>
                  <CloseRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Undo (Ctrl+Z)">
                <IconButton onClick={undo} sx={{ color: '#8696a0' }}>
                  <UndoRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Redo (Ctrl+Shift+Z)">
                <IconButton onClick={redo} sx={{ color: '#8696a0' }}>
                  <RedoRoundedIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>

        {/* Center: editing tools */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isCropping ? (
            // In crop mode show only Confirm
            <Button
              variant="contained"
              size="small"
              startIcon={<CheckRoundedIcon />}
              onClick={confirmCrop}
              sx={{
                bgcolor: '#00a884',
                color: '#fff',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '20px',
                px: 2.5,
                '&:hover': { bgcolor: '#008f6f' },
              }}
            >
              Confirm Crop
            </Button>
          ) : (
            <>
              {/* Crop */}
              <Tooltip title="Crop">
                <IconButton
                  onClick={activateCrop}
                  sx={{
                    color: '#e9edef',
                    borderRadius: '50%',
                    transition: 'all 0.15s',
                  }}
                >
                  <CropRoundedIcon />
                </IconButton>
              </Tooltip>
              {/* Draw */}
              <Tooltip title="Draw">
                <IconButton
                  onClick={() => setTool(activeTool === 'draw' ? 'none' : 'draw')}
                  sx={{
                    color: activeTool === 'draw' ? '#00a884' : '#e9edef',
                    bgcolor: activeTool === 'draw' ? 'rgba(0,168,132,0.12)' : 'transparent',
                    borderRadius: '50%',
                    transition: 'all 0.15s',
                  }}
                >
                  <CreateRoundedIcon />
                </IconButton>
              </Tooltip>
              {/* Text */}
              <Tooltip title="Add Text">
                <IconButton
                  onClick={addText}
                  sx={{
                    color: activeTool === 'text' ? '#00a884' : '#e9edef',
                    bgcolor: activeTool === 'text' ? 'rgba(0,168,132,0.12)' : 'transparent',
                    borderRadius: '50%',
                    transition: 'all 0.15s',
                  }}
                >
                  <TitleRoundedIcon />
                </IconButton>
              </Tooltip>
              {/* Sticker */}
              <Tooltip title="Add Sticker">
                <IconButton
                  onClick={addSticker}
                  sx={{
                    color: activeTool === 'sticker' ? '#00a884' : '#e9edef',
                    bgcolor: activeTool === 'sticker' ? 'rgba(0,168,132,0.12)' : 'transparent',
                    borderRadius: '50%',
                    transition: 'all 0.15s',
                  }}
                >
                  <EmojiEmotionsRoundedIcon />
                </IconButton>
              </Tooltip>
              {/* Rotate */}
              <Tooltip title="Rotate Selected">
                <IconButton onClick={rotateActiveOrImage} sx={{ color: '#e9edef' }}>
                  <RotateRightRoundedIcon />
                </IconButton>
              </Tooltip>
              {/* Delete */}
              <Tooltip title="Delete Selected">
                <IconButton onClick={deleteSelected} sx={{ color: '#e9edef', '&:hover': { color: '#ef5350' } }}>
                  <DeleteRoundedIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>

        {/* Right: spacer */}
        <Box sx={{ width: isCropping ? 48 : 120 }} />
      </Box>

      {/* Draw color swatches */}
      {activeTool === 'draw' && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 1.5,
            pb: 1.5,
            animation: 'fadeIn 0.15s ease',
            '@keyframes fadeIn': {
              from: { opacity: 0, transform: 'translateY(-6px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          {drawColors.map((c) => (
            <Box
              key={c}
              onClick={() => changeDrawColor(c)}
              sx={{
                width: drawColor === c ? 28 : 22,
                height: drawColor === c ? 28 : 22,
                borderRadius: '50%',
                bgcolor: c,
                cursor: 'pointer',
                border: drawColor === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.25)',
                transition: 'all 0.15s ease',
                boxShadow: drawColor === c ? '0 0 0 2px #00a884' : 'none',
              }}
            />
          ))}
        </Box>
      )}

      {/* Crop hint */}
      {isCropping && (
        <Box sx={{ textAlign: 'center', pb: 1 }}>
          <Box
            component="span"
            sx={{ color: '#8696a0', fontSize: '0.75rem' }}
          >
            Drag to move · Drag corners to resize · Press Confirm to apply
          </Box>
        </Box>
      )}
    </Box>
  )
}
