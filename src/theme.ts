import { alpha, createTheme } from '@mui/material/styles'

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#00a884',
      dark: '#008069',
      light: '#25d366',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#111b21',
    },
    background: {
      default: '#0b141a',
      paper: '#111b21',
    },
    text: {
      primary: '#e9edef',
      secondary: '#8696a0',
    },
    divider: alpha('#ffffff', 0.045),
    success: {
      main: '#25d366',
    },
    error: {
      main: '#f15c6d',
    },
    warning: {
      main: '#ffb84d',
    },
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.04em',
    },
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    h3: {
      fontWeight: 700,
    },
    subtitle1: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0b141a',
          backgroundImage:
            'radial-gradient(circle at top left, rgba(0,168,132,0.16), transparent 30%), radial-gradient(circle at bottom right, rgba(37,211,102,0.1), transparent 28%)',
        },
        '#root': {
          minHeight: '100vh',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.03),
          '& fieldset': {
            borderColor: alpha('#ffffff', 0.06),
          },
          '&:hover fieldset': {
            borderColor: alpha('#ffffff', 0.1),
          },
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 14,
          paddingInline: 16,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
})
