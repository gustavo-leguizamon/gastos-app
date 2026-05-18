'use client'

import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { SessionProvider } from 'next-auth/react'
import { theme } from '@/lib/theme'
import { Toaster } from 'react-hot-toast'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
          },
        }}
      />
    </ThemeProvider>
    </SessionProvider>
  )
}
