'use client'

import { useEffect, useState } from 'react'
import { alpha, type Theme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import BrandLogo from '@/components/shared/BrandLogo'
import BancoLogo from '@/components/shared/BancoLogo'
import { marcaColor } from '@/components/shared/TarjetaLogo'
import type { EstadoCiclo } from '@/lib/cierres'
import type { FiltrosGastos, TarjetaMarca } from '@/lib/types'

type TarjetaCiclo = {
  id: number
  nombre: string
  banco: string | null
  marca: string | null
  banco_logo: string | null
  banco_icono: string | null
  fecha_cierre: string | null
  fecha_vencimiento: string | null
  fecha_proximo_cierre: string | null
  estado: EstadoCiclo
  dias_para_cierre: number | null
  progreso: number | null
}

interface Props {
  filtros: FiltrosGastos
  refreshKey: number
}

/**
 * Texto del pie de la card: qué le falta a la tarjeta para cerrar. En `por_cerrar` los días son
 * hasta el cierre de **este** resumen (todavía abierto), no hasta el siguiente, así que el copy
 * lo dice distinto para que las dos barras no se lean como lo mismo.
 */
function leyenda(t: TarjetaCiclo): string {
  if (t.estado === 'sin_fecha') return 'sin cierre cargado'
  const dias = t.dias_para_cierre ?? 0
  const falta =
    dias === 0
      ? 'cierra hoy'
      : t.estado === 'por_cerrar'
        ? `cierra en ${dias} ${dias === 1 ? 'día' : 'días'}`
        : dias === 1
          ? 'falta 1 día'
          : `faltan ${dias} días`
  return t.progreso === null ? falta : `${falta} · ${Math.round(t.progreso * 100)}%`
}

export default function ProximosCierres({ filtros, refreshKey }: Props) {
  const [tarjetas, setTarjetas] = useState<TarjetaCiclo[]>([])

  useEffect(() => {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const params = new URLSearchParams({
      mes: String(filtros.mes),
      anio: String(filtros.anio),
      today,
    })
    fetch(`/api/tarjetas/proximos-cierres?${params}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((data: TarjetaCiclo[]) => setTarjetas(Array.isArray(data) ? data : []))
      .catch(() => setTarjetas([]))
  }, [filtros.mes, filtros.anio, refreshKey])

  if (tarjetas.length === 0) return null

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
        Cierres de tarjeta del mes — primero las que ya cerraron
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'stretch' }}>
        {tarjetas.map(t => {
          const titulo = t.banco || t.nombre
          const subtitulo = titulo !== t.nombre ? t.nombre : null
          const cerrada = t.estado === 'cerrado'
          // La tarjeta cerrada se muestra como siempre (tintada con el color de la marca);
          // la que todavía no cerró va grisada, para que el estado se lea de un vistazo.
          const accent = marcaColor((t.marca ?? null) as TarjetaMarca | null) ?? '#6366f1'
          // `por_cerrar` = el resumen de este período todavía está abierto y cierra en breve.
          // Va en ámbar y no en el gris de las abiertas porque es el estado accionable: es la
          // última ventana para cargarle consumos antes de que el resumen quede fijo.
          const porCerrar = t.estado === 'por_cerrar'
          return (
            <Tooltip
              key={t.id}
              arrow
              title={
                <Box>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    <strong>{t.nombre}</strong>{t.marca ? ` · ${t.marca}` : ''}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    <strong>Cierre:</strong> {t.fecha_cierre || '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    <strong>Vencimiento:</strong> {t.fecha_vencimiento || '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    <strong>Próximo cierre:</strong> {t.fecha_proximo_cierre || '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                    {cerrada ? 'Ya cerró' : leyenda(t)}
                  </Typography>
                  {porCerrar && (
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      El resumen de este período todavía no cerró
                      {t.fecha_proximo_cierre ? '' : ' · falta cargar el próximo cierre'}
                    </Typography>
                  )}
                </Box>
              }
            >
              <Card
                variant="outlined"
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 0.75,
                  px: 1.5,
                  py: 1,
                  minWidth: 168,
                  borderColor: cerrada
                    ? `${accent}55`
                    : porCerrar
                      ? (theme: Theme) => alpha(theme.palette.warning.main, 0.5)
                      : 'divider',
                  bgcolor: cerrada
                    ? `${accent}10`
                    : porCerrar
                      ? (theme: Theme) => alpha(theme.palette.warning.main, 0.12)
                      : 'action.hover',
                  cursor: 'default',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    ...(cerrada ? {} : { filter: 'grayscale(1)', opacity: 0.65 }),
                  }}
                >
                  <BrandLogo marca={t.marca} width={44} height={32} />
                  <BancoLogo banco={t.banco_logo} icono={t.banco_icono} bancoTexto={t.banco} size={24} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.2 }} noWrap>
                      {titulo}
                    </Typography>
                    {subtitulo && (
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }} noWrap>
                        {subtitulo}
                      </Typography>
                    )}
                  </Box>
                </Box>
                {!cerrada && (
                  <Box>
                    <Typography
                      variant="caption"
                      color={porCerrar ? 'warning.main' : 'text.secondary'}
                      sx={{ display: 'block', lineHeight: 1.4, fontWeight: porCerrar ? 600 : 400 }}
                    >
                      {leyenda(t)}
                    </Typography>
                    {t.progreso !== null && (
                      <LinearProgress
                        variant="determinate"
                        color={porCerrar ? 'warning' : 'primary'}
                        value={t.progreso * 100}
                        sx={{ height: 4, borderRadius: 2, mt: 0.25 }}
                      />
                    )}
                  </Box>
                )}
              </Card>
            </Tooltip>
          )
        })}
      </Box>
    </Box>
  )
}
