'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import Tooltip from '@mui/material/Tooltip'
import LogoutIcon from '@mui/icons-material/Logout'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import SettingsIcon from '@mui/icons-material/Settings'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import PaidIcon from '@mui/icons-material/Paid'
import BarChartIcon from '@mui/icons-material/BarChart'

const SUELDOS_ALLOWED_EMAIL = 'gustavoleguizamn@gmail.com'

const NAV = [
  { label: 'Gastos', href: '/gastos', icon: <ReceiptLongIcon fontSize="small" /> },
  { label: 'Reportes', href: '/reportes', icon: <BarChartIcon fontSize="small" /> },
  { label: 'Inversiones', href: '/inversiones', icon: <TrendingUpIcon fontSize="small" /> },
  { label: 'Configuración', href: '/configuracion', icon: <SettingsIcon fontSize="small" /> },
]

const SUELDOS_ITEM = { label: 'Sueldos', href: '/sueldos', icon: <PaidIcon fontSize="small" /> }

export default function TopBar() {
  const pathname = usePathname()
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { data: session } = useSession()

  const canSeeSueldos = session?.user?.email?.toLowerCase() === SUELDOS_ALLOWED_EMAIL
  // Inserta Sueldos justo antes de Configuración (último item), preservando el resto.
  const navItems = canSeeSueldos ? [...NAV.slice(0, -1), SUELDOS_ITEM, NAV[NAV.length - 1]] : NAV

  return (
    <>
      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Toolbar sx={{ gap: { xs: 1, md: 2 }, minHeight: { xs: 56, sm: 64 } }}>
          {isCompact && (
            <IconButton edge="start" color="primary" onClick={() => setDrawerOpen(true)} aria-label="menu">
              <MenuIcon />
            </IconButton>
          )}
          <AccountBalanceWalletIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography
            variant="h6"
            fontWeight={700}
            color="primary.main"
            sx={{ mr: { xs: 0, md: 3 }, flexGrow: { xs: 1, md: 0 }, fontSize: { xs: 18, md: 20 } }}
          >
            GastosApp
          </Typography>
          {!isCompact && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {navItems.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <Button
                    key={item.href}
                    component={Link}
                    href={item.href}
                    startIcon={item.icon}
                    variant={active ? 'contained' : 'text'}
                    color="primary"
                    sx={{ borderRadius: 2, fontWeight: active ? 600 : 400, textTransform: 'none', fontSize: 14 }}
                  >
                    {item.label}
                  </Button>
                )
              })}
            </Box>
          )}
          {session?.user && (
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
              {!isCompact && (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
                  {session.user.email}
                </Typography>
              )}
              <Tooltip title="Cerrar sesión">
                <IconButton color="primary" onClick={() => signOut({ callbackUrl: '/login' })} aria-label="cerrar sesión">
                  <LogoutIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 260, pt: 1 }} role="presentation">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5 }}>
            <AccountBalanceWalletIcon sx={{ color: 'primary.main', fontSize: 24 }} />
            <Typography variant="h6" fontWeight={700} color="primary.main">GastosApp</Typography>
          </Box>
          <List>
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <ListItemButton
                  key={item.href}
                  component={Link}
                  href={item.href}
                  selected={active}
                  onClick={() => setDrawerOpen(false)}
                  sx={{ borderRadius: 1, mx: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: active ? 600 : 400 }} />
                </ListItemButton>
              )
            })}
          </List>
        </Box>
      </Drawer>
    </>
  )
}
