'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import BrandLogo from '@/components/shared/BrandLogo'
import BancoLogo from '@/components/shared/BancoLogo'
import { marcaColor } from '@/components/shared/TarjetaLogo'
import type { FiltrosGastos, TarjetaMarca } from '@/lib/types'

type TarjetaCerrada = {
  id: number
  nombre: string
  banco: string | null
  marca: string | null
  banco_logo: string | null
  banco_icono: string | null
  fecha_cierre: string | null
  fecha_vencimiento: string | null
  fecha_proximo_cierre: string | null
}

interface Props {
  filtros: FiltrosGastos
  refreshKey: number
}

export default function TarjetasCerradas({ filtros, refreshKey }: Props) {
  const [tarjetas, setTarjetas] = useState<TarjetaCerrada[]>([])

  useEffect(() => {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const params = new URLSearchParams({
      mes: String(filtros.mes),
      anio: String(filtros.anio),
      today,
    })
    fetch(`/api/tarjetas/cerradas?${params}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((data: TarjetaCerrada[]) => setTarjetas(Array.isArray(data) ? data : []))
      .catch(() => setTarjetas([]))
  }, [filtros.mes, filtros.anio, refreshKey])

  if (tarjetas.length === 0) return null

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
        Tarjetas con próximo cierre ya pasado este mes
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {tarjetas.map(t => {
          const titulo = t.banco || t.nombre
          const subtitulo = titulo !== t.nombre ? t.nombre : null
          const accent = marcaColor((t.marca ?? null) as TarjetaMarca | null) ?? '#6366f1'
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
                </Box>
              }
            >
              <Card
                variant="outlined"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderColor: `${accent}55`,
                  bgcolor: `${accent}10`,
                  cursor: 'default',
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
              </Card>
            </Tooltip>
          )
        })}
      </Box>
    </Box>
  )
}
