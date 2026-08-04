// Pure computation helpers for mapping Prisma `Gasto` rows (camelCase) to the
// snake_case API response shape used by the client. Kept free of Prisma/Next
// imports so it can be unit-tested in isolation.

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Mapea un `GastoItem` (camelCase, con `concepto` y `categorias` incluidos) a la forma
 * snake_case. `descripcion` es derivada de `concepto.nombre` (la columna ya no existe).
 */
export function toItemResponse(i: any) {
  return {
    id: i.id,
    gasto_id: i.gastoId,
    concepto_id: i.conceptoId,
    descripcion: i.concepto?.nombre ?? '',
    monto: i.monto,
    fecha: i.fecha ?? null,
    cuota_actual: i.cuotaActual ?? null,
    cuotas_totales: i.cuotasTotales ?? null,
    incluye_en_total: i.incluyeEnTotal,
    incluye_en_vencimiento: i.incluyeEnVencimiento,
    verificado: i.verificado ?? false,
    categoria_id: i.categoriaId ?? null,
    categoria: i.categoria ? { id: i.categoria.id, nombre: i.categoria.nombre } : null,
    etiqueta_ids: (i.etiquetas ?? []).map((c: any) => c.id),
    etiquetas: (i.etiquetas ?? []).map((c: any) => ({ id: c.id, nombre: c.nombre })),
    created_at: i.createdAt?.toISOString(),
  }
}

/**
 * Maps a Prisma `Gasto` (with its relations) to the snake_case response shape.
 * Computes `total_ars`, `total_pagado` y `total_restante`, y resuelve el
 * `cierre` de tarjeta correspondiente al mes/año del gasto.
 *
 * Acepta `any` porque recibe el row crudo de Prisma con includes variables.
 */
export function toGastoResponse(g: any) {
  const totalArs = round2(g.totalMoneda * g.tipoCambio)
  const pagos = (g.pagos ?? []).map((p: any) => ({
    id: p.id,
    gasto_id: p.gastoId,
    fecha: p.fecha,
    monto: p.monto,
    created_at: p.createdAt?.toISOString(),
  }))
  const totalPagado = round2(pagos.reduce((s: number, p: any) => s + p.monto, 0))
  const cierreRow = g.tarjeta?.cierres?.find((c: any) => c.mes === g.mes && c.anio === g.anio) ?? null
  const cierre = cierreRow ? {
    fecha_cierre: cierreRow.fechaCierre ?? null,
    fecha_vencimiento: cierreRow.fechaVencimiento ?? null,
    fecha_proximo_cierre: cierreRow.fechaProximoCierre ?? null,
  } : null
  return {
    id: g.id,
    casa_id: g.casaId,
    casa_nombre: g.casa?.nombre,
    concepto_id: g.conceptoId,
    descripcion: g.concepto?.nombre ?? '',
    fecha_vencimiento: g.fechaVencimiento,
    tipo_pago: g.tipoPago,
    moneda_id: g.monedaId,
    moneda_codigo: g.moneda?.codigo,
    moneda_simbolo: g.moneda?.simbolo,
    tipo_cambio: g.tipoCambio,
    total_moneda: g.totalMoneda,
    total_ars: totalArs,
    total_pagado: totalPagado,
    total_restante: round2(totalArs - totalPagado),
    pasaje_mes_siguiente: g.pasajeMesSiguiente,
    prestamo_a_otro: g.prestamo_a_otro,
    tarjeta_id: g.tarjetaId,
    tarjeta_nombre: g.tarjeta?.nombre ?? null,
    tarjeta_banco: g.tarjeta?.banco ?? null,
    tarjeta_marca: g.tarjeta?.marca ?? null,
    tarjeta_banco_logo: g.tarjeta?.bancoLogo ?? null,
    categoria_id: g.categoriaId ?? null,
    categoria: g.categoria ? { id: g.categoria.id, nombre: g.categoria.nombre } : null,
    etiqueta_ids: (g.etiquetas ?? []).map((c: any) => c.id),
    etiquetas: (g.etiquetas ?? []).map((c: any) => ({ id: c.id, nombre: c.nombre })),
    cuota_actual: g.cuotaActual ?? null,
    cuotas_totales: g.cuotasTotales ?? null,
    mes: g.mes,
    anio: g.anio,
    notas: g.notas,
    confirmado: g.confirmado,
    es_tarjeta: g.esTarjeta ?? false,
    cierre,
    created_at: g.createdAt?.toISOString(),
    updated_at: g.updatedAt?.toISOString(),
    pagos,
    items: (g.items ?? []).map(toItemResponse),
  }
}
