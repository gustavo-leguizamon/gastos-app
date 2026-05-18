'use client'

import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import { usePathname } from 'next/navigation'
import TopBar from './TopBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === '/login') return <>{children}</>

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <TopBar />
      <Toolbar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 3 },
          overflow: 'auto',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
