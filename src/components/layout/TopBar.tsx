'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import SettingsIcon from '@mui/icons-material/Settings'

const NAV = [
  { label: 'Gastos', href: '/gastos', icon: <ReceiptLongIcon fontSize="small" /> },
  { label: 'Configuración', href: '/configuracion', icon: <SettingsIcon fontSize="small" /> },
]

export default function TopBar() {
  const pathname = usePathname()

  return (
    <AppBar position="fixed" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Toolbar sx={{ gap: 2 }}>
        <AccountBalanceWalletIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ mr: 3 }}>
          GastosApp
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Button
                key={item.href}
                component={Link}
                href={item.href}
                startIcon={item.icon}
                variant={active ? 'contained' : 'text'}
                color="primary"
                sx={{
                  borderRadius: 2,
                  fontWeight: active ? 600 : 400,
                  textTransform: 'none',
                  fontSize: 14,
                }}
              >
                {item.label}
              </Button>
            )
          })}
        </Box>
      </Toolbar>
    </AppBar>
  )
}
