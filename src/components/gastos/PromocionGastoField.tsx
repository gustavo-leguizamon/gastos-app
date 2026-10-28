'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Grid from '@mui/material/Grid'
import AppSelect from '@/components/shared/AppSelect'

interface Sugerida {
  id: number
  lugar: string
  porcentaje: number
  disponible: number
  tope_alcanzado: boolean
  coincide: boolean
}

interface Props {
  descripcion: string
  tipoPago: 'C' | 'D'
  tarjetaId: number | null
  mes: number
  anio: number
  /** Un resumen de tarjeta nunca lleva promo: se limpia la asociación y no se ofrece. */
  esTarjeta: boolean
  value: number | null
  onChange: (v: number | null) => void
  /**
   * Alta: si hay una promo que coincide (concepto + medio de pago + vigente en el mes) y le
   * queda tope, queda **elegida de entrada**. Editando no se toca nada solo.
   */
  autoSeleccionar: boolean
}

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

/**
 * Selector de la promoción a la que cuenta el gasto. El gasto no guarda fecha de compra, así
 * que la asociación es **explícita**: la promo se sugiere según concepto y medio de pago (y
 * que esté vigente en el mes) y viene elegida en el alta, pero quien carga la puede quitar —
 * por ejemplo si la compra fue antes de que la promo empezara a mitad de mes.
 *
 * No renderiza nada si no hay promo para ofrecer, así que no ensucia el form en el caso común.
 */
export default function PromocionGastoField({
  descripcion, tipoPago, tarjetaId, mes, anio, esTarjeta, value, onChange, autoSeleccionar,
}: Props) {
  const [opciones, setOpciones] = useState<Sugerida[]>([])
  // Si el usuario ya decidió (aunque sea "sin promoción"), la sugerencia no le pisa la elección.
  const tocada = useRef(false)
  // `value` no es dependencia del fetch: elegir una promo no debe disparar otra consulta ni un loop.
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!descripcion.trim()) tocada.current = false
  }, [descripcion])

  useEffect(() => {
    if (esTarjeta) {
      setOpciones([])
      if (valueRef.current != null) onChangeRef.current(null)
      return
    }
    if (!descripcion.trim() && valueRef.current == null) {
      setOpciones([])
      return
    }

    let cancelado = false
    const t = setTimeout(async () => {
      const qs = new URLSearchParams({ descripcion, tipo_pago: tipoPago, mes: String(mes), anio: String(anio) })
      if (tarjetaId) qs.set('tarjeta_id', String(tarjetaId))
      if (valueRef.current != null) qs.set('promocion_id', String(valueRef.current))
      try {
        const r = await fetch(`/api/promociones/sugeridas?${qs}`, { cache: 'no-store' })
        if (!r.ok || cancelado) return
        const data: Sugerida[] = await r.json()
        if (cancelado) return
        setOpciones(data)
        if (autoSeleccionar && !tocada.current) {
          const elegible = data.find(o => o.coincide && !o.tope_alcanzado)
          onChangeRef.current(elegible?.id ?? null)
        }
      } catch {
        /* sin sugerencias: el form sigue funcionando igual */
      }
    }, 350)

    return () => {
      cancelado = true
      clearTimeout(t)
    }
  }, [descripcion, tipoPago, tarjetaId, mes, anio, esTarjeta, autoSeleccionar])

  const options = useMemo(
    () =>
      opciones.map(o => ({
        value: o.id,
        label: `${o.lugar} ${o.porcentaje}% · ${o.tope_alcanzado ? 'tope alcanzado' : `quedan ${fmtARS(o.disponible)}`}${o.coincide ? '' : ' (ya no coincide)'}`,
      })),
    [opciones],
  )

  if (esTarjeta || options.length === 0) return null

  return (
    <Grid item xs={12}>
      <AppSelect
        label="Promoción"
        options={options}
        value={value}
        onChange={v => {
          tocada.current = true
          onChange(v == null ? null : Number(v))
        }}
        fullWidth
        emptyLabel="Sin promoción"
        helperText={
          value != null
            ? 'Este gasto suma al reintegro de la promo.'
            : 'Hay una promo para este gasto. Elegila si la tuviste; si la compra fue antes de que empezara, dejala sin promoción.'
        }
      />
    </Grid>
  )
}
