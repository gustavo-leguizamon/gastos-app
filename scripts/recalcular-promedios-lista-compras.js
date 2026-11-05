/**
 * Recalcula lo llevado y el precio promedio de todas las líneas de la lista de compras que
 * tienen compras registradas, con la regla vigente de `resumenCompras`
 * (`src/lib/lista-compras-compute.ts`): promedio **ponderado por cantidad** de las compras con
 * precio **mayor a 0** (las de $0 o sin precio suman cantidad pero no entran al promedio).
 *
 *   node scripts/recalcular-promedios-lista-compras.js            # dry-run: sólo muestra qué cambiaría
 *   node scripts/recalcular-promedios-lista-compras.js --apply    # escribe en la DB
 *
 * Hace falta porque el promedio se guarda denormalizado en la línea y sólo se recalcula al
 * tocar una compra: las líneas que ya tenían una compra a $0 quedaron con el promedio viejo.
 *
 * Igual que `recalcularLinea`: si ninguna compra tiene precio > 0, **no toca** el precio de la
 * línea. Idempotente: correrlo de nuevo no cambia nada. La regla está duplicada acá (el script
 * es JS y no importa el TS); si cambia `resumenCompras`, actualizar también este archivo.
 */
const { PrismaClient } = require('@prisma/client')

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()

/** Copia de `resumenCompras`. */
function resumenCompras(compras) {
  let total = 0
  let conPrecio = 0
  let importe = 0
  for (const c of compras) {
    total += c.cantidad
    if (c.precioUnitario != null && c.precioUnitario > 0) {
      conPrecio += c.cantidad
      importe += c.cantidad * c.precioUnitario
    }
  }
  return {
    cantidadComprada: Math.round(total * 1e6) / 1e6,
    precioPromedio: conPrecio > 0 ? importe / conPrecio : null,
  }
}

const mismo = (a, b) => (a == null || b == null ? a === b : Math.abs(a - b) < 1e-9)

;(async () => {
  const lineas = await prisma.listaCompraItem.findMany({
    where: { compras: { some: {} } },
    include: { articulo: true, compras: { select: { cantidad: true, precioUnitario: true } } },
    orderBy: [{ anio: 'asc' }, { mes: 'asc' }, { id: 'asc' }],
  })

  const cambios = []
  for (const l of lineas) {
    const { cantidadComprada, precioPromedio } = resumenCompras(l.compras)
    const precio = precioPromedio != null ? precioPromedio : l.precioUnitario
    if (mismo(cantidadComprada, l.cantidadComprada) && mismo(precio, l.precioUnitario)) continue
    cambios.push({ l, cantidadComprada, precio })
  }

  console.log(`${lineas.length} línea(s) con compras; ${cambios.length} cambian.`)
  for (const { l, cantidadComprada, precio } of cambios) {
    const periodo = `${String(l.mes).padStart(2, '0')}/${l.anio}`
    console.log(
      `  [${l.id}] ${periodo} ${l.articulo.nombre}: precio ${l.precioUnitario} → ${precio}` +
        (mismo(cantidadComprada, l.cantidadComprada) ? '' : `, llevado ${l.cantidadComprada} → ${cantidadComprada}`),
    )
  }

  if (!APPLY) {
    console.log('\nDry-run: no se escribió nada. Correr con --apply para guardar.')
    return
  }
  await prisma.$transaction(
    cambios.map(({ l, cantidadComprada, precio }) =>
      prisma.listaCompraItem.update({ where: { id: l.id }, data: { cantidadComprada, precioUnitario: precio } }),
    ),
  )
  console.log(`\nListo: ${cambios.length} línea(s) actualizadas.`)
})()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
