import { Box, Paper } from '@mui/material'
import { keyframes } from '@mui/material/styles'

const jump = keyframes`
  0%, 80%, 100% { 
    transform: translateY(0px);
    opacity: 0.6;
  }
  40% { 
    transform: translateY(-5px);
    opacity: 1;
  }
`

// const slide = keyframes`
// 0%, 80%, 100% { 
//     transform: translateX(5px);
//     opacity: 1;
//   }
//   40% { 
//     transform: translateX(-5px);
//     opacity: 0.6;
//   }
// `

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
  isGroup?: boolean
}

export function TypingIndicator({ names, isGroup = false }: TypingIndicatorProps) {
  if (names.length === 0) return null

  let summary = 'typing…'
  if (isGroup) {
    summary = names.length === 1
      ? `${names[0]} is typing…`
      : 'Several people are typing…'
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignSelf: 'flex-start',
        width: 'fit-content',
        animation: `${slideFadeIn} 0.3s ease-out forwards`,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          py: 0.75,
          px: 1.5,
          borderRadius: '16px',
          borderBottomLeftRadius: '4px',
          bgcolor: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                bgcolor: '#00a884',
                animation: `${jump} 1.2s infinite ease-in-out`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </Box>
      </Paper>
    </Box>
  )
}
