// components/ops-dashboard-web/src/theme/muiTheme.ts
// Uses Client Portal light theme: crisp white surfaces, bgLight canvas, brand teal accents
import { createTheme } from '@mui/material/styles';
import { tokens } from '@scatterid/design-tokens';

export const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: tokens.color.brand500,
      light: tokens.color.brand300,
      dark: tokens.color.brand700,
      contrastText: tokens.color.white,
    },
    secondary: {
      main: tokens.color.rootTier,
      light: tokens.color.purpleLight,
      contrastText: tokens.color.white,
    },
    background: {
      default: tokens.color.bgLight,
      paper: tokens.color.white,
    },
    text: {
      primary: tokens.color.slate800,
      secondary: tokens.color.slate500,
    },
    success: {
      main: tokens.color.approve,
      contrastText: tokens.color.white,
    },
    error: {
      main: tokens.color.reject,
      contrastText: tokens.color.white,
    },
    warning: {
      main: tokens.color.flag,
      contrastText: tokens.color.white,
    },
    info: {
      main: tokens.color.cyanMid,
      contrastText: tokens.color.white,
    },
    divider: tokens.color.borderLight,
  },
  typography: {
    fontFamily: tokens.font.sans,
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.color.white,
          backgroundImage: 'none',
          borderColor: tokens.color.borderLight,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.color.white,
          borderColor: tokens.color.borderLight,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.color.white,
          color: tokens.color.slate800,
          borderColor: tokens.color.borderLight,
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.color.white,
          borderColor: tokens.color.borderLight,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: tokens.color.borderLight,
          color: tokens.color.slate800,
        },
        head: {
          backgroundColor: tokens.color.slate50,
          color: tokens.color.slate700,
          fontWeight: 700,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        contained: {
          color: '#ffffff !important',
          fontWeight: 700,
          textTransform: 'none',
        },
        containedPrimary: {
          color: '#ffffff !important',
          backgroundColor: tokens.color.brand500,
          '&:hover': {
            backgroundColor: tokens.color.brand700,
          },
        },
        containedSecondary: {
          color: '#ffffff !important',
          backgroundColor: tokens.color.rootTier,
          '&:hover': {
            backgroundColor: tokens.color.brand700,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
        },
      },
    },
  },
});
