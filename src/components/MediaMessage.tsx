import { useMemo, useState, useRef } from 'react'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded'
import { Box, Stack, Typography, CircularProgress, Divider } from '@mui/material'
import type { MediaUploadResponse } from '../types/chat'
import { getMediaUrl, isImageContentType, isVideoContentType, formatBytes } from '../utils/media'
import { useAuthenticatedImage } from '../hooks/useAuthenticatedImage'
import { useChat } from '../context/ChatContext'
import { ImageViewer } from './ImageViewer'

interface MediaMessageProps {
  mediaId: string
  uploadedMedia?: MediaUploadResponse
}

export function MediaMessage({ mediaId, uploadedMedia }: MediaMessageProps) {
  const { token } = useChat()
  const [mediaErrored, setMediaErrored] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  const href = useMemo(() => getMediaUrl(mediaId, uploadedMedia), [mediaId, uploadedMedia])
  
  const isImage = isImageContentType(uploadedMedia?.contentType)
  const isVideo = isVideoContentType(uploadedMedia?.contentType)
  const isPdf = uploadedMedia?.contentType === 'application/pdf'
  
  const canPreviewVisual = (isImage || isVideo) && !mediaErrored
  const { src: authSrc, loading } = useAuthenticatedImage(
    canPreviewVisual ? href : null, 
    token
  )

  const handleVideoClick = () => {
    if (!videoRef.current) return
    if (isVideoPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
  }

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const response = await fetch(href, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error('Download failed')
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = uploadedMedia?.storedFilename || mediaId || 'download'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Error downloading file:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <>
      <Stack spacing={0.5}>
        {canPreviewVisual ? (
          isImage ? (
            <Box 
              sx={{ position: 'relative', width: 'min(320px, 100%)', cursor: 'zoom-in', borderRadius: 1.5, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.05)' }}
              onClick={() => setViewerOpen(true)}
            >
              <Box
                component="img"
                src={authSrc}
                alt={uploadedMedia?.storedFilename || mediaId}
                onError={() => setMediaErrored(true)}
                sx={{
                  width: '100%',
                  display: 'block',
                  visibility: loading ? 'hidden' : 'visible',
                  minHeight: loading ? 100 : 'auto',
                }}
              />
              {loading && (
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                  <CircularProgress size={24} color="inherit" />
                </Box>
              )}
            </Box>
          ) : (
            <Box 
              sx={{ position: 'relative', width: 'min(320px, 100%)', borderRadius: 1.5, overflow: 'hidden', bgcolor: '#000', cursor: 'pointer' }}
              onClick={handleVideoClick}
            >
              <Box
                component="video"
                ref={videoRef}
                src={authSrc}
                controls={isVideoPlaying}
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                onError={() => setMediaErrored(true)}
                sx={{
                  width: '100%',
                  display: 'block',
                  visibility: loading ? 'hidden' : 'visible',
                  minHeight: loading ? 100 : 'auto',
                }}
              />
              {(!loading && !isVideoPlaying) && (
                <>
                  <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '50%', p: 1.5, display: 'flex' }}>
                    <PlayArrowRoundedIcon sx={{ color: '#fff', fontSize: 32 }} />
                  </Box>
                  <Box sx={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <VideocamRoundedIcon sx={{ color: '#fff', fontSize: 16 }} />
                    <Typography sx={{ color: '#fff', fontSize: '0.65rem', fontWeight: 600 }}>{formatBytes(uploadedMedia?.size)}</Typography>
                  </Box>
                </>
              )}
              {loading && (
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                  <CircularProgress size={24} color="inherit" />
                </Box>
              )}
            </Box>
          )
        ) : (
          <Box sx={{ width: 'min(300px, 100%)', bgcolor: 'rgba(0,0,0,0.15)', borderRadius: 1.5, overflow: 'hidden' }}>
            {isPdf && (
              <Box sx={{ height: 100, bgcolor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PictureAsPdfRoundedIcon sx={{ fontSize: 56, color: '#e53935', opacity: 0.9 }} />
              </Box>
            )}
            <Box sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center' }}>
              {!isPdf && (
                 <Box sx={{ p: 1, bgcolor: '#e53935', borderRadius: 1, display: 'flex' }}>
                   <InsertDriveFileRoundedIcon sx={{ color: '#fff' }} />
                 </Box>
              )}
              {isPdf && (
                 <Box sx={{ p: 0.75, bgcolor: '#e53935', borderRadius: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                   <Typography sx={{ color: '#fff', fontSize: '0.6rem', fontWeight: 800, lineHeight: 1 }}>PDF</Typography>
                 </Box>
              )}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography noWrap variant="body2" sx={{ fontWeight: 600, color: 'inherit' }}>
                  {uploadedMedia?.storedFilename || mediaId}
                </Typography>
                {uploadedMedia && (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
                    {isPdf ? 'PDF' : 'File'} • {formatBytes(uploadedMedia.size)}
                  </Typography>
                )}
              </Box>
            </Box>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
            <Box 
              sx={{ p: 1.25, textAlign: 'center', cursor: isDownloading ? 'wait' : 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
              onClick={handleDownload}
            >
              <Typography sx={{ color: '#00a884', fontSize: '0.85rem', fontWeight: 600 }}>
                {isDownloading ? 'Downloading...' : 'Download'}
              </Typography>
            </Box>
          </Box>
        )}
      </Stack>

      {(isImage && canPreviewVisual) && (
        <ImageViewer
          open={viewerOpen}
          imageUrl={href}
          onClose={() => setViewerOpen(false)}
          alt={uploadedMedia?.storedFilename || mediaId}
        />
      )}
    </>
  )
}
