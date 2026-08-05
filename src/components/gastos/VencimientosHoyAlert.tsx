'use client'

import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight'
import { vencePorGasto } from '@/lib/vencimientos'
import type { Gasto } from '@/lib/types'

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

type Entrada = {
  key: string
  tipo: 'gasto' | 'subitem'
  descripcion: string
  parent?: string
  casa_nombre?: string
  monto: number
}

export default function VencimientosHoyAlert() {
  const [pendientes, setPendientes] = useState<Entrada[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const params = new URLSearchParams({ mes: String(d.getMonth() + 1), anio: String(d.getFullYear()) })
    fetch(`/api/gastos?${params}`)
      .then(r => r.json())
      .then((gastos: Gasto[]) => {
        const out: Entrada[] = []
        for (const g of gastos) {
          const items = g.items ?? []
          if (!g.confirmado && items.length === 0) continue
          if (vencePorGasto(g.es_tarjeta, items.length)) {
            // Gasto sin sub-items (o resumen de tarjeta): vence por su propia fecha_vencimiento.
            // Igual que en `computeResumen`, si no está confirmado el total sale de los sub-items.
            const totalArs = g.confirmado
              ? g.total_ars
              : items.filter(i => i.incluye_en_total).reduce((s, i) => s + i.monto, 0)
            const restante = Math.round((totalArs - g.total_pagado) * 100) / 100
            if (g.fecha_vencimiento === today && restante > 0) {
              out.push({
                key: `g-${g.id}`,
                tipo: 'gasto',
                descripcion: g.descripcion,
                casa_nombre: g.casa_nombre,
                monto: restante,
              })
            }
          } else {
            // Gasto con sub-items: sólo cuentan los sub-items marcados "incluir en vencimiento" cuya fecha sea hoy.
            for (const it of items) {
              if (it.incluye_en_vencimiento && it.fecha === today) {
                out.push({
                  key: `i-${it.id}`,
                  tipo: 'subitem',
                  descripcion: it.descripcion,
                  parent: g.descripcion,
                  casa_nombre: g.casa_nombre,
                  monto: it.monto,
                })
              }
            }
          }
        }
        if (out.length > 0) {
          setPendientes(out)
          setOpen(true)
        }
      })
      .catch(() => {})
  }, [])

  if (pendientes.length === 0) return null

  const total = pendientes.reduce((s, e) => s + e.monto, 0)

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: '#f59e0b' }}>
        <WarningAmberIcon /> Vencimientos del día
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Tenés {pendientes.length} {pendientes.length !== 1 ? 'vencimientos' : 'vencimiento'} hoy que aún {pendientes.length !== 1 ? 'no fueron saldados' : 'no fue saldado'}:
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {pendientes.map(e => (
            <Box key={e.key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Box sx={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                {e.tipo === 'subitem' && <SubdirectoryArrowRightIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {e.descripcion}
                    {e.tipo === 'subitem' && e.parent && (
                      <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
                        · {e.parent}
                      </Typography>
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{e.casa_nombre}</Typography>
                </Box>
              </Box>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#f59e0b', flexShrink: 0, ml: 2 }}>
                {fmtARS(e.monto)}
              </Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" fontWeight={700}>Total a pagar hoy</Typography>
          <Typography variant="body2" fontWeight={700} sx={{ color: '#f59e0b' }}>{fmtARS(total)}</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpen(false)} variant="contained">Entendido</Button>
      </DialogActions>
    </Dialog>
  )
}
