'use client'

import { Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'

function LoginInner() {
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') ?? '/gastos'
  const error = params.get('error')

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: 3 }}>
          <AccountBalanceWalletIcon sx={{ color: 'primary.main', fontSize: 48 }} />
          <Typography variant="h5" fontWeight={700} color="primary.main">
            GastosApp
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ingresá con tu cuenta de Google
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
            {error === 'AccessDenied'
              ? 'Tu cuenta no tiene acceso a esta aplicación.'
              : 'No se pudo iniciar sesión. Intentalo de nuevo.'}
          </Alert>
        )}

        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={() => signIn('google', { callbackUrl })}
        >
          Continuar con Google
        </Button>
      </Paper>
    </Box>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}
