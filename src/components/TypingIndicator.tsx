import { Box, Paper, Typography } from '@mui/material'
import { keyframes } from '@mui/material/styles'

const jump = keyframes`
  0%, 80%, 100% { 
    transform: translateY(0);
    opacity: 0.6;
  }
  40% { 
    transform: translateY(-5px);
    opacity: 1;
  }
`

const slideFadeIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`

interface TypingIndicatorProps {
  names: string[]
}

export function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null

  const summary = names.length === 1 
    ? `${names[0]} is typing...` 
    : 'Several people are typing...'

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignSelf: 'flex-start',
        animation: `${slideFadeIn} 0.3s ease-out forwards`,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          px: 2.5,
          py: 1.5,
          borderRadius: '20px',
          borderBottomLeftRadius: '4px',
          bgcolor: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center', mt: 0.5 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: '#00a884',
                animation: `${jump} 1.2s infinite ease-in-out`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </Box>
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'text.secondary', 
            fontWeight: 500,
            letterSpacing: '0.02em' 
          }}
        >
          {summary}
        </Typography>
      </Paper>
    </Box>
  )
}
