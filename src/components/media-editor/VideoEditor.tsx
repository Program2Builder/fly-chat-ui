import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react'
import { Box, Typography, Slider, IconButton } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { useVideoTrim } from './hooks/useVideoTrim'
import { formatTime } from './utils/videoUtils'

interface VideoEditorProps {
  videoUrl: string
  onClose: () => void
}

export interface VideoEditorRef {
  exportMetadata: () => { startTime: number; endTime: number }
}

export const VideoEditor = forwardRef<VideoEditorRef, VideoEditorProps>(({ videoUrl, onClose }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const { startTime, endTime, setStartTime, setEndTime } = useVideoTrim(duration)

  useImperativeHandle(ref, () => ({
    exportMetadata: () => ({ startTime, endTime }),
  }))

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const d = videoRef.current.duration
      setDuration(d)
      setEndTime(d)
    }
  }

  const handleSliderChange = (_: Event, newVal: number | number[]) => {
    if (!Array.isArray(newVal)) return
    setStartTime(newVal[0])
    setEndTime(newVal[1])
    if (videoRef.current) {
      videoRef.current.currentTime = newVal[0]
    }
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: '#0b141a' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 1.5, bgcolor: '#111b21' }}>
        <IconButton onClick={onClose} sx={{ color: '#e9edef' }}>
          <CloseRoundedIcon />
        </IconButton>
        <Typography sx={{ color: '#e9edef', ml: 1, fontWeight: 500, fontSize: '1rem' }}>
          Trim Video
        </Typography>
      </Box>

      {/* Video preview */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            borderRadius: '10px',
            objectFit: 'contain',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        />
      </Box>

      {/* Trim controls */}
      {duration > 0 && (
        <Box
          sx={{
            px: 4,
            pb: 2,
            pt: 1,
            bgcolor: '#111b21',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ color: '#8696a0', fontSize: '0.78rem' }}>
              {formatTime(startTime)}
            </Typography>
            <Typography sx={{ color: '#e9edef', fontSize: '0.82rem', fontWeight: 500 }}>
              Trim Selection · {formatTime(endTime - startTime)}
            </Typography>
            <Typography sx={{ color: '#8696a0', fontSize: '0.78rem' }}>
              {formatTime(endTime)}
            </Typography>
          </Box>
          <Slider
            value={[startTime, endTime]}
            min={0}
            max={duration}
            step={0.1}
            onChange={handleSliderChange}
            sx={{
              color: '#00a884',
              '& .MuiSlider-thumb': {
                width: 16,
                height: 16,
                '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 0 8px rgba(0,168,132,0.16)' },
              },
              '& .MuiSlider-rail': { opacity: 0.3 },
            }}
          />
          <Typography sx={{ color: '#8696a0', fontSize: '0.75rem', textAlign: 'center', mt: 0.5 }}>
            Total duration: {formatTime(duration)}
          </Typography>
        </Box>
      )}
    </Box>
  )
})

VideoEditor.displayName = 'VideoEditor'
