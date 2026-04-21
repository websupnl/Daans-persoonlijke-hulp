'use client'

import { createTheme, alpha } from '@mui/material/styles'
import type {} from '@mui/x-data-grid/themeAugmentation'

export const brandGradient = 'linear-gradient(to right, #A8CECF, #E6AE8C)'
export const brandGradientFallback = '#E6AE8C'
export const brandStart = '#A8CECF'
export const brandEnd = '#E6AE8C'
export const brandPrimary = '#5F9FA1'

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: brandPrimary,
      light: '#eef8f8',
      dark: '#3f7f82',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#c98258',
      light: '#fff4ed',
      dark: '#ad6f48',
      contrastText: '#ffffff',
    },
    success: {
      main: '#10b981',
      light: '#ecfdf5',
      dark: '#047857',
    },
    warning: {
      main: '#f59e0b',
      light: '#fffbeb',
      dark: '#b45309',
    },
    error: {
      main: '#ef4444',
      light: '#fef2f2',
      dark: '#b91c1c',
    },
    info: {
      main: '#3b82f6',
      light: '#eff6ff',
      dark: '#1d4ed8',
    },
    background: {
      default: '#f7f7f8',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f0f10',
      secondary: '#62626e',
      disabled: '#9898a6',
    },
    divider: '#ebebef',
  },
  shape: {
    borderRadius: 4,
  },
  spacing: 8,
  typography: {
    fontFamily: 'Manrope, system-ui, sans-serif',
    h1: { fontSize: 30, lineHeight: '38px', letterSpacing: '-0.03em', fontWeight: 800 },
    h2: { fontSize: 24, lineHeight: '32px', letterSpacing: '-0.025em', fontWeight: 750 },
    h3: { fontSize: 20, lineHeight: '28px', letterSpacing: '-0.02em', fontWeight: 700 },
    h4: { fontSize: 17, lineHeight: '26px', letterSpacing: '-0.01em', fontWeight: 700 },
    h5: { fontSize: 15, lineHeight: '24px', fontWeight: 700 },
    h6: { fontSize: 14, lineHeight: '22px', fontWeight: 700 },
    body1: { fontSize: 14, lineHeight: '22px' },
    body2: { fontSize: 13, lineHeight: '20px', letterSpacing: '0.01em' },
    button: { textTransform: 'none', fontWeight: 700 },
    caption: { fontSize: 11, lineHeight: '16px', letterSpacing: '0.04em' },
    overline: { fontSize: 10, lineHeight: '14px', letterSpacing: '0.12em', fontWeight: 800 },
  },
  shadows: [
    'none',
    '0 1px 2px rgba(0,0,0,0.05)',
    '0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
    '0 12px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06)',
    ...Array(20).fill('0 12px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06)'),
  ] as any,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f7f7f8',
          color: '#0f0f10',
        },
        ':root': {
          '--bg-app': '#f7f7f8',
          '--surface': '#ffffff',
          '--surface-inset': '#f4f4f5',
          '--surface-hover': '#f9f9fa',
          '--surface-container-lowest': '#ffffff',
          '--surface-container-low': '#f9f9fa',
          '--surface-container': '#f3f3f5',
          '--surface-container-high': '#ebebef',
          '--surface-container-highest': '#e2e2e9',
          '--border': '#ebebef',
          '--border-strong': '#d8d8df',
          '--text-primary': '#0f0f10',
          '--text-secondary': '#62626e',
          '--text-tertiary': '#9898a6',
          '--brand-start': brandStart,
          '--brand-end': brandEnd,
          '--brand-primary': brandPrimary,
          '--brand-gradient-fallback': brandGradientFallback,
          '--brand-gradient-webkit': '-webkit-linear-gradient(to right, #A8CECF, #E6AE8C)',
          '--brand-gradient': brandGradient,
          '--brand-gradient-soft': 'linear-gradient(135deg, rgba(168, 206, 207, 0.2), rgba(230, 174, 140, 0.18))',
        },
        '*:focus-visible': {
          outline: `3px solid ${alpha(brandPrimary, 0.35)}`,
          outlineOffset: 2,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 36,
          borderRadius: 4,
          paddingInline: theme.spacing(2),
          boxShadow: 'none',
          letterSpacing: 0,
        }),
        containedPrimary: {
          background: brandGradientFallback,
          backgroundImage: brandGradient,
          color: '#ffffff',
          '&:hover': {
            background: brandGradientFallback,
            backgroundImage: brandGradient,
            filter: 'saturate(1.05) brightness(0.98)',
          },
        },
        outlined: ({ theme }) => ({
          borderColor: theme.palette.divider,
          color: theme.palette.text.primary,
          backgroundColor: theme.palette.background.paper,
          '&:hover': {
            borderColor: theme.palette.divider,
            backgroundColor: '#f9f9fa',
          },
        }),
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          borderColor: theme.palette.divider,
          backgroundImage: 'none',
          borderRadius: 4,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }),
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 4,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }),
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
        variant: 'outlined',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 4,
          backgroundColor: theme.palette.background.paper,
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.primary.main,
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}`,
          },
        }),
        notchedOutline: ({ theme }) => ({
          borderColor: theme.palette.divider,
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 700,
        },
        filledPrimary: {
          background: brandGradientFallback,
          backgroundImage: brandGradient,
          color: '#ffffff',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          backgroundColor: alpha(brandPrimary, 0.16),
        },
        bar: {
          background: brandGradientFallback,
          backgroundImage: brandGradient,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: ({ theme }) => ({
          color: theme.palette.text.secondary,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          backgroundColor: '#fafafb',
          borderBottomColor: theme.palette.divider,
        }),
        body: ({ theme }) => ({
          borderBottomColor: theme.palette.divider,
        }),
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderColor: theme.palette.divider,
          backgroundColor: theme.palette.background.paper,
          borderRadius: 4,
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#fafafb',
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.palette.text.secondary,
          },
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 6,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderColor: theme.palette.divider,
          backgroundImage: 'none',
          borderRadius: 0,
        }),
      },
    },
  },
})
