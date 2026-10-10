/**
 * Migra el campo `Gasto.prestamo_a_otro` al modelo "préstamo = gasto + devolución = gasto negativo".
 *
 *   node scripts/migrar-prestamos-a-gastos.js            # dry-run: sólo muestra qué haría
 *   node scripts/migrar-prestamos-a-gastos.js --apply    # escribe en la DB
 *
 * Por cada gasto con `prestamo_a_otro != 0`:
 *   1. le agrega la etiqueta `Préstamos` (se crea si no existe). La categoría NO se toca.
 *   2. crea un gasto **aparte con monto negativo** (`-prestamo_a_otro`) que mantiene casa,
 *      concepto, vencimiento, período, tipo de pago, tarjeta y categoría del original, y las
 *      etiquetas del original + `Préstamos` + `Devolucion` (debe existir).
 *
 * El monto del préstamo está siempre en ARS, así que el gasto nuevo va en ARS con tipo de
 * cambio 1 aunque el original sea en otra moneda. Nunca es `es_tarjeta` (aunque el original sí):
 * el resumen de tarjeta es único por tarjeta/período y un segundo rompería su búsqueda.
 *
 * Idempotente: un gasto que ya tiene la etiqueta `Préstamos` se saltea, así que correrlo dos
 * veces no duplica devoluciones. Todo corre en una sola transacción (o se aplica todo o nada).
 *
 * NO borra ni pone en 0 la columna `prestamo_a_otro`: producción puede seguir corriendo código
 * viejo que la lee hasta que se despliegue este cambio (la DB es una sola para los tres
 * ambientes). Se elimina en una migración posterior.
 */
const { PrismaClient } = require('@prisma/client')

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()

/** Sin acentos ni mayúsculas, para encontrar `Devolucion`/`Devolución` y `Préstamos`/`Prestamos`. */
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

const findEtiqueta = (todas, nombre) => todas.find(e => norm(e.nombre) === norm(nombre))

;(async () => {
  const etiquetas = await prisma.etiqueta.findMany()
  const devolucion = findEtiqueta(etiquetas, 'Devolucion')
  if (!devolucion) throw new Error('No existe la etiqueta Devolucion: crearla antes de migrar.')
  let prestamos = findEtiqueta(etiquetas, 'Préstamos')

  const ars = await prisma.moneda.findUnique({ where: { codigo: 'ARS' } })
  if (!ars) throw new Error('No existe la moneda ARS.')

  const gastos = await prisma.gasto.findMany({
    where: { prestamo_a_otro: { not: 0 } },
    include: { concepto: true, etiquetas: true },
    orderBy: [{ anio: 'asc' }, { mes: 'asc' }, { id: 'asc' }],
  })

  const pendientes = gastos.filter(g => !prestamos || !g.etiquetas.some(e => e.id === prestamos.id))
  console.log(`Gastos con préstamo: ${gastos.length} · a migrar: ${pendientes.length}`)
  console.log(`Etiqueta Préstamos: ${prestamos ? `existe (id ${prestamos.id})` : 'se crea'} · Devolucion: id ${devolucion.id}`)
  for (const g of pendientes) {
    console.log(`  #${g.id} ${g.mes}/${g.anio} ${g.concepto.nombre}  → devolución ${-g.prestamo_a_otro}`)
  }

  if (!APPLY) {
    console.log('\nDry-run: no se escribió nada. Usá --apply para migrar.')
    return
  }
  if (!pendientes.length) return

  const creados = await prisma.$transaction(async tx => {
    if (!prestamos) prestamos = await tx.etiqueta.create({ data: { nombre: 'Préstamos' } })
    const out = []
    for (const g of pendientes) {
      await tx.gasto.update({ where: { id: g.id }, data: { etiquetas: { connect: { id: prestamos.id } } } })
      const etiquetaIds = new Set([...g.etiquetas.map(e => e.id), prestamos.id, devolucion.id])
      const dev = await tx.gasto.create({
        data: {
          casaId: g.casaId,
          conceptoId: g.conceptoId,
          fechaVencimiento: g.fechaVencimiento,
          tipoPago: g.tipoPago,
          monedaId: ars.id,
          tipoCambio: 1,
          totalMoneda: -g.prestamo_a_otro,
          tarjetaId: g.tarjetaId,
          mes: g.mes,
          anio: g.anio,
          notas: `Devolución del préstamo del gasto #${g.id}`,
          confirmado: true,
          esTarjeta: false,
          categoriaId: g.categoriaId,
          etiquetas: { connect: [...etiquetaIds].map(id => ({ id })) },
        },
      })
      out.push(`${g.id}→${dev.id}`)
    }
    return out
  }, { timeout: 120000, maxWait: 20000 })
  console.log(`\nOK: ${creados.length} devoluciones creadas (original→devolución): ${creados.join(', ')}`)
})()
  .catch(e => {
    console.error('FALLO:', e.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
