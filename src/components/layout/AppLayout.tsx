'use client'

import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import TopBar from './TopBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <TopBar />
      <Toolbar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          overflow: 'auto',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
