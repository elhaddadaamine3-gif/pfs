import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import './index.css'
import App from './App.tsx'
import './i18n.ts'

const theme = createTheme({
  palette: {
    background: {
      default: '#EAEFEF',
      paper: '#FFFFFF',
    },
    primary: {
      main: '#25343F',
      contrastText: '#EAEFEF',
    },
    secondary: {
      main: '#FF9B51',
      contrastText: '#25343F',
    },
    text: {
      primary: '#25343F',
      secondary: '#4A5A66',
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
