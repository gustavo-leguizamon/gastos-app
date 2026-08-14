'use client'

import { useEffect, useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import AppToggle from '@/components/shared/AppToggle'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import toast from 'react-hot-toast'
import { urlBase64ToUint8Array, toSubscribeBody } from '@/lib/push-client'

/**
 * Alta/baja de las notificaciones push de vencimientos **para este device**.
 *
 * El permiso y la suscripción son por browser/dispositivo: activarlo en el celular no
 * lo activa en la desktop. La notificación diaria la manda `/api/cron/vencimientos`.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

type Estado =
  | 'checking'      // averiguando si hay suscripción
  | 'unsupported'   // el browser no soporta push (iOS sin PWA instalada, por ejemplo)
  | 'denied'        // el usuario bloqueó las notificaciones para el sitio
  | 'off'
  | 'on'

export default function NotificacionesCard() {
  const [estado, setEstado] = useState<Estado>('checking')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setEstado('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setEstado('denied')
      return
    }
    navigator.serviceWorker.getRegistration()
      .then(reg => reg?.pushManager.getSubscription() ?? null)
      .then(sub => setEstado(sub ? 'on' : 'off'))
      .catch(() => setEstado('off'))
  }, [])

  const activar = async () => {
    setBusy(true)
    try {
      if (!VAPID_PUBLIC_KEY) {
        toast.error('Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en el servidor')
        return
      }
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'denied' : 'off')
        toast.error('No diste permiso para notificaciones')
        return
      }

      // `register` es idempotente: si el SW ya está registrado devuelve el existente.
      // Lo llamamos igual porque en dev `ServiceWorkerRegister` no lo registra.
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSubscribeBody(sub)),
      })
      if (!res.ok) throw new Error('No se pudo guardar la suscripción')

      setEstado('on')
      toast.success('Notificaciones activadas en este dispositivo')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al activar notificaciones')
    } finally {
      setBusy(false)
    }
  }

  const desactivar = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        // Primero borramos del server: si `unsubscribe` falla, al menos no queda un
        // endpoint que el cron siga intentando usar.
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setEstado('off')
      toast.success('Notificaciones desactivadas en este dispositivo')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al desactivar notificaciones')
    } finally {
      setBusy(false)
    }
  }

  const probar = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'No se pudo enviar la prueba')
      toast.success(`Enviada a ${data.enviadas} dispositivo${data.enviadas === 1 ? '' : 's'}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar la prueba')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader
        titleTypographyProps={{ fontWeight: 700, variant: 'h6' }}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsActiveIcon fontSize="small" sx={{ color: 'primary.main' }} />
            Notificaciones de vencimientos
          </Box>
        }
      />
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Un aviso diario a las 8:00 con los vencimientos del día que todavía no están saldados.
          El permiso es <strong>por dispositivo</strong>: activalo en cada uno donde quieras recibirlo.
        </Typography>

        {estado === 'unsupported' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Este navegador no soporta notificaciones push. En iPhone hay que{' '}
            <strong>instalar la app en la pantalla de inicio</strong> (Compartir → Agregar a inicio) y
            abrirla desde ahí.
          </Alert>
        )}

        {estado === 'denied' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Las notificaciones están bloqueadas para este sitio. Habilitalas desde la configuración
            del navegador (candado en la barra de direcciones) y volvé a esta pantalla.
          </Alert>
        )}

        {(estado === 'on' || estado === 'off' || estado === 'checking') && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
            <AppToggle
              checked={estado === 'on'}
              disabled={busy || estado === 'checking'}
              onChange={e => (e.target.checked ? activar() : desactivar())}
              label={
                <Typography variant="body2">
                  {estado === 'on' ? 'Activadas en este dispositivo' : 'Desactivadas en este dispositivo'}
                </Typography>
              }
            />
            <Button variant="outlined" size="small" onClick={probar} disabled={busy || estado !== 'on'}>
              Probar notificación
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
